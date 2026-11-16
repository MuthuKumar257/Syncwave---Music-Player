package com.syncwave.music.ui.library

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.repository.DownloadStatus
import com.syncwave.music.domain.repository.DownloadTaskInfo
import com.syncwave.music.ui.components.EmptyStateView
import com.syncwave.music.ui.components.PlaylistCard
import com.syncwave.music.ui.components.SongListItem
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

@Composable
fun LibraryScreen(
    onNavigateToPlaylist: (String) -> Unit,
    viewModel: LibraryViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val playbackState by viewModel.playbackState.collectAsStateWithLifecycle()
    val downloadTasksMap by viewModel.downloadTasks.collectAsStateWithLifecycle()
    val incompleteDownloadTasks = downloadTasksMap.values.filter { it.status != DownloadStatus.COMPLETED }
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    val requiredAudioPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Manifest.permission.READ_MEDIA_AUDIO
    } else {
        Manifest.permission.READ_EXTERNAL_STORAGE
    }
    var hasAudioPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, requiredAudioPermission) == PackageManager.PERMISSION_GRANTED
        )
    }

    val audioPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasAudioPermission = granted
        if (granted) {
            viewModel.scanMusic()
        }
    }

    var showCreatePlaylistDialog by remember { mutableStateOf(false) }
    var newPlaylistName by remember { mutableStateOf("") }
    var playlistToDelete by remember { mutableStateOf<Playlist?>(null) }

    val folderPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { treeUri ->
        treeUri?.let {
            viewModel.addMusicFolder(it, makeDefault = uiState.defaultFolderUri == null)
        }
    }

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
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Your Library",
                    color = TextPrimaryDark,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedButton(
                        onClick = { folderPickerLauncher.launch(null) },
                        shape = RoundedCornerShape(10.dp),
                        border = BorderStroke(1.dp, PrimaryPurple.copy(alpha = 0.6f)),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CreateNewFolder,
                            contentDescription = "Select Music Folder",
                            tint = PrimaryPurple,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Select Music Folder",
                            color = PrimaryPurple,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(modifier = Modifier.width(4.dp))

                    if (uiState.isScanning) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(22.dp),
                            color = PrimaryPurple,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }

                    IconButton(onClick = { viewModel.scanMusic() }) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Scan Storage",
                            tint = PrimaryPurple
                        )
                    }
                }
            }

            // Search Bar
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                placeholder = { Text("Search songs, artists, albums...", color = TextTertiaryDark) },
                leadingIcon = {
                    Icon(imageVector = Icons.Default.Search, contentDescription = null, tint = TextTertiaryDark)
                },
                trailingIcon = {
                    if (uiState.searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear", tint = TextTertiaryDark)
                        }
                    }
                },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 4.dp),
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

            Spacer(modifier = Modifier.height(10.dp))

            // Tabs
            ScrollableTabRow(
                selectedTabIndex = uiState.selectedTab.ordinal,
                containerColor = BackgroundDark,
                contentColor = PrimaryPurple,
                edgePadding = 20.dp,
                indicator = { tabPositions ->
                    TabRowDefaults.SecondaryIndicator(
                        Modifier.tabIndicatorOffset(tabPositions[uiState.selectedTab.ordinal]),
                        color = PrimaryPurple,
                        height = 3.dp
                    )
                },
                divider = {}
            ) {
                LibraryTab.values().forEach { tab ->
                    Tab(
                        selected = uiState.selectedTab == tab,
                        onClick = { viewModel.setTab(tab) },
                        text = {
                            Text(
                                text = tab.title,
                                color = if (uiState.selectedTab == tab) PrimaryPurple else TextSecondaryDark,
                                fontWeight = if (uiState.selectedTab == tab) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 14.sp
                            )
                        }
                    )
                }
            }

            // Tab Content
            when (uiState.selectedTab) {
                LibraryTab.SONGS -> {
                    LazyRow(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(LibrarySourceFilter.values()) { filter ->
                            val selected = uiState.sourceFilter == filter
                            FilterChip(
                                selected = selected,
                                onClick = { viewModel.setSourceFilter(filter) },
                                label = {
                                    Text(
                                        text = if (filter == LibrarySourceFilter.FOLDERS && uiState.musicFolderCount > 0) {
                                            "${filter.label} (${uiState.musicFolderCount})"
                                        } else {
                                            filter.label
                                        },
                                        fontSize = 12.sp
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PrimaryPurple.copy(alpha = 0.22f),
                                    selectedLabelColor = PrimaryPurple,
                                    labelColor = TextSecondaryDark
                                )
                            )
                        }
                    }

                    if (incompleteDownloadTasks.isNotEmpty()) {
                        DownloadQueueSection(
                            tasks = incompleteDownloadTasks,
                            onPause = { viewModel.pauseDownload(it) },
                            onResume = { viewModel.resumeDownload(it) },
                            onCancel = { viewModel.cancelDownload(it) }
                        )
                    }

                    if (!hasAudioPermission) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF2B2317))
                                .border(1.dp, AccentAmber.copy(alpha = 0.45f), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Text(
                                text = "Audio storage permission is not granted. You can still browse folders using \"Select Music Folder\" or grant permission to scan device music.",
                                color = TextPrimaryDark,
                                fontSize = 12.sp
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { audioPermissionLauncher.launch(requiredAudioPermission) },
                                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                                ) {
                                    Text("Grant Permission", fontSize = 12.sp)
                                }
                                OutlinedButton(
                                    onClick = {
                                        val intent = Intent(
                                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                                            Uri.fromParts("package", context.packageName, null)
                                        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        context.startActivity(intent)
                                    }
                                ) {
                                    Text("App Settings", color = TextPrimaryDark, fontSize = 12.sp)
                                }
                            }
                        }
                    }

                    if (uiState.songs.isEmpty()) {
                        EmptyStateView(
                            icon = Icons.Default.LibraryMusic,
                            title = "No songs found",
                            subtitle = "Scan your device storage, download songs, or select a local music folder",
                            actionButtonText = if (uiState.sourceFilter == LibrarySourceFilter.FOLDERS) "Select Music Folder" else "Scan Storage",
                            onActionClick = {
                                if (uiState.sourceFilter == LibrarySourceFilter.FOLDERS) {
                                    folderPickerLauncher.launch(null)
                                } else {
                                    viewModel.scanMusic()
                                }
                            }
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            items(uiState.songs, key = { it.id }) { song ->
                                SongListItem(
                                    song = song,
                                    isPlaying = playbackState.currentSong?.id == song.id && playbackState.isPlaying,
                                    onClick = { viewModel.playSong(song, uiState.songs) },
                                    onFavoriteToggle = { viewModel.toggleFavorite(song) }
                                )
                            }
                            item { Spacer(modifier = Modifier.height(80.dp)) }
                        }
                    }
                }

                LibraryTab.PLAYLISTS -> {
                    if (uiState.playlists.isEmpty()) {
                        EmptyStateView(
                            icon = Icons.Default.QueueMusic,
                            title = "No playlists yet",
                            subtitle = "Create custom playlists to organise your routines and favourites",
                            actionButtonText = "Create Playlist",
                            onActionClick = { showCreatePlaylistDialog = true }
                        )
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Adaptive(minSize = 150.dp),
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(uiState.playlists, key = { it.id }) { playlist ->
                                PlaylistCard(
                                    playlist = playlist,
                                    onClick = { onNavigateToPlaylist(playlist.id) },
                                    onDeleteClick = { playlistToDelete = playlist },
                                    cardWidth = 160.dp
                                )
                            }
                        }
                    }
                }

                LibraryTab.ALBUMS -> {
                    if (uiState.albums.isEmpty()) {
                        EmptyStateView(
                            icon = Icons.Default.Album,
                            title = "No albums found",
                            subtitle = "Albums will automatically appear once songs are indexed",
                            actionButtonText = "Scan Storage",
                            onActionClick = { viewModel.scanMusic() }
                        )
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Adaptive(minSize = 150.dp),
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(14.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(uiState.albums) { album ->
                                Column(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(CardBackgroundDark)
                                        .padding(8.dp)
                                ) {
                                    com.syncwave.music.ui.components.ArtworkImage(
                                        artworkUri = album.artworkUri,
                                        size = 140.dp,
                                        cornerRadius = 10.dp
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = album.title,
                                        color = TextPrimaryDark,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 14.sp,
                                        maxLines = 1
                                    )
                                    Text(
                                        text = "${album.artist} • ${album.songCount} songs",
                                        color = TextSecondaryDark,
                                        fontSize = 12.sp,
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }

                LibraryTab.ARTISTS -> {
                    if (uiState.artists.isEmpty()) {
                        EmptyStateView(
                            icon = Icons.Default.Person,
                            title = "No artists found",
                            subtitle = "Artists will appear after indexing audio metadata",
                            actionButtonText = "Scan Storage",
                            onActionClick = { viewModel.scanMusic() }
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                        ) {
                            items(uiState.artists) { artist ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(50.dp)
                                            .clip(RoundedCornerShape(25.dp))
                                            .background(SurfaceDark),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Person,
                                            contentDescription = null,
                                            tint = PrimaryPurple
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(14.dp))
                                    Column {
                                        Text(
                                            text = artist.name,
                                            color = TextPrimaryDark,
                                            fontWeight = FontWeight.SemiBold,
                                            fontSize = 16.sp
                                        )
                                        Text(
                                            text = "${artist.songCount} songs • ${artist.albumCount} albums",
                                            color = TextSecondaryDark,
                                            fontSize = 13.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                LibraryTab.FAVORITES -> {
                    if (uiState.favoriteSongs.isEmpty()) {
                        EmptyStateView(
                            icon = Icons.Default.Favorite,
                            title = "No favorites yet",
                            subtitle = "Tap the heart icon on any song to add it to your favourites list"
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            items(uiState.favoriteSongs, key = { it.id }) { song ->
                                SongListItem(
                                    song = song,
                                    isPlaying = playbackState.currentSong?.id == song.id && playbackState.isPlaying,
                                    onClick = { viewModel.playSong(song, uiState.favoriteSongs) },
                                    onFavoriteToggle = { viewModel.toggleFavorite(song) }
                                )
                            }
                            item { Spacer(modifier = Modifier.height(80.dp)) }
                        }
                    }
                }
            }
        }

        // Floating Action Button for Create Playlist when on Playlists tab
        if (uiState.selectedTab == LibraryTab.PLAYLISTS) {
            FloatingActionButton(
                onClick = { showCreatePlaylistDialog = true },
                containerColor = PrimaryPurple,
                contentColor = TextPrimaryDark,
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 20.dp, bottom = 90.dp)
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "Create Playlist")
            }
        }

        // Create Playlist Dialog
        if (showCreatePlaylistDialog) {
            AlertDialog(
                onDismissRequest = {
                    showCreatePlaylistDialog = false
                    newPlaylistName = ""
                },
                title = { Text("New Playlist", color = TextPrimaryDark) },
                text = {
                    OutlinedTextField(
                        value = newPlaylistName,
                        onValueChange = { newPlaylistName = it },
                        placeholder = { Text("Playlist Name e.g. Morning Focus") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = TextPrimaryDark,
                            unfocusedTextColor = TextPrimaryDark,
                            focusedBorderColor = PrimaryPurple
                        )
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (newPlaylistName.isNotBlank()) {
                                viewModel.createPlaylist(newPlaylistName)
                                showCreatePlaylistDialog = false
                                newPlaylistName = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                    ) {
                        Text("Create")
                    }
                },
                dismissButton = {
                    TextButton(onClick = {
                        showCreatePlaylistDialog = false
                        newPlaylistName = ""
                    }) {
                        Text("Cancel", color = TextSecondaryDark)
                    }
                },
                containerColor = SurfaceDark
            )
        }

        if (playlistToDelete != null) {
            AlertDialog(
                onDismissRequest = { playlistToDelete = null },
                title = { Text("Delete Playlist", color = TextPrimaryDark, fontWeight = FontWeight.Bold) },
                text = {
                    Text(
                        "Are you sure you want to delete '${playlistToDelete?.name}'? Songs in this playlist will remain safe in your library.",
                        color = TextSecondaryDark,
                        fontSize = 14.sp
                    )
                },
                confirmButton = {
                    Button(
                        onClick = {
                            playlistToDelete?.let { viewModel.deletePlaylist(it.id) }
                            playlistToDelete = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Delete", color = Color.White)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { playlistToDelete = null }) {
                        Text("Cancel", color = TextSecondaryDark)
                    }
                },
                containerColor = CardBackgroundDark,
                shape = RoundedCornerShape(14.dp)
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
private fun DownloadQueueSection(
    tasks: List<DownloadTaskInfo>,
    onPause: (String) -> Unit,
    onResume: (String) -> Unit,
    onCancel: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "Incomplete Downloads (${tasks.size} • Not Yet Playable)",
            color = AccentAmber,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold
        )
        tasks.forEach { task ->
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(CardBackgroundDark)
                    .padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = task.title,
                            color = TextPrimaryDark,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${task.artist} • ${task.status.name}",
                            color = TextSecondaryDark,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        when (task.status) {
                            DownloadStatus.DOWNLOADING -> {
                                TextButton(onClick = { onPause(task.trackId) }) {
                                    Text("Pause", color = AccentAmber, fontSize = 11.sp)
                                }
                            }
                            DownloadStatus.PAUSED, DownloadStatus.FAILED -> {
                                TextButton(onClick = { onResume(task.trackId) }) {
                                    Text(
                                        if (task.status == DownloadStatus.FAILED) "Retry" else "Resume",
                                        color = SecondaryGreen,
                                        fontSize = 11.sp
                                    )
                                }
                            }
                            else -> {}
                        }
                        IconButton(onClick = { onCancel(task.trackId) }, modifier = Modifier.size(28.dp)) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Cancel download",
                                tint = ErrorRed,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
                if (task.totalBytes > 0L) {
                    Spacer(modifier = Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { task.progressFraction },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = if (task.status == DownloadStatus.FAILED) ErrorRed else PrimaryPurple,
                        trackColor = SurfaceDark
                    )
                }
                if (!task.errorMessage.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = task.errorMessage,
                        color = ErrorRed,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}


