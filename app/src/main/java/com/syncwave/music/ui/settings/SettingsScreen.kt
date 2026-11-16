package com.syncwave.music.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.DeleteSweep
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
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
import com.syncwave.music.ui.theme.AccentAmber
import com.syncwave.music.ui.theme.AccentCyan
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.CardBackgroundDark
import com.syncwave.music.ui.theme.ErrorRed
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SecondaryGreen
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.SurfaceRaisedDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark

@Composable
fun SettingsScreen(
    onNavigateToOnboarding: () -> Unit = {},
    onNavigateToLogin: () -> Unit = {},
    onNavigateToSignUp: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val deviceSessionState by viewModel.deviceSessionState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showClearHistoryDialog by remember { mutableStateOf(false) }
    var activeProfileTab by remember { mutableStateOf(0) } // 0 = Overview, 1 = Settings
    var makeNextPickerDefault by remember { mutableStateOf(false) }

    val folderPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { uri ->
        uri?.let {
            val isDefault = makeNextPickerDefault || uiState.defaultFolderUri == null
            viewModel.addMusicFolder(it, makeDefault = isDefault)
        }
        makeNextPickerDefault = false
    }

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
                text = "Profile",
                color = TextPrimaryDark,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Account, listening insights, and settings",
                color = TextSecondaryDark,
                fontSize = 13.sp
            )

            Spacer(modifier = Modifier.height(14.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = activeProfileTab == 0,
                    onClick = { activeProfileTab = 0 },
                    label = { Text("Overview") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PrimaryPurple,
                        selectedLabelColor = TextPrimaryDark,
                        containerColor = SurfaceDark,
                        labelColor = TextSecondaryDark
                    )
                )
                FilterChip(
                    selected = activeProfileTab == 1,
                    onClick = { activeProfileTab = 1 },
                    label = { Text("Settings") },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PrimaryPurple,
                        selectedLabelColor = TextPrimaryDark,
                        containerColor = SurfaceDark,
                        labelColor = TextSecondaryDark
                    )
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            if (activeProfileTab == 0) {
            // Account & Authentication Section
            SettingsSectionHeader(title = "Account & Cloud Auth")

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(SurfaceDark)
                    .padding(14.dp)
            ) {
                if (uiState.isAuthenticated) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = uiState.authUserName ?: "SyncWave User",
                                color = TextPrimaryDark,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "${uiState.authUserEmail ?: ""} • ${uiState.authProvider ?: "EMAIL"}",
                                color = TextSecondaryDark,
                                fontSize = 12.sp
                            )
                        }
                        TextButton(onClick = { viewModel.signOut() }) {
                            Text("Sign out", color = ErrorRed, fontWeight = FontWeight.Bold)
                        }
                    }
                } else {
                    Text(
                        text = "Sign in with Google or email, password & 6-digit OTP to synchronize playlists and schedules.",
                        color = TextSecondaryDark,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
                            onClick = onNavigateToLogin,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = AccentAmber,
                                contentColor = androidx.compose.ui.graphics.Color.Black
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Sign in", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Button(
                            onClick = onNavigateToSignUp,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SurfaceRaisedDark,
                                contentColor = TextPrimaryDark
                            ),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Create account", fontWeight = FontWeight.Medium, fontSize = 12.sp)
                        }
                    }
                }
            }

            if (uiState.isAuthenticated && deviceSessionState.devices.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(SurfaceDark)
                        .padding(14.dp)
                ) {
                    Text(
                        text = "Active Playing Device",
                        color = TextPrimaryDark,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Audio plays on one selected device; other signed-in devices act as remotes.",
                        color = TextSecondaryDark,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    deviceSessionState.devices.forEach { device ->
                        val isActive = device.deviceId == deviceSessionState.activeDeviceId
                        val isSelf = device.deviceId == deviceSessionState.myDeviceId
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isActive) AccentAmber.copy(alpha = 0.14f) else SurfaceRaisedDark)
                                .clickable {
                                    if (!isActive) viewModel.transferPlaybackToDevice(device.deviceId)
                                }
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (isSelf) "${device.deviceName} (This device)" else device.deviceName,
                                color = TextPrimaryDark,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = if (isActive) "Playing" else "Switch",
                                color = if (isActive) AccentAmber else TextSecondaryDark,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
            }

            if (activeProfileTab == 1) {
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
                                imageVector = Icons.AutoMirrored.Filled.OpenInNew,
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

            // AI Personalization & Language Preferences
            SettingsSectionHeader(title = "AI Personalization & Languages")

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(SurfaceDark)
                    .padding(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(CardBackgroundDark),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(imageVector = Icons.Default.Language, contentDescription = null, tint = SecondaryGreen)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text("Preferred Music Languages", color = TextPrimaryDark, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        Text("Select languages to prioritize on your Home screen", color = TextSecondaryDark, fontSize = 12.sp)
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                val availableLangs = listOf("Tamil", "Telugu", "Hindi", "Malayalam", "Kannada", "Punjabi", "Bengali", "English")
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(availableLangs) { lang ->
                        val isSelected = uiState.preferredLanguages.contains(lang)
                        FilterChip(
                            selected = isSelected,
                            onClick = { viewModel.toggleLanguage(lang) },
                            label = { Text(lang, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = SecondaryGreen.copy(alpha = 0.2f),
                                selectedLabelColor = SecondaryGreen
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Button(
                    onClick = onNavigateToOnboarding,
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = CardBackgroundDark,
                        contentColor = TextPrimaryDark
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = SecondaryGreen, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Configure Artists Preferences", fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Reset Personalization & Scores", color = TextSecondaryDark, fontSize = 12.sp)
                    TextButton(onClick = { viewModel.resetPersonalization() }) {
                        Text("Reset", color = PrimaryPurple, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            }

            if (activeProfileTab == 0) {
            // Profile & Listening Stats
            SettingsSectionHeader(title = "Listener Profile & Stats")

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceDark)
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(PrimaryPurple.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Person, contentDescription = null, tint = PrimaryPurple, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("Your Listening Insights", color = TextPrimaryDark, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text("Your personal listening insights", color = TextSecondaryDark, fontSize = 11.sp)
                        }
                    }
                    IconButton(onClick = { viewModel.loadProfileStats() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh Stats", tint = SecondaryGreen, modifier = Modifier.size(18.dp))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                val profileStats = uiState.profileStats
                val favArtist = profileStats?.favouriteArtist?.name ?: "Not configured"
                val mostListened = profileStats?.mostListenedArtist?.name ?: "No plays yet"
                val mostListenedPlays = profileStats?.mostListenedArtist?.playCount ?: 0

                // Favourite Artist & Most Listened Artist Rows
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(CardBackgroundDark)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.Favorite, contentDescription = null, tint = PrimaryPurple, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("FAVOURITE ARTIST", color = TextSecondaryDark, fontSize = 10.sp)
                            Text(favArtist, color = TextPrimaryDark, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(CardBackgroundDark)
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Default.Star, contentDescription = null, tint = SecondaryGreen, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text("MOST LISTENED ARTIST", color = TextSecondaryDark, fontSize = 10.sp)
                            Text(mostListened, color = TextPrimaryDark, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        }
                    }
                    if (mostListenedPlays > 0) {
                        Text("$mostListenedPlays plays", color = SecondaryGreen, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Repeat, contentDescription = null, tint = PrimaryPurple, modifier = Modifier.size(15.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("MOST REWATCHED SONGS", color = TextSecondaryDark, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(6.dp))

                val rewatchedList = profileStats?.mostRewatchedSongs?.take(5) ?: emptyList()
                if (rewatchedList.isEmpty()) {
                    Text(
                        "Play songs multiple times to see top rewatched counts here.",
                        color = TextSecondaryDark,
                        fontSize = 11.sp
                    )
                } else {
                    rewatchedList.forEachIndexed { idx, track ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "#${idx + 1} ${track.title}",
                                    color = TextPrimaryDark,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(track.artist, color = TextSecondaryDark, fontSize = 11.sp)
                            }
                            Text(
                                "${track.playCount} plays (${track.rewatchCount} rew.)",
                                color = PrimaryPurple,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
            }

            if (activeProfileTab == 1) {
            // Local Music Folders
            SettingsSectionHeader(title = "Local Music Folders")

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CardBackgroundDark, RoundedCornerShape(14.dp))
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Persistent SAF music folders & auto-sync",
                        color = TextSecondaryDark,
                        fontSize = 12.sp,
                        modifier = Modifier.weight(1f)
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedButton(
                            onClick = { viewModel.scanLocalMusic() },
                            enabled = !uiState.isScanningFolders,
                            shape = RoundedCornerShape(8.dp),
                            border = BorderStroke(1.dp, TextTertiaryDark.copy(alpha = 0.4f)),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            if (uiState.isScanningFolders) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(14.dp),
                                    strokeWidth = 2.dp,
                                    color = PrimaryPurple
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Refresh,
                                    contentDescription = "Sync Folders",
                                    tint = TextPrimaryDark,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Sync", fontSize = 11.sp, color = TextPrimaryDark)
                        }

                        Button(
                            onClick = {
                                makeNextPickerDefault = uiState.defaultFolderUri == null
                                folderPickerLauncher.launch(null)
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.CreateNewFolder,
                                contentDescription = "Add Music Folder",
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Add Folder", fontSize = 11.sp)
                        }
                    }
                }

                if (uiState.localFolders.isEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceDark, RoundedCornerShape(10.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "No default music folder selected",
                                color = TextPrimaryDark,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "Select a local folder to remember permissions and scan automatically",
                                color = TextTertiaryDark,
                                fontSize = 11.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        TextButton(onClick = {
                            makeNextPickerDefault = true
                            folderPickerLauncher.launch(null)
                        }) {
                            Text("Set Default", color = PrimaryPurple, fontSize = 12.sp)
                        }
                    }
                } else {
                    uiState.localFolders.forEach { folder ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(SurfaceDark, RoundedCornerShape(10.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Default.FolderOpen,
                                contentDescription = null,
                                tint = if (folder.isDefault) SecondaryGreen else PrimaryPurple,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = folder.name,
                                        color = TextPrimaryDark,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1
                                    )
                                    if (folder.isDefault) {
                                        Text(
                                            text = "Default",
                                            color = SecondaryGreen,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            modifier = Modifier
                                                .background(
                                                    SecondaryGreen.copy(alpha = 0.16f),
                                                    RoundedCornerShape(4.dp)
                                                )
                                                .padding(horizontal = 5.dp, vertical = 1.dp)
                                        )
                                    }
                                }
                                Text(
                                    text = folder.uri,
                                    color = TextTertiaryDark,
                                    fontSize = 10.sp,
                                    maxLines = 1
                                )
                            }

                            if (!folder.isDefault) {
                                TextButton(onClick = { viewModel.setDefaultMusicFolder(folder.uri) }) {
                                    Text("Set Default", color = PrimaryPurple, fontSize = 11.sp)
                                }
                            } else {
                                TextButton(onClick = {
                                    makeNextPickerDefault = true
                                    folderPickerLauncher.launch(null)
                                }) {
                                    Text("Change", color = TextSecondaryDark, fontSize = 11.sp)
                                }
                            }

                            IconButton(
                                onClick = { viewModel.removeMusicFolder(folder.uri) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.DeleteOutline,
                                    contentDescription = "Remove Folder",
                                    tint = TextTertiaryDark,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Privacy & Data
            SettingsSectionHeader(title = "Privacy & Storage Policy")

            SettingsRow(
                icon = Icons.Default.Info,
                title = "Downloads: Local Device Only",
                subtitle = "All downloaded audio stays strictly on your local device.",
                action = {}
            )

            Spacer(modifier = Modifier.height(8.dp))

            SettingsRow(
                icon = Icons.Default.DeleteSweep,
                title = "Clear Listening History",
                subtitle = "Clear your synced playback history",
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
            }

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

