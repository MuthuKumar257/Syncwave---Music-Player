package com.syncwave.music.ui.discover

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.data.remote.MovieSoundtrackDto
import com.syncwave.music.data.remote.SearchSuggestionDto
import com.syncwave.music.data.remote.UnifiedTrackDto
import com.syncwave.music.ui.components.ArtworkImage
import com.syncwave.music.ui.components.BadgeChip
import com.syncwave.music.ui.components.SongListItem
import com.syncwave.music.ui.theme.AccentAmber
import com.syncwave.music.ui.theme.AccentCyan
import com.syncwave.music.ui.theme.AccentPink
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.CardBackgroundDark
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SecondaryGreen
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark

private val INDIAN_LANGUAGES = listOf(
    "ALL" to "All Languages",
    "TAMIL" to "Tamil",
    "TELUGU" to "Telugu",
    "HINDI" to "Hindi",
    "MALAYALAM" to "Malayalam",
    "KANNADA" to "Kannada",
    "PUNJABI" to "Punjabi",
    "BENGALI" to "Bengali",
    "ENGLISH" to "English"
)

private val TRENDING_SEARCHES = listOf(
    "Love Songs",
    "Melody Songs",
    "Party Songs",
    "Workout Songs",
    "Sad Songs",
    "Rain Songs",
    "Vaaranam Aayiram",
    "A.R. Rahman",
    "Leo",
    "Naa Ready"
)

