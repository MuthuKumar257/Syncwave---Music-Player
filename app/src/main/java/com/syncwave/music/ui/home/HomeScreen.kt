package com.syncwave.music.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.syncwave.music.data.remote.ArtistRecommendationCardDto
import com.syncwave.music.data.remote.MoodPlaylistCardDto
import com.syncwave.music.data.remote.UnifiedTrackDto
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.ui.components.ArtworkImage
import com.syncwave.music.ui.components.formatTimeDisplay
import com.syncwave.music.ui.theme.AccentAmber
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.HairlineDark
import com.syncwave.music.ui.theme.PrimaryStudio
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.SurfaceDeepest
import com.syncwave.music.ui.theme.SurfaceRaisedDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark

private sealed class SeeAllSheetPayload {
    data class Tracks(
        val title: String,
        val subtitle: String?,
        val items: List<UnifiedTrackDto>
    ) : SeeAllSheetPayload()

    data class Artists(
        val title: String,
        val subtitle: String?,
        val items: List<ArtistRecommendationCardDto>
    ) : SeeAllSheetPayload()

    data class Moods(
        val title: String,
        val subtitle: String?,
        val items: List<MoodPlaylistCardDto>
    ) : SeeAllSheetPayload()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNavigateToScheduler: () -> Unit,
    onNavigateToPlaylist: (String) -> Unit,
    onNavigateToOnboarding: () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val pullRefreshState = rememberPullToRefreshState()

    var seeAllSheet by remember { mutableStateOf<SeeAllSheetPayload?>(null) }
    var seeAllVisibleLimit by remember { mutableIntStateOf(12) }
    var selectedArtist by remember { mutableStateOf<ArtistRecommendationCardDto?>(null) }
    var selectedMood by remember { mutableStateOf<MoodPlaylistCardDto?>(null) }

