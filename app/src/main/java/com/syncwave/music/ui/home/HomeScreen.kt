package com.syncwave.music.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.ui.components.PlaylistCard
import com.syncwave.music.ui.components.SongListItem
import com.syncwave.music.ui.components.formatTimeDisplay
import com.syncwave.music.ui.theme.ActiveScheduleGradient
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.CardBackgroundDark
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SecondaryGreen
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark

@Composable
fun HomeScreen(
    onNavigateToScheduler: () -> Unit,
    onNavigateToPlaylist: (String) -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val playbackState by viewModel.playbackState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.scanMessage) {
        uiState.scanMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearScanMessage()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 90.dp)
        ) {
            // Header: Greeting and Scan Button
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 20.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = uiState.greeting,
                            color = TextPrimaryDark,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "SyncWave Music & Routines",
                            color = TextSecondaryDark,
                            fontSize = 13.sp
                        )
                    }

                    if (uiState.isScanning) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(32.dp),
                            color = PrimaryPurple,
                            strokeWidth = 3.dp
                        )
                    } else {
                        IconButton(
                            onClick = { viewModel.scanMusic() },
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(CardBackgroundDark)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Scan Music",
                                tint = PrimaryPurple
                            )
                        }
                    }
                }
            }

            // Upcoming Schedule Banner (Innovation Feature)
            if (uiState.nextSchedule != null) {
                item {
                    UpcomingScheduleBanner(
                        schedule = uiState.nextSchedule!!,
                        onClick = onNavigateToScheduler,
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)
                    )
                }
            }

            // Recently Played
            if (uiState.recentlyPlayed.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Recently Played",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                    )
                }
                items(uiState.recentlyPlayed) { song ->
                    SongListItem(
                        song = song,
                        isPlaying = playbackState.currentSong?.id == song.id && playbackState.isPlaying,
                        onClick = { viewModel.playSong(song, uiState.recentlyPlayed) },
                        onFavoriteToggle = { viewModel.toggleFavorite(song) },
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }
            }

            // Favorite Playlists
            if (uiState.favoritePlaylists.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Favorite Playlists",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp)
                    )
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(uiState.favoritePlaylists) { playlist ->
                            PlaylistCard(
                                playlist = playlist,
                                onClick = { onNavigateToPlaylist(playlist.id) }
                            )
                        }
                    }
                }
            }

            // Recently Added Local Tracks
            if (uiState.recentlyAdded.isNotEmpty()) {
                item {
                    SectionHeader(
                        title = "Recently Added Music",
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)
                    )
                }
                items(uiState.recentlyAdded) { song ->
                    SongListItem(
                        song = song,
                        isPlaying = playbackState.currentSong?.id == song.id && playbackState.isPlaying,
                        onClick = { viewModel.playSong(song, uiState.recentlyAdded) },
                        onFavoriteToggle = { viewModel.toggleFavorite(song) },
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }
            }
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
fun UpcomingScheduleBanner(
    schedule: MusicSchedule,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(ActiveScheduleGradient)
            .clickable(onClick = onClick)
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
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(BackgroundDark.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Alarm,
                        contentDescription = null,
                        tint = TextPrimaryDark,
                        modifier = Modifier.size(24.dp)
                    )
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column {
                    Text(
                        text = "NEXT SMART ROUTINE",
                        color = TextPrimaryDark.copy(alpha = 0.8f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = schedule.name,
                        color = TextPrimaryDark,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Starts at ${formatTimeDisplay(schedule.startTime)} • ${schedule.targetName}",
                        color = TextPrimaryDark.copy(alpha = 0.9f),
                        fontSize = 13.sp
                    )
                }
            }

            Icon(
                imageVector = Icons.Default.ArrowForward,
                contentDescription = "View",
                tint = TextPrimaryDark,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = title,
        color = TextPrimaryDark,
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
    )
}
