package com.syncwave.music.ui.scheduler

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.domain.model.RepeatType
import com.syncwave.music.domain.model.SchedulePriority
import com.syncwave.music.domain.model.ScheduleTargetType
import com.syncwave.music.domain.model.TransitionType
import com.syncwave.music.ui.theme.AccentCyan
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.CardBackgroundDark
import com.syncwave.music.ui.theme.ErrorRed
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SecondaryGreen
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ScheduleCreateEditScreen(
    scheduleId: String?,
    onNavigateBack: () -> Unit,
    viewModel: SchedulerViewModel = hiltViewModel()
) {
    val formState by viewModel.formState.collectAsStateWithLifecycle()
    val isEditing = !scheduleId.isNullOrBlank()

    LaunchedEffect(scheduleId) {
        if (isEditing) {
            viewModel.loadScheduleForEditing(scheduleId)
        } else {
            viewModel.resetForm()
        }
    }

    LaunchedEffect(formState.saveSuccess) {
        if (formState.saveSuccess) {
            onNavigateBack()
        }
    }

    val timePickerState = rememberTimePickerState(
        initialHour = formState.timeHour,
        initialMinute = formState.timeMinute,
        is24Hour = false
    )

    // Sync time picker changes back to form state
    LaunchedEffect(timePickerState.hour, timePickerState.minute) {
        viewModel.updateForm {
            it.copy(
                timeHour = timePickerState.hour,
                timeMinute = timePickerState.minute
            )
        }
    }

    var targetDropdownExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        // Top Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onNavigateBack) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = TextPrimaryDark
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isEditing) "Edit Routine" else "New Smart Routine",
                    color = TextPrimaryDark,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            if (isEditing) {
                IconButton(onClick = {
                    viewModel.deleteSchedule(scheduleId!!)
                    onNavigateBack()
                }) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete",
                        tint = ErrorRed
                    )
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 10.dp)
        ) {
            // Routine Name
            Text(
                text = "Routine Name",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = formState.name,
                onValueChange = { name -> viewModel.updateForm { it.copy(name = name) } },
                placeholder = { Text("e.g. Morning Wakeup, Workout Drive, Sleep Peace", color = TextTertiaryDark) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = SurfaceDark,
                    unfocusedContainerColor = SurfaceDark,
                    focusedBorderColor = PrimaryPurple,
                    unfocusedBorderColor = Color.Transparent,
                    focusedTextColor = TextPrimaryDark,
                    unfocusedTextColor = TextPrimaryDark
                )
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Time Picker
            Text(
                text = "Scheduled Start Time",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceDark)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                TimePicker(state = timePickerState)
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Target Type (Playlist or Song)
            Text(
                text = "Music to Play",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                FilterChip(
                    selected = formState.targetType == ScheduleTargetType.PLAYLIST,
                    onClick = {
                        val firstPl = formState.availablePlaylists.firstOrNull()
                        viewModel.updateForm {
                            it.copy(
                                targetType = ScheduleTargetType.PLAYLIST,
                                targetId = firstPl?.id ?: "",
                                targetName = firstPl?.name ?: "No Playlist"
                            )
                        }
                    },
                    label = { Text("Playlist") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PrimaryPurple,
                        selectedLabelColor = TextPrimaryDark,
                        containerColor = SurfaceDark,
                        labelColor = TextSecondaryDark
                    )
                )

                FilterChip(
                    selected = formState.targetType == ScheduleTargetType.SONG,
                    onClick = {
                        val firstSong = formState.availableSongs.firstOrNull()
                        viewModel.updateForm {
                            it.copy(
                                targetType = ScheduleTargetType.SONG,
                                targetId = firstSong?.id ?: "",
                                targetName = firstSong?.title ?: "No Song"
                            )
                        }
                    },
                    label = { Text("Individual Track") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PrimaryPurple,
                        selectedLabelColor = TextPrimaryDark,
                        containerColor = SurfaceDark,
                        labelColor = TextSecondaryDark
                    )
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Target Selector Dropdown
            ExposedDropdownMenuBox(
                expanded = targetDropdownExpanded,
                onExpandedChange = { targetDropdownExpanded = it }
            ) {
                OutlinedTextField(
                    value = formState.targetName.ifEmpty { "Select ${formState.targetType.name.lowercase()}" },
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = targetDropdownExpanded) },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceDark,
                        unfocusedContainerColor = SurfaceDark,
                        focusedBorderColor = PrimaryPurple,
                        unfocusedBorderColor = Color.Transparent,
                        focusedTextColor = TextPrimaryDark,
                        unfocusedTextColor = TextPrimaryDark
                    )
                )

                ExposedDropdownMenu(
                    expanded = targetDropdownExpanded,
                    onDismissRequest = { targetDropdownExpanded = false },
                    modifier = Modifier.background(SurfaceDark)
                ) {
                    if (formState.targetType == ScheduleTargetType.PLAYLIST) {
                        formState.availablePlaylists.forEach { pl ->
                            DropdownMenuItem(
                                text = { Text(pl.name, color = TextPrimaryDark) },
                                onClick = {
                                    viewModel.updateForm {
                                        it.copy(targetId = pl.id, targetName = pl.name)
                                    }
                                    targetDropdownExpanded = false
                                }
                            )
                        }
                    } else {
                        formState.availableSongs.forEach { song ->
                            DropdownMenuItem(
                                text = { Text("${song.title} • ${song.artist}", color = TextPrimaryDark) },
                                onClick = {
                                    viewModel.updateForm {
                                        it.copy(targetId = song.id, targetName = song.title)
                                    }
                                    targetDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Recurrence Type
            Text(
                text = "Repeat Schedule",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                RepeatType.values().forEach { rType ->
                    FilterChip(
                        selected = formState.repeatType == rType,
                        onClick = { viewModel.updateForm { it.copy(repeatType = rType) } },
                        label = { Text(rType.name.replace("_", " ")) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AccentCyan,
                            selectedLabelColor = BackgroundDark,
                            containerColor = SurfaceDark,
                            labelColor = TextSecondaryDark
                        )
                    )
                }
            }

            // Custom Days Selector if CUSTOM_DAYS is selected
            if (formState.repeatType == RepeatType.CUSTOM_DAYS) {
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Select Days",
                    color = TextSecondaryDark,
                    fontSize = 12.sp
                )
                Spacer(modifier = Modifier.height(6.dp))
                val daysLabels = listOf(
                    1 to "Mon", 2 to "Tue", 3 to "Wed", 4 to "Thu",
                    5 to "Fri", 6 to "Sat", 7 to "Sun"
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    daysLabels.forEach { (dayNum, label) ->
                        val isDaySelected = formState.selectedDays.contains(dayNum)
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(if (isDaySelected) SecondaryGreen else SurfaceDark)
                                .clickable {
                                    val newDays = if (isDaySelected) {
                                        formState.selectedDays - dayNum
                                    } else {
                                        formState.selectedDays + dayNum
                                    }
                                    viewModel.updateForm { it.copy(selectedDays = newDays) }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = label,
                                color = if (isDaySelected) BackgroundDark else TextSecondaryDark,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Priority Selection
            Text(
                text = "Conflict Priority",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                SchedulePriority.values().forEach { priority ->
                    FilterChip(
                        selected = formState.priority == priority,
                        onClick = { viewModel.updateForm { it.copy(priority = priority) } },
                        label = { Text(priority.name) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PrimaryPurple,
                            selectedLabelColor = TextPrimaryDark,
                            containerColor = SurfaceDark,
                            labelColor = TextSecondaryDark
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Transition Setting
            Text(
                text = "Audio Transition: ${formState.transitionType.name} (${formState.transitionSec}s)",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Slider(
                value = formState.transitionSec.toFloat(),
                onValueChange = { viewModel.updateForm { f -> f.copy(transitionSec = it.toInt()) } },
                valueRange = 1f..10f,
                steps = 8,
                colors = SliderDefaults.colors(
                    thumbColor = PrimaryPurple,
                    activeTrackColor = PrimaryPurple,
                    inactiveTrackColor = CardBackgroundDark
                )
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Volume Setting
            Text(
                text = "Target Routine Volume: ${(formState.volume * 100).toInt()}%",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium
            )
            Slider(
                value = formState.volume,
                onValueChange = { viewModel.updateForm { f -> f.copy(volume = it) } },
                valueRange = 0.1f..1.0f,
                colors = SliderDefaults.colors(
                    thumbColor = SecondaryGreen,
                    activeTrackColor = SecondaryGreen,
                    inactiveTrackColor = CardBackgroundDark
                )
            )

            // Error message if any
            formState.errorMessage?.let { error ->
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = error,
                    color = ErrorRed,
                    fontSize = 13.sp
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Save Routine Button
            Button(
                onClick = { viewModel.saveSchedule() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = PrimaryPurple,
                    contentColor = TextPrimaryDark
                ),
                enabled = !formState.isSaving
            ) {
                if (formState.isSaving) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = TextPrimaryDark,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = if (isEditing) "Save Routine Changes" else "Create Smart Routine",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