@Composable
fun DiscoverScreen(
    viewModel: DiscoverViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val playbackState by viewModel.playbackState.collectAsStateWithLifecycle()
    val downloadingTrackIds by viewModel.downloadingTrackIds.collectAsStateWithLifecycle()
    val downloadedTrackIds by viewModel.downloadedTrackIds.collectAsStateWithLifecycle()
    val downloadMessage by viewModel.downloadMessage.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(downloadMessage) {
        downloadMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearDownloadMessage()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
        // Top Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 14.dp)
        ) {
            Text(
                text = "Universal Music Search",
                color = TextPrimaryDark,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Search movies, songs, composers & singers across languages and soundtracks",
                color = TextSecondaryDark,
                fontSize = 12.sp
            )
        }

        // Search Input Bar
        OutlinedTextField(
            value = uiState.query,
            onValueChange = { viewModel.setQuery(it) },
            placeholder = { Text("Search movie, song, composer, singer...", color = TextTertiaryDark, fontSize = 14.sp) },
            leadingIcon = {
                Icon(imageVector = Icons.Default.Search, contentDescription = null, tint = TextTertiaryDark)
            },
            trailingIcon = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (uiState.isSearching) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = PrimaryPurple
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    if (uiState.query.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setQuery("") }) {
                            Icon(imageVector = Icons.Default.Clear, contentDescription = "Clear", tint = TextTertiaryDark)
                        }
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

        // Autocomplete suggestions dropdown if available
        AnimatedVisibility(visible = uiState.suggestions.isNotEmpty()) {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(uiState.suggestions) { suggestion ->
                    SuggestionChip(
                        onClick = { viewModel.setQuery(suggestion.text) },
                        label = {
                            Column {
                                Text(suggestion.text, color = TextPrimaryDark, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                Text(suggestion.subtitle, color = TextTertiaryDark, fontSize = 10.sp)
                            }
                        },
                        colors = SuggestionChipDefaults.suggestionChipColors(
                            containerColor = CardBackgroundDark
                        ),
                        border = SuggestionChipDefaults.suggestionChipBorder(
                            enabled = true,
                            borderColor = PrimaryPurple.copy(alpha = 0.3f)
                        )
                    )
                }
            }
        }

        // Search Category Filters (All, Movies, Songs, Artists, Videos)
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(SearchTypeFilter.values()) { type ->
                FilterChip(
                    selected = uiState.activeType == type,
                    onClick = { viewModel.setType(type) },
                    label = { Text(type.label, fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = PrimaryPurple,
                        selectedLabelColor = TextPrimaryDark,
                        containerColor = SurfaceDark,
                        labelColor = TextSecondaryDark
                    )
                )
            }
        }

        // Language Filters (Indian Cinema & Global)
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(INDIAN_LANGUAGES) { (code, label) ->
                val isSelected = uiState.activeLanguage == code
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(20.dp))
                        .background(if (isSelected) SecondaryGreen.copy(alpha = 0.2f) else SurfaceDark)
                        .border(
                            width = 1.dp,
                            color = if (isSelected) SecondaryGreen else Color.Transparent,
                            shape = RoundedCornerShape(20.dp)
                        )
                        .clickable { viewModel.setLanguage(code) }
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = label,
                        color = if (isSelected) SecondaryGreen else TextSecondaryDark,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }

        // Results Container
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Trending Quick Search Tags when query is blank
            if (uiState.query.isBlank()) {
                item {
                    Column(modifier = Modifier.padding(vertical = 4.dp)) {
                        Text(
                            text = "Trending Indian Cinema & Soundtracks",
                            color = TextPrimaryDark,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(TRENDING_SEARCHES) { trending ->
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(SurfaceDark)
                                        .clickable { viewModel.setQuery(trending) }
                                        .padding(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text(
                                        text = trending,
                                        color = TextPrimaryDark,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Search Error Card with Retry
            if (!uiState.isSearching && !uiState.searchError.isNullOrBlank()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFF2B1720))
                            .border(1.dp, Color(0xFFF87171).copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                            .padding(14.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = Color(0xFFF87171),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = uiState.searchError ?: "Search failed",
                                color = TextPrimaryDark,
                                fontSize = 13.sp,
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Button(
                            onClick = { viewModel.retrySearch() },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Retry Search", fontSize = 12.sp)
                        }
                    }
                }
            }

            // Movie Soundtracks Section
            if (uiState.movies.isNotEmpty()) {
                item {
                    Text(
                        text = "Movie Soundtracks (${uiState.movies.size})",
                        color = TextPrimaryDark,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                    )
                }

                items(uiState.movies) { movie ->
                    MovieSoundtrackCard(
                        soundtrack = movie,
                        onPlayAll = { viewModel.playSoundtrack(movie) },
                        onTrackClick = { viewModel.playUnifiedTrack(it) },
                        onOpenUrl = { viewModel.openSourceUrl(it) },
                        onDownloadTrack = { viewModel.downloadTrack(it) },
                        downloadingTrackIds = downloadingTrackIds,
                        downloadedTrackIds = downloadedTrackIds
                    )
                }
            }

            // Unified Song Versions Section
            if (uiState.songs.isNotEmpty()) {
                item {
                    Text(
                        text = "Songs & Versions (${uiState.songs.size})",
                        color = TextPrimaryDark,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 10.dp, bottom = 4.dp)
                    )
                }

                items(uiState.songs) { track ->
                    UnifiedSongVersionItem(
                        track = track,
                        onPlay = { viewModel.playUnifiedTrack(track) },
                        onOpenUrl = { viewModel.openSourceUrl(track.sourceUrl) },
                        onDownload = { viewModel.downloadTrack(track) },
                        isDownloading = downloadingTrackIds.contains(track.id),
                        isDownloaded = downloadedTrackIds.contains(track.id)
                    )
                }
            }

            // Local Library Results (if any)
            if (uiState.localResults.isNotEmpty()) {
                item {
                    Text(
                        text = "Local Library Results",
                        color = TextPrimaryDark,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
                items(uiState.localResults) { song ->
                    SongListItem(
                        song = song,
                        isPlaying = playbackState.currentSong?.id == song.id && playbackState.isPlaying,
                        onClick = { viewModel.playLocalSong(song) },
                        onFavoriteToggle = {}
                    )
                }
            }

            // Empty state notice
            if (!uiState.isSearching && uiState.movies.isEmpty() && uiState.songs.isEmpty() && uiState.query.isNotBlank()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Default.Search,
                            contentDescription = null,
                            tint = TextTertiaryDark,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "No results found for \"${uiState.query}\"",
                            color = TextPrimaryDark,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Try searching by song name, movie, singer, or composer in English or native script.",
                            color = TextSecondaryDark,
                            fontSize = 13.sp
                        )
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(90.dp)) }
        }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 84.dp)
        )
    }
}

