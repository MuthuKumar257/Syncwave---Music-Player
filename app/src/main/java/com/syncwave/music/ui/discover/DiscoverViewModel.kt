package com.syncwave.music.ui.discover

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.playback.manager.PlaybackManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

enum class PlatformFilter(val label: String) {
    ALL("All Sources"),
    LOCAL("Local Music"),
    SPOTIFY("Spotify API"),
    YOUTUBE("YouTube Music")
}

data class OnlineDiscoveryItem(
    val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val platform: PlatformFilter,
    val externalUrl: String,
    val isPlayableDirectly: Boolean
)

data class DiscoverUiState(
    val query: String = "",
    val activeFilter: PlatformFilter = PlatformFilter.ALL,
    val localResults: List<Song> = emptyList(),
    val onlineRecommendations: List<OnlineDiscoveryItem> = emptyList()
)

@HiltViewModel
class DiscoverViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val musicRepository: MusicRepository,
    private val playbackManager: PlaybackManager
) : ViewModel() {

    private val _query = MutableStateFlow("")
    private val _activeFilter = MutableStateFlow(PlatformFilter.ALL)

    val playbackState = playbackManager.playbackState

    val uiState: StateFlow<DiscoverUiState> = combine(
        _query,
        _activeFilter,
        _query.flatMapLatest { q ->
            if (q.isBlank()) musicRepository.getRecentlyAddedSongs() else musicRepository.searchSongs(q)
        }
    ) { query, filter, localSongs ->
        val recommendations = getSampleDiscoveryFeed().filter {
            filter == PlatformFilter.ALL || it.platform == filter
        }.filter {
            query.isBlank() || it.title.contains(query, ignoreCase = true) || it.artist.contains(query, ignoreCase = true)
        }

        DiscoverUiState(
            query = query,
            activeFilter = filter,
            localResults = if (filter == PlatformFilter.ALL || filter == PlatformFilter.LOCAL) localSongs else emptyList(),
            onlineRecommendations = recommendations
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = DiscoverUiState()
    )

    fun setQuery(q: String) {
        _query.value = q
    }

    fun setFilter(filter: PlatformFilter) {
        _activeFilter.value = filter
    }

    fun playLocalSong(song: Song) {
        playbackManager.playSong(song, listOf(song), 0)
    }

    fun openExternalPlatform(item: OnlineDiscoveryItem) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(item.externalUrl)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            // Safe fallback if browser or app is not found
        }
    }

    private fun getSampleDiscoveryFeed(): List<OnlineDiscoveryItem> {
        return listOf(
            OnlineDiscoveryItem(
                id = "sp_1",
                title = "Deep Focus Ambience",
                artist = "Lofi Sleep & Study",
                album = "Focus Waves Vol. 1",
                platform = PlatformFilter.SPOTIFY,
                externalUrl = "https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS",
                isPlayableDirectly = false
            ),
            OnlineDiscoveryItem(
                id = "yt_1",
                title = "Synthwave Beats 2026",
                artist = "RetroWave Collective",
                album = "Neon Horizon",
                platform = PlatformFilter.YOUTUBE,
                externalUrl = "https://music.youtube.com",
                isPlayableDirectly = false
            ),
            OnlineDiscoveryItem(
                id = "sp_2",
                title = "High Energy Morning Workout",
                artist = "Cardio Beats",
                album = "Run Faster",
                platform = PlatformFilter.SPOTIFY,
                externalUrl = "https://open.spotify.com",
                isPlayableDirectly = false
            ),
            OnlineDiscoveryItem(
                id = "yt_2",
                title = "Ambient Acoustic Meditation",
                artist = "Calm Nature",
                album = "Serenity",
                platform = PlatformFilter.YOUTUBE,
                externalUrl = "https://music.youtube.com",
                isPlayableDirectly = false
            )
        )
    }
}
