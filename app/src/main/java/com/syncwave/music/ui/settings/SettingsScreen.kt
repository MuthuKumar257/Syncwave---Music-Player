package com.syncwave.music.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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

@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showClearHistoryDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.historyClearedMessage) {
        uiState.historyClearedMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearMessage()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 18.dp)
        ) {
            Text(
                text = "Settings",
                color = TextPrimaryDark,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Audio preferences, automation, and system configuration",
                color = TextSecondaryDark,
                fontSize = 13.sp
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Appearance Section
            SettingsSectionHeader(title = "Appearance")

            SettingsRow(
                icon = Icons.Default.DarkMode,
                title = "Dark Theme",
                subtitle = "SyncWave is optimized for high contrast dark-first mode",
                action = {
                    Switch(
                        checked = uiState.isDarkMode,
                        onCheckedChange = { viewModel.setDarkMode(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = TextPrimaryDark,
                            checkedTrackColor = PrimaryPurple
                        )
                    )
                }
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Playback Section
            SettingsSectionHeader(title = "Audio & Playback")

            SettingsRow(
                icon = Icons.Default.Tune,
                title = "Audio Crossfade",
                subtitle = "Seamlessly blend between songs (${uiState.crossfadeDurationSec}s)",
                action = {
                    Switch(
                        checked = uiState.isCrossfadeEnabled,
                        onCheckedChange = { viewModel.setCrossfadeEnabled(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = TextPrimaryDark,
                            checkedTrackColor = PrimaryPurple
                        )
                    )
                }
            )

            if (uiState.isCrossfadeEnabled) {
                Spacer(modifier = Modifier.height(8.dp))
                Slider(
                    value = uiState.crossfadeDurationSec.toFloat(),
                    onValueChange = { viewModel.setCrossfadeDuration(it.toInt()) },
                    valueRange = 1f..10f,
                    steps = 8,
                    colors = SliderDefaults.colors(
                        thumbColor = PrimaryPurple,
                        activeTrackColor = PrimaryPurple,
                        inactiveTrackColor = SurfaceDark
                    ),
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            SettingsRow(
                icon = Icons.Default.Speed,
                title = "Playback Speed",
                subtitle = "${uiState.playbackSpeed}x Normal Speed",
                action = {
                    val speeds = listOf(0.75f, 1.0f, 1.25f, 1.5f)
                    val next = speeds[(speeds.indexOf(uiState.playbackSpeed) + 1).coerceIn(0, speeds.size - 1)]
                    TextButton(onClick = { viewModel.setPlaybackSpeed(next) }) {
                        Text("${uiState.playbackSpeed}x", color = PrimaryPurple, fontWeight = FontWeight.Bold)
                    }
                }
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Automation & Permissions Section
            SettingsSectionHeader(title = "Smart Scheduler Automation")

            SettingsRow(
                icon = Icons.Default.Alarm,
                title = "Exact Alarm Permission",
                subtitle = if (uiState.canScheduleExactAlarms) "Granted • Exact schedule triggers active" else "Not Granted • Tap to allow in System Settings",
                action = {
                    if (!uiState.canScheduleExactAlarms) {
                        IconButton(onClick = { viewModel.openExactAlarmSettings() }) {
                            Icon(
                                imageVector = Icons.Default.OpenInNew,
                                contentDescription = "Grant",
                                tint = AccentCyan
                            )
                        }
                    } else {
                        Text("Active", color = SecondaryGreen, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                }
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Privacy & Data
            SettingsSectionHeader(title = "Privacy & Storage")

            SettingsRow(
                icon = Icons.Default.DeleteSweep,
                title = "Clear Listening History",
                subtitle = "Reset your recently played tracks and listening statistics",
                action = {
                    TextButton(onClick = { showClearHistoryDialog = true }) {
                        Text("Clear", color = ErrorRed, fontWeight = FontWeight.Bold)
                    }
                }
            )

            Spacer(modifier = Modifier.height(20.dp))

            // About Section
            SettingsSectionHeader(title = "About")

            SettingsRow(
                icon = Icons.Default.Info,
                title = "SyncWave Music Player",
                subtitle = "Version 1.0.0 • Clean Architecture • Jetpack Compose • ExoPlayer",
                action = {}
            )

            Spacer(modifier = Modifier.height(90.dp))
        }

        if (showClearHistoryDialog) {
            AlertDialog(
                onDismissRequest = { showClearHistoryDialog = false },
                title = { Text("Clear History?", color = TextPrimaryDark) },
                text = { Text("This will permanently remove your listening records from the local database.", color = TextSecondaryDark) },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.clearListeningHistory()
                            showClearHistoryDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                    ) {
                        Text("Clear")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showClearHistoryDialog = false }) {
                        Text("Cancel", color = TextSecondaryDark)
                    }
                },
                containerColor = SurfaceDark
            )
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 80.dp)
        )
    }
}

@Composable
fun SettingsSectionHeader(title: String) {
    Text(
        text = title,
        color = PrimaryPurple,
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 1.sp,
        modifier = Modifier.padding(vertical = 8.dp)
    )
}

@Composable
fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    action: @Composable () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceDark)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(CardBackgroundDark),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = PrimaryPurple,
                modifier = Modifier.size(22.dp)
            )
        }

        Spacer(modifier = Modifier.width(14.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = TextPrimaryDark,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp
            )
            Text(
                text = subtitle,
                color = TextSecondaryDark,
                fontSize = 12.sp,
                lineHeight = 16.sp
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        action()
    }
}