@Composable
fun MovieSoundtrackCard(
    soundtrack: MovieSoundtrackDto,
    onPlayAll: () -> Unit,
    onTrackClick: (UnifiedTrackDto) -> Unit,
    onOpenUrl: (String) -> Unit,
    onDownloadTrack: (UnifiedTrackDto) -> Unit = {},
    downloadingTrackIds: Set<String> = emptySet(),
    downloadedTrackIds: Set<String> = emptySet()
) {
    var isExpanded by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceDark)
            .border(1.dp, PrimaryPurple.copy(alpha = 0.2f), RoundedCornerShape(16.dp))
            .padding(16.dp)
    ) {
        // Movie Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ArtworkImage(
                artworkUri = soundtrack.artworkUrl,
                size = 72.dp,
                cornerRadius = 12.dp
            )

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = soundtrack.movieName,
                        color = TextPrimaryDark,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (soundtrack.releaseYear != null) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "(${soundtrack.releaseYear})",
                            color = TextTertiaryDark,
                            fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Music: ${soundtrack.composer}",
                    color = PrimaryPurple,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BadgeChip(
                        text = soundtrack.language,
                        backgroundColor = SecondaryGreen.copy(alpha = 0.2f),
                        textColor = SecondaryGreen
                    )
                    BadgeChip(
                        text = "${soundtrack.totalTracks} Tracks",
                        backgroundColor = CardBackgroundDark,
                        textColor = TextSecondaryDark
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Play All Button & Toggle
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(
                onClick = onPlayAll,
                colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = TextPrimaryDark
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Play All Soundtrack", fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            Text(
                text = if (isExpanded) "Hide Tracks" else "Show Tracks (${soundtrack.tracks.size})",
                color = AccentCyan,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .clickable { isExpanded = !isExpanded }
                    .padding(8.dp)
            )
        }

        // Soundtrack Track Listing
        AnimatedVisibility(visible = isExpanded) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                HorizontalDivider(color = CardBackgroundDark, thickness = 1.dp)

                soundtrack.tracks.forEachIndexed { index, track ->
                    SoundtrackTrackRow(
                        trackNumber = index + 1,
                        track = track,
                        onPlay = { onTrackClick(track) },
                        onOpen = { onOpenUrl(track.sourceUrl) },
                        onDownload = { onDownloadTrack(track) },
                        isDownloading = downloadingTrackIds.contains(track.id),
                        isDownloaded = downloadedTrackIds.contains(track.id)
                    )
                }
            }
        }
    }
}

