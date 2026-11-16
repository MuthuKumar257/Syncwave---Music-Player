package com.syncwave.music.ui.scheduler

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import com.syncwave.music.ui.components.EmptyStateView
import com.syncwave.music.ui.components.ScheduleCard
import com.syncwave.music.ui.home.UpcomingScheduleBanner
import com.syncwave.music.ui.theme.AccentAmber
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.CardBackgroundDark
import com.syncwave.music.ui.theme.ErrorRed
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SecondaryGreen
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SchedulerDashboardScreen(
    onNavigateToCreate: () -> Unit,
    onNavigateToEdit: (String) -> Unit,
    viewModel: SchedulerViewModel = hiltViewModel()
) {
    val dashboardState by viewModel.dashboardState.collectAsStateWithLifecycle()
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Routines, 1: History

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Scheduler",
                        color = TextPrimaryDark,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "Automated routines and audio transitions",
                        color = TextTertiaryDark,
                        fontSize = 12.sp
                    )
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AccentAmber.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "${dashboardState.schedules.count { it.isEnabled }} active",
                        color = AccentAmber,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            // Tab bar (Routines / Execution Logs)
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = BackgroundDark,
                contentColor = TextPrimaryDark,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[selectedTab]),
                        color = TextPrimaryDark,
                        height = 2.dp
                    )
                },
                divider = {}
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = {
                        Text(
                            text = "Routines (${dashboardState.schedules.size})",
                            color = if (selectedTab == 0) TextPrimaryDark else TextTertiaryDark,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp
                        )
                    }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = {
                        Text(
                            text = "History logs",
                            color = if (selectedTab == 1) TextPrimaryDark else TextTertiaryDark,
                            fontWeight = FontWeight.Medium,
                            fontSize = 13.sp
                        )
                    }
                )
            }

            if (selectedTab == 0) {
                // Routines List
                if (dashboardState.schedules.isEmpty()) {
                    EmptyStateView(
                        icon = Icons.Default.Alarm,
                        title = "No routines scheduled",
                        subtitle = "Create your first smart schedule to automatically play music for morning alarms, focus hours, workouts or sleep.",
                        actionButtonText = "Create Routine",
                        onActionClick = onNavigateToCreate
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Upcoming Schedule banner if available
                        if (dashboardState.nextSchedule != null) {
                            item {
                                UpcomingScheduleBanner(
                                    schedule = dashboardState.nextSchedule!!,
                                    onClick = { onNavigateToEdit(dashboardState.nextSchedule!!.id) }
                                )
                            }
                        }

                        item {
                            Text(
                                text = "All Routines",
                                color = TextPrimaryDark,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(vertical = 4.dp)
                            )
                        }

                        items(dashboardState.schedules, key = { it.id }) { schedule ->
                            ScheduleCard(
                                schedule = schedule,
                                onToggleEnabled = { enabled ->
                                    viewModel.toggleScheduleEnabled(schedule, enabled)
                                },
                                onClick = { onNavigateToEdit(schedule.id) }
                            )
                        }

                        item { Spacer(modifier = Modifier.height(90.dp)) }
                    }
                }
            } else {
                // History Logs
                if (dashboardState.executionHistory.isEmpty()) {
                    EmptyStateView(
                        icon = Icons.Default.History,
                        title = "No execution history yet",
                        subtitle = "When scheduled routines trigger in the background, their execution records and conflict resolutions will appear here."
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(dashboardState.executionHistory, key = { it.id }) { record ->
                            ExecutionHistoryCard(record = record)
                        }
                        item { Spacer(modifier = Modifier.height(90.dp)) }
                    }
                }
            }
        }

        // Action button to create a new routine
        FloatingActionButton(
            onClick = onNavigateToCreate,
            containerColor = TextPrimaryDark,
            contentColor = BackgroundDark,
            shape = RoundedCornerShape(8.dp),
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 90.dp)
        ) {
            Icon(imageVector = Icons.Default.Add, contentDescription = "Add Routine")
        }
    }
}

@Composable
fun ExecutionHistoryCard(record: ScheduleExecutionRecord) {
    val dateFormat = remember { SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault()) }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceDark)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (record.success) Icons.Default.CheckCircle else Icons.Default.Error,
            contentDescription = null,
            tint = if (record.success) SecondaryGreen else ErrorRed,
            modifier = Modifier.size(24.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = record.scheduleName,
                color = TextPrimaryDark,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp
            )
            Text(
                text = "${record.targetName} • ${record.statusMessage}",
                color = TextSecondaryDark,
                fontSize = 12.sp
            )
        }

        Text(
            text = dateFormat.format(Date(record.executedAt)),
            color = TextTertiaryDark,
            fontSize = 11.sp
        )
    }
}