    LaunchedEffect(uiState.scanMessage) {
        uiState.scanMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearScanMessage()
        }
    }

    val feed = uiState.personalizedFeed
    val recentlyPlayed = feed?.recentlyPlayed ?: emptyList()
    val madeForYou = feed?.madeForYou?.ifEmpty { feed.recommendedForYou } ?: emptyList()
    val favouriteArtists = feed?.favouriteArtists ?: emptyList()
    val recommendedSingers = feed?.recommendedSingers ?: emptyList()
    val recommendedDirectors = feed?.recommendedMusicDirectors ?: emptyList()
    val moodPlaylists = feed?.moodPlaylists ?: emptyList()
    val similarSongs = feed?.similarSongs ?: emptyList()
    val popularSongs = feed?.popularSongs ?: emptyList()
    val trendingSongs = feed?.trendingInLanguages ?: emptyList()
    val discoverSongs = feed?.discoverNewMusic?.ifEmpty { feed.discoverNew } ?: emptyList()

    val hasContent = recentlyPlayed.isNotEmpty() ||
        madeForYou.isNotEmpty() ||
        moodPlaylists.isNotEmpty() ||
        popularSongs.isNotEmpty()

    val activeLangSummary = uiState.userPreferences?.preferredLanguages
        ?.takeIf { it.isNotEmpty() }
        ?.joinToString(" • ")
        ?: feed?.preferredLanguages?.takeIf { it.isNotEmpty() }?.joinToString(" • ")
        ?: "Tamil • Telugu • Hindi"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundDark)
    ) {
        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = { viewModel.refreshHome() },
            state = pullRefreshState,
            indicator = {
                PullToRefreshDefaults.Indicator(
                    state = pullRefreshState,
                    isRefreshing = uiState.isRefreshing,
                    modifier = Modifier.align(Alignment.TopCenter),
                    containerColor = SurfaceRaisedDark,
                    color = PrimaryStudio
                )
            },
            modifier = Modifier.fillMaxSize()
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 12.dp, bottom = 100.dp),
                verticalArrangement = Arrangement.spacedBy(22.dp)
            ) {
                // Error notice banner (swipe down to retry; zero manual refresh buttons)
                uiState.feedError?.let { err ->
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(SurfaceDark)
                                .border(1.dp, AccentAmber.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.WifiOff,
                                contentDescription = null,
                                tint = AccentAmber,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = if (feed != null) {
                                    "Showing cached music ($err). Swipe down to retry."
                                } else {
                                    "Unable to reach server ($err). Swipe down to refresh."
                                },
                                color = TextSecondaryDark,
                                fontSize = 12.sp,
                                lineHeight = 16.sp
                            )
                        }
                    }
                }

                // 1. PERSONALIZED GREETING
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 4.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(50.dp))
                                .background(SurfaceDark)
                                .border(1.dp, HairlineDark, RoundedCornerShape(50.dp))
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = AccentAmber,
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = feed?.contextTitle?.ifBlank { "Personalised Radio" } ?: "Personalised Radio",
                                color = AccentAmber,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = uiState.greeting,
                                    color = TextPrimaryDark,
                                    fontSize = 25.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Spacer(modifier = Modifier.height(3.dp))
                                Text(
                                    text = "${feed?.contextDescription?.ifBlank { "Curated for your listening profile" } ?: "Curated for your listening profile"} • $activeLangSummary",
                                    color = TextTertiaryDark,
                                    fontSize = 12.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }

                            if (madeForYou.isNotEmpty()) {
                                Spacer(modifier = Modifier.width(12.dp))
                                Row(
                                    modifier = Modifier
                                        .height(38.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(PrimaryStudio)
                                        .clickable { viewModel.playUnifiedTracksAt(madeForYou, 0) }
                                        .padding(horizontal = 12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.PlayArrow,
                                        contentDescription = "Play Made For You",
                                        tint = BackgroundDark,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = "Play all",
                                        color = BackgroundDark,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }
                    }
                }

                if (uiState.isLoadingFeed && !hasContent) {
                    item { HomeSkeletonRows() }
                } else if (!hasContent) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 12.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(SurfaceDark)
                                .border(1.dp, HairlineDark, RoundedCornerShape(14.dp))
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.MusicNote,
                                contentDescription = null,
                                tint = TextTertiaryDark,
                                modifier = Modifier.size(28.dp)
                            )
                            Text(
                                text = "No recommendations available yet",
                                color = TextPrimaryDark,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium
                            )
                            Text(
                                text = "Swipe down from the top of the Home screen to refresh personalized mixes.",
                                color = TextTertiaryDark,
                                fontSize = 12.sp,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                } else {
                    // 2. RECENTLY PLAYED
                    if (recentlyPlayed.isNotEmpty()) {
                        item {
                            HorizontalTrackSection(
                                title = "Recently Played",
                                subtitle = "Jump back into songs from your sessions",
                                tracks = recentlyPlayed,
                                onPlayAt = { idx -> viewModel.playUnifiedTracksAt(recentlyPlayed, idx) },
                                onFeedback = { id, type -> viewModel.sendFeedback(id, type) },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Tracks(
                                        title = "Recently Played",
                                        subtitle = "Your recent listening history",
                                        items = recentlyPlayed
                                    )
                                }
                            )
                        }
                    }

                    // 3. MADE FOR YOU
                    if (madeForYou.isNotEmpty()) {
                        item {
                            HorizontalTrackSection(
                                title = "Made For You",
                                subtitle = "Tailored to your favourites, replays & taste profile",
                                tracks = madeForYou,
                                onPlayAt = { idx -> viewModel.playUnifiedTracksAt(madeForYou, idx) },
                                onFeedback = { id, type -> viewModel.sendFeedback(id, type) },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Tracks(
                                        title = "Made For You",
                                        subtitle = feed?.contextDescription,
                                        items = madeForYou
                                    )
                                }
                            )
                        }
                    }

                    // 4. FAVOURITE ARTISTS
                    if (favouriteArtists.isNotEmpty()) {
                        item {
                            HorizontalArtistSection(
                                title = "Favourite Artists",
                                subtitle = "Tap an artist for songs & albums",
                                artists = favouriteArtists,
                                onSelectArtist = { selectedArtist = it },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Artists(
                                        title = "Favourite Artists",
                                        subtitle = "Your favourite composers and vocalists",
                                        items = favouriteArtists
                                    )
                                }
                            )
                        }
                    }

                    // 5. RECOMMENDED SINGERS
                    if (recommendedSingers.isNotEmpty()) {
                        item {
                            HorizontalArtistSection(
                                title = "Recommended Singers",
                                subtitle = "Playback voices matched to your taste",
                                artists = recommendedSingers,
                                onSelectArtist = { selectedArtist = it },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Artists(
                                        title = "Recommended Singers",
                                        subtitle = "Singers popular in your preferred languages",
                                        items = recommendedSingers
                                    )
                                }
                            )
                        }
                    }

                    // 6. RECOMMENDED MUSIC DIRECTORS
                    if (recommendedDirectors.isNotEmpty()) {
                        item {
                            HorizontalArtistSection(
                                title = "Recommended Music Directors",
                                subtitle = "Composers & soundtracks in your style",
                                artists = recommendedDirectors,
                                onSelectArtist = { selectedArtist = it },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Artists(
                                        title = "Recommended Music Directors",
                                        subtitle = "Explore composer catalogs & albums",
                                        items = recommendedDirectors
                                    )
                                }
                            )
                        }
                    }

                    // 7. MOOD-BASED PLAYLISTS (All 12 Moods)
                    if (moodPlaylists.isNotEmpty()) {
                        item {
                            HorizontalMoodSection(
                                moods = moodPlaylists,
                                onSelectMood = { selectedMood = it },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Moods(
                                        title = "Mood-Based Playlists",
                                        subtitle = "All 12 curated mood mixes",
                                        items = moodPlaylists
                                    )
                                }
                            )
                        }
                    }

                    // 8. SIMILAR SONGS
                    if (similarSongs.isNotEmpty()) {
                        item {
                            HorizontalTrackSection(
                                title = "Similar Songs",
                                subtitle = "Inspired by movies & songs you replayed",
                                tracks = similarSongs,
                                onPlayAt = { idx -> viewModel.playUnifiedTracksAt(similarSongs, idx) },
                                onFeedback = { id, type -> viewModel.sendFeedback(id, type) },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Tracks(
                                        title = "Similar Songs",
                                        subtitle = "Matched by movie, composer & vocal style",
                                        items = similarSongs
                                    )
                                }
                            )
                        }
                    }

                    // 9. POPULAR SONGS
                    if (popularSongs.isNotEmpty()) {
                        item {
                            HorizontalTrackSection(
                                title = "Popular Songs",
                                subtitle = "Top hits from your favourite artists",
                                tracks = popularSongs,
                                onPlayAt = { idx -> viewModel.playUnifiedTracksAt(popularSongs, idx) },
                                onFeedback = { id, type -> viewModel.sendFeedback(id, type) },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Tracks(
                                        title = "Popular Songs",
                                        subtitle = "Most streamed cinema hits",
                                        items = popularSongs
                                    )
                                }
                            )
                        }
                    }

                    // 10. TRENDING IN SELECTED LANGUAGES
                    if (trendingSongs.isNotEmpty()) {
                        item {
                            HorizontalTrackSection(
                                title = "Trending in Selected Languages",
                                subtitle = activeLangSummary,
                                tracks = trendingSongs,
                                onPlayAt = { idx -> viewModel.playUnifiedTracksAt(trendingSongs, idx) },
                                onFeedback = { id, type -> viewModel.sendFeedback(id, type) },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Tracks(
                                        title = "Trending in Selected Languages",
                                        subtitle = activeLangSummary,
                                        items = trendingSongs
                                    )
                                }
                            )
                        }
                    }

                    // 11. DISCOVER NEW MUSIC
                    if (discoverSongs.isNotEmpty()) {
                        item {
                            HorizontalTrackSection(
                                title = "Discover New Music",
                                subtitle = "Fresh artists & hidden gems for you",
                                tracks = discoverSongs,
                                onPlayAt = { idx -> viewModel.playUnifiedTracksAt(discoverSongs, idx) },
                                onFeedback = { id, type -> viewModel.sendFeedback(id, type) },
                                onSeeAll = {
                                    seeAllVisibleLimit = 12
                                    seeAllSheet = SeeAllSheetPayload.Tracks(
                                        title = "Discover New Music",
                                        subtitle = "Explore outside your usual rotation",
                                        items = discoverSongs
                                    )
                                }
                            )
                        }
                    }
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 90.dp)
        )
    }

    // SEE ALL MODAL BOTTOM SHEET WITH PAGINATION
    seeAllSheet?.let { payload ->
        ModalBottomSheet(
            onDismissRequest = { seeAllSheet = null },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = SurfaceDark,
            contentColor = TextPrimaryDark
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 620.dp)
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        val title = when (payload) {
                            is SeeAllSheetPayload.Tracks -> payload.title
                            is SeeAllSheetPayload.Artists -> payload.title
                            is SeeAllSheetPayload.Moods -> payload.title
                        }
                        val sub = when (payload) {
                            is SeeAllSheetPayload.Tracks -> payload.subtitle
                            is SeeAllSheetPayload.Artists -> payload.subtitle
                            is SeeAllSheetPayload.Moods -> payload.subtitle
                        }
                        Text(title, color = TextPrimaryDark, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
                        if (!sub.isNullOrBlank()) {
                            Text(sub, color = TextTertiaryDark, fontSize = 12.sp)
                        }
                    }
                    if (payload is SeeAllSheetPayload.Tracks && payload.items.isNotEmpty()) {
                        Button(
                            onClick = { viewModel.playUnifiedTracksAt(payload.items, 0) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PrimaryStudio,
                                contentColor = BackgroundDark
                            ),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Play All", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                HorizontalDivider(color = HairlineDark)

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f, fill = false)
                ) {
                    when (payload) {
                        is SeeAllSheetPayload.Tracks -> {
                            val slice = payload.items.take(seeAllVisibleLimit)
                            itemsIndexed(slice) { idx, track ->
                                SheetTrackRow(
                                    index = idx,
                                    track = track,
                                    onClick = { viewModel.playUnifiedTracksAt(payload.items, idx) }
                                )
                            }
                            if (payload.items.size > seeAllVisibleLimit) {
                                item {
                                    LoadMoreSheetButton(
                                        remaining = payload.items.size - seeAllVisibleLimit,
                                        onClick = { seeAllVisibleLimit += 12 }
                                    )
                                }
                            }
                        }

                        is SeeAllSheetPayload.Artists -> {
                            val slice = payload.items.take(seeAllVisibleLimit)
                            items(slice, key = { it.id }) { artist ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(SurfaceRaisedDark)
                                        .clickable {
                                            seeAllSheet = null
                                            selectedArtist = artist
                                        }
                                        .padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    ArtworkImage(
                                        artworkUri = artist.imageUrl,
                                        size = 48.dp,
                                        cornerRadius = 24.dp
                                    )
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(artist.name, color = TextPrimaryDark, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                        Text(
                                            "${artist.roleTitle ?: artist.role} • ${artist.tracks.size} songs",
                                            color = TextTertiaryDark,
                                            fontSize = 12.sp
                                        )
                                    }
                                    Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = TextTertiaryDark, modifier = Modifier.size(16.dp))
                                }
                            }
                            if (payload.items.size > seeAllVisibleLimit) {
                                item {
                                    LoadMoreSheetButton(
                                        remaining = payload.items.size - seeAllVisibleLimit,
                                        onClick = { seeAllVisibleLimit += 12 }
                                    )
                                }
                            }
                        }

                        is SeeAllSheetPayload.Moods -> {
                            items(payload.items, key = { it.id }) { mood ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(SurfaceRaisedDark)
                                        .clickable {
                                            seeAllSheet = null
                                            selectedMood = mood
                                        }
                                        .padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    ArtworkImage(artworkUri = mood.artworkUrl, size = 52.dp, cornerRadius = 8.dp)
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text("${mood.mood} — ${mood.title}", color = TextPrimaryDark, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                        Text(mood.description, color = TextTertiaryDark, fontSize = 11.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    }
                                    Text("${mood.tracks.size}", color = AccentAmber, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ARTIST DETAIL MODAL BOTTOM SHEET (Songs + Albums)
    selectedArtist?.let { artist ->
        ModalBottomSheet(
            onDismissRequest = { selectedArtist = null },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = SurfaceDark,
            contentColor = TextPrimaryDark
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 640.dp)
                    .padding(horizontal = 20.dp),
                contentPadding = PaddingValues(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        ArtworkImage(artworkUri = artist.imageUrl, size = 68.dp, cornerRadius = 34.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = (artist.roleTitle ?: artist.role).uppercase(),
                                color = AccentAmber,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(artist.name, color = TextPrimaryDark, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                            Text(
                                "${artist.tracks.size} songs • ${artist.albums.size} albums",
                                color = TextTertiaryDark,
                                fontSize = 12.sp
                            )
                        }
                        if (artist.tracks.isNotEmpty()) {
                            Button(
                                onClick = { viewModel.playUnifiedTracksAt(artist.tracks, 0) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = PrimaryStudio,
                                    contentColor = BackgroundDark
                                ),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Play All", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }

                if (artist.albums.isNotEmpty()) {
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "ALBUMS & SOUNDTRACKS",
                                color = TextTertiaryDark,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                items(artist.albums, key = { it.id }) { album ->
                                    Column(
                                        modifier = Modifier
                                            .width(126.dp)
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(SurfaceRaisedDark)
                                            .border(1.dp, HairlineDark, RoundedCornerShape(10.dp))
                                            .clickable { viewModel.playUnifiedTracksAt(album.tracks, 0) }
                                            .padding(8.dp)
                                    ) {
                                        ArtworkImage(artworkUri = album.artworkUrl, size = 110.dp, cornerRadius = 6.dp)
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Text(album.name, color = TextPrimaryDark, fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("${album.releaseYear ?: "Album"} • ${album.tracks.size} tracks", color = TextTertiaryDark, fontSize = 10.sp)
                                    }
                                }
                            }
                        }
                    }
                }

                item {
                    Text(
                        "SONGS",
                        color = TextTertiaryDark,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                itemsIndexed(artist.tracks) { idx, track ->
                    SheetTrackRow(
                        index = idx,
                        track = track,
                        onClick = { viewModel.playUnifiedTracksAt(artist.tracks, idx) }
                    )
                }
            }
        }
    }

    // MOOD COLLECTION MODAL BOTTOM SHEET
    selectedMood?.let { mood ->
        ModalBottomSheet(
            onDismissRequest = { selectedMood = null },
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
            containerColor = SurfaceDark,
            contentColor = TextPrimaryDark
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 640.dp)
                    .padding(horizontal = 20.dp),
                contentPadding = PaddingValues(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        ArtworkImage(artworkUri = mood.artworkUrl, size = 68.dp, cornerRadius = 10.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(mood.mood.uppercase(), color = AccentAmber, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                            Text(mood.title, color = TextPrimaryDark, fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
                            Text(mood.description, color = TextTertiaryDark, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }

                if (mood.tracks.isNotEmpty()) {
                    item {
                        Button(
                            onClick = { viewModel.playUnifiedTracksAt(mood.tracks, 0) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PrimaryStudio,
                                contentColor = BackgroundDark
                            ),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Play All (${mood.tracks.size} songs)", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                itemsIndexed(mood.tracks) { idx, track ->
                    SheetTrackRow(
                        index = idx,
                        track = track,
                        onClick = { viewModel.playUnifiedTracksAt(mood.tracks, idx) }
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionTitleHeader(
    title: String,
    subtitle: String? = null,
    onSeeAll: (() -> Unit)? = null
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = TextPrimaryDark,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    text = subtitle,
                    color = TextTertiaryDark,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
        if (onSeeAll != null) {
            Text(
                text = "See All",
                color = AccentAmber,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(onClick = onSeeAll)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }
    }
}

@Composable
private fun HorizontalTrackSection(
    title: String,
    subtitle: String?,
    tracks: List<UnifiedTrackDto>,
    onPlayAt: (Int) -> Unit,
    onFeedback: (String, String) -> Unit,
    onSeeAll: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitleHeader(title = title, subtitle = subtitle, onSeeAll = onSeeAll)
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            itemsIndexed(tracks.take(12)) { idx, track ->
                PersonalizedTrackCard(
                    track = track,
                    onPlay = { onPlayAt(idx) },
                    onFeedback = { type -> onFeedback(track.id, type) }
                )
            }
        }
    }
}

@Composable
private fun HorizontalArtistSection(
    title: String,
    subtitle: String?,
    artists: List<ArtistRecommendationCardDto>,
    onSelectArtist: (ArtistRecommendationCardDto) -> Unit,
    onSeeAll: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitleHeader(title = title, subtitle = subtitle, onSeeAll = onSeeAll)
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(artists, key = { "${title}_${it.id}" }) { artist ->
                Column(
                    modifier = Modifier
                        .width(126.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(SurfaceDark)
                        .border(1.dp, HairlineDark, RoundedCornerShape(14.dp))
                        .clickable { onSelectArtist(artist) }
                        .padding(12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ArtworkImage(
                        artworkUri = artist.imageUrl,
                        size = 76.dp,
                        cornerRadius = 38.dp,
                        modifier = Modifier.clip(CircleShape)
                    )
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = artist.name,
                            color = TextPrimaryDark,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = artist.reason ?: artist.roleTitle ?: artist.role,
                            color = TextTertiaryDark,
                            fontSize = 10.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center
                        )
                        Text(
                            text = "${artist.tracks.size} songs",
                            color = AccentAmber,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HorizontalMoodSection(
    moods: List<MoodPlaylistCardDto>,
    onSelectMood: (MoodPlaylistCardDto) -> Unit,
    onSeeAll: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionTitleHeader(
            title = "Mood-Based Playlists",
            subtitle = "12 curated moods for every moment",
            onSeeAll = onSeeAll
        )
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(moods, key = { it.id }) { mood ->
                val badgeColor = remember(mood.accentColor) {
                    try {
                        Color(android.graphics.Color.parseColor(mood.accentColor))
                    } catch (_: Exception) {
                        AccentAmber
                    }
                }

                Column(
                    modifier = Modifier
                        .width(174.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(SurfaceDark)
                        .border(1.dp, HairlineDark, RoundedCornerShape(14.dp))
                        .clickable { onSelectMood(mood) }
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp)
                            .background(SurfaceRaisedDark)
                    ) {
                        ArtworkImage(
                            artworkUri = mood.artworkUrl,
                            size = 174.dp,
                            cornerRadius = 0.dp,
                            modifier = Modifier.fillMaxSize()
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f))
                                    )
                                )
                        )
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(8.dp)
                                .clip(RoundedCornerShape(50.dp))
                                .background(badgeColor)
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = mood.mood.uppercase(),
                                color = Color.Black,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Text(
                            text = mood.title,
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier
                                .align(Alignment.BottomStart)
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        )
                    }
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = mood.description,
                            color = TextTertiaryDark,
                            fontSize = 11.sp,
                            lineHeight = 14.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${mood.tracks.size} playable songs",
                            color = AccentAmber,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SheetTrackRow(
    index: Int,
    track: UnifiedTrackDto,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceRaisedDark)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "${index + 1}",
            color = TextTertiaryDark,
            fontSize = 12.sp,
            modifier = Modifier.width(22.dp),
            textAlign = TextAlign.Center
        )
        ArtworkImage(artworkUri = track.artworkUrl, size = 42.dp, cornerRadius = 6.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = track.title,
                color = TextPrimaryDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${track.singers?.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: track.artist} • ${track.movieName ?: track.album ?: ""}",
                color = TextTertiaryDark,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Icon(
            imageVector = Icons.Default.PlayArrow,
            contentDescription = "Play",
            tint = PrimaryStudio,
            modifier = Modifier.size(18.dp)
        )
    }
}

@Composable
private fun LoadMoreSheetButton(
    remaining: Int,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = SurfaceRaisedDark,
            contentColor = TextPrimaryDark
        ),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
    ) {
        Text("Show more ($remaining remaining)", fontSize = 12.sp)
    }
}

@Composable
private fun HomeSkeletonRows() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        repeat(3) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(SurfaceRaisedDark)
                )
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(3) {
                        Column(
                            modifier = Modifier
                                .width(148.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(SurfaceDark)
                                .padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(SurfaceRaisedDark)
                            )
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(0.75f)
                                    .height(12.dp)
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(SurfaceRaisedDark)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PersonalizedTrackCard(
    track: UnifiedTrackDto,
    onPlay: () -> Unit,
    onFeedback: (String) -> Unit,
    modifier: Modifier = Modifier.width(152.dp)
) {
    var isLiked by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceDark)
            .border(1.dp, HairlineDark, RoundedCornerShape(14.dp))
            .clickable(onClick = onPlay)
            .padding(10.dp)
    ) {
        BoxWithConstraints(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(RoundedCornerShape(8.dp))
                .background(SurfaceRaisedDark)
        ) {
            ArtworkImage(
                artworkUri = track.artworkUrl,
                size = maxWidth,
                cornerRadius = 8.dp
            )

            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(6.dp)
                    .size(28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(PrimaryStudio),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayArrow,
                    contentDescription = null,
                    tint = BackgroundDark,
                    modifier = Modifier.size(16.dp)
                )
            }

            if (track.language != null) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(5.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(SurfaceDeepest.copy(alpha = 0.85f))
                        .border(1.dp, HairlineDark, RoundedCornerShape(4.dp))
                        .padding(horizontal = 5.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = track.language,
                        color = TextTertiaryDark,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = track.title,
            color = TextPrimaryDark,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = track.singers?.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: track.artist,
            color = TextSecondaryDark,
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = track.movieName ?: track.album ?: track.artist,
            color = TextTertiaryDark,
            fontSize = 10.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = {
                    isLiked = !isLiked
                    onFeedback(if (isLiked) "LIKE" else "DISLIKE")
                },
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    contentDescription = "Like",
                    tint = if (isLiked) AccentAmber else TextTertiaryDark,
                    modifier = Modifier.size(15.dp)
                )
            }

            IconButton(
                onClick = { onFeedback("HIDE") },
                modifier = Modifier.size(24.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.VisibilityOff,
                    contentDescription = "Hide",
                    tint = TextTertiaryDark,
                    modifier = Modifier.size(14.dp)
                )
            }
        }
    }
}

@Composable
fun UpcomingScheduleBanner(
    schedule: MusicSchedule,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    UpcomingScheduleHeroCard(
        schedule = schedule,
        onClick = onClick,
        modifier = modifier
    )
}

@Composable
fun UpcomingScheduleHeroCard(
    schedule: MusicSchedule,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceDark)
            .border(1.dp, HairlineDark, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Next scheduled routine",
                color = AccentAmber,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = schedule.name,
                color = TextPrimaryDark,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "Plays ${schedule.targetName} at ${formatTimeDisplay(schedule.startTime)}",
                color = TextTertiaryDark,
                fontSize = 12.sp
            )
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = TextTertiaryDark,
            modifier = Modifier.size(18.dp)
        )
    }
}