@Composable
fun SoundtrackTrackRow(
    trackNumber: Int,
    track: UnifiedTrackDto,
    onPlay: () -> Unit,
    onOpen: () -> Unit,
    onDownload: () -> Unit = {},
    isDownloading: Boolean = false,
    isDownloaded: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onPlay)
            .padding(vertical = 8.dp, horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "$trackNumber",
            color = TextTertiaryDark,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.width(24.dp)
        )

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                color = TextPrimaryDark,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            val singerText = if (!track.singers.isNullOrEmpty()) {
                track.singers.joinToString(", ")
            } else {
                track.artist
            }

            Text(
                text = singerText,
                color = TextSecondaryDark,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        if (!track.downloadAvailability.isNullOrBlank()) {
            DownloadAvailabilityBadge(availability = track.downloadAvailability)
            Spacer(modifier = Modifier.width(6.dp))
        }

        Text(
            text = formatDuration(track.durationMs),
            color = TextTertiaryDark,
            fontSize = 11.sp
        )

        Spacer(modifier = Modifier.width(6.dp))

        IconButton(
            onClick = { onDownload() },
            enabled = !isDownloading,
            modifier = Modifier.size(32.dp)
        ) {
            when {
                isDownloading -> CircularProgressIndicator(
                    modifier = Modifier.size(15.dp),
                    strokeWidth = 2.dp,
                    color = PrimaryPurple
                )
                isDownloaded -> Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Saved to Songs folder",
                    tint = SecondaryGreen,
                    modifier = Modifier.size(18.dp)
                )
                else -> Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = "Save to Songs folder",
                    tint = PrimaryPurple,
                    modifier = Modifier.size(18.dp)
                )
            }
        }

        IconButton(
            onClick = {
                if (track.isPlayableDirectly) onPlay() else onOpen()
            },
            modifier = Modifier.size(32.dp)
        ) {
            Icon(
                imageVector = if (track.isPlayableDirectly) Icons.Default.PlayArrow else Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = "Action",
                tint = if (track.isPlayableDirectly) SecondaryGreen else TextSecondaryDark,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
fun UnifiedSongVersionItem(
    track: UnifiedTrackDto,
    onPlay: () -> Unit,
    onOpenUrl: () -> Unit,
    onDownload: () -> Unit = {},
    isDownloading: Boolean = false,
    isDownloaded: Boolean = false
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceDark)
            .clickable(onClick = onPlay)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ArtworkImage(
            artworkUri = track.artworkUrl,
            size = 52.dp,
            cornerRadius = 10.dp
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                color = TextPrimaryDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = "${track.artist} • ${track.movieName ?: track.album ?: "Soundtrack"}",
                color = TextSecondaryDark,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Version badge
                VersionBadge(versionType = track.versionType)

                if (!track.downloadAvailability.isNullOrBlank()) {
                    DownloadAvailabilityBadge(availability = track.downloadAvailability)
                }
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        IconButton(
            onClick = { onDownload() },
            enabled = !isDownloading,
            modifier = Modifier.size(36.dp)
        ) {
            when {
                isDownloading -> CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = PrimaryPurple
                )
                isDownloaded -> Icon(
                    imageVector = Icons.Default.CheckCircle,
                    contentDescription = "Saved to Songs folder",
                    tint = SecondaryGreen,
                    modifier = Modifier.size(20.dp)
                )
                else -> Icon(
                    imageVector = Icons.Default.Download,
                    contentDescription = "Save to Songs folder",
                    tint = PrimaryPurple,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        IconButton(
            onClick = {
                if (track.isPlayableDirectly) onPlay() else onOpenUrl()
            },
            modifier = Modifier.size(36.dp)
        ) {
            Icon(
                imageVector = if (track.isPlayableDirectly) Icons.Default.PlayArrow else Icons.AutoMirrored.Filled.OpenInNew,
                contentDescription = "Play or open",
                tint = if (track.isPlayableDirectly) SecondaryGreen else TextTertiaryDark,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun VersionBadge(versionType: String) {
    val (label, bg, fg) = when (versionType.uppercase()) {
        "ORIGINAL" -> Triple("Original", SecondaryGreen.copy(alpha = 0.2f), SecondaryGreen)
        "OFFICIAL_VIDEO" -> Triple("Music Video", AccentPink.copy(alpha = 0.2f), AccentPink)
        "LIVE" -> Triple("Live", AccentAmber.copy(alpha = 0.2f), AccentAmber)
        "COVER" -> Triple("Cover", PrimaryPurple.copy(alpha = 0.2f), PrimaryPurple)
        "REMIX" -> Triple("Remix", AccentCyan.copy(alpha = 0.2f), AccentCyan)
        "INSTRUMENTAL" -> Triple("Instrumental", CardBackgroundDark, TextSecondaryDark)
        else -> Triple(versionType, CardBackgroundDark, TextSecondaryDark)
    }

    BadgeChip(
        text = label,
        backgroundColor = bg,
        textColor = fg
    )
}

@Composable
fun PlatformBadge(platform: String) {
    // Platform tags intentionally removed for unified player experience
}

@Composable
fun DownloadAvailabilityBadge(availability: String) {
    val (label, bg, fg) = when (availability.uppercase()) {
        "FULL" -> Triple("Full Song", SecondaryGreen.copy(alpha = 0.2f), SecondaryGreen)
        "PREVIEW_ONLY" -> Triple("30s Preview Only", AccentAmber.copy(alpha = 0.2f), AccentAmber)
        "STREAM_ONLY" -> Triple("Stream Only", AccentPink.copy(alpha = 0.2f), AccentPink)
        else -> Triple("Unavailable", CardBackgroundDark, TextTertiaryDark)
    }

    BadgeChip(
        text = label,
        backgroundColor = bg,
        textColor = fg
    )
}

private fun formatDuration(ms: Long): String {
    if (ms <= 0) return "0:00"
    val totalSec = ms / 1000
    val min = totalSec / 60
    val sec = totalSec % 60
    return String.format("%02d:%02d", min, sec)
}
