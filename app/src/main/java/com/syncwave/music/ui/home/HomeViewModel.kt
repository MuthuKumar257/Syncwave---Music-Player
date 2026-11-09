package com.syncwave.music.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.repository.PlaylistRepository
import com.syncwave.music.domain.repository.ScheduleRepository
import com.syncwave.music.playback.manager.PlaybackManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalTime
import javax.inject.Inject

data class HomeUiState(
    val greeting: String = "Welcome to SyncWave",
    val nextSchedule: MusicSchedule? = null,
    val recentlyPlayed: List<Song> = emptyList(),
    val recentlyAdded: List<Song> = emptyList(),
    val favoritePlaylists: List<Playlist> = emptyList(),
    val isScanning: Boolean = false,
    val scanMessage: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val musicRepository: MusicRepository,
    private val playlistRepository: PlaylistRepository,
    private val scheduleRepository: ScheduleRepository,
    private val playbackManager: PlaybackManager
) : ViewModel() {

    private val _isScanning = MutableStateFlow(false)
    private val _scanMessage = MutableStateFlow<String?>(null)

    val playbackState = playbackManager.playbackState

    val uiState: StateFlow<HomeUiState> = combine(
        musicRepository.getRecentlyPlayedSongs(10),
        musicRepository.getRecentlyAddedSongs(),
        playlistRepository.getFavoritePlaylists(),
        scheduleRepository.getActiveSchedules(),
        _isScanning,
        _scanMessage
    ) { args: Array<Any?> ->
        @Suppress("UNCHECKED_CAST")
        val recentlyPlayed = args[0] as List<Song>
        @Suppress("UNCHECKED_CAST")
        val recentlyAdded = args[1] as List<Song>
        @Suppress("UNCHECKED_CAST")
        val favPlaylists = args[2] as List<Playlist>
        @Suppress("UNCHECKED_CAST")
        val activeSchedules = args[3] as List<MusicSchedule>
        val scanning = args[4] as Boolean
        val msg = args[5] as String?

        val greeting = computeGreeting()
        val nextSchedule = activeSchedules.minByOrNull { it.nextOccurrenceEpochMs ?: Long.MAX_VALUE }

        HomeUiState(
            greeting = greeting,
            nextSchedule = nextSchedule,
            recentlyPlayed = recentlyPlayed,
            recentlyAdded = recentlyAdded.take(15),
            favoritePlaylists = favPlaylists,
            isScanning = scanning,
            scanMessage = msg
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = HomeUiState(greeting = computeGreeting())
    )

    fun playSong(song: Song, queue: List<Song>) {
        val index = queue.indexOf(song).coerceAtLeast(0)
        playbackManager.playSong(song, queue, index)
    }

    fun playPlaylist(playlist: Playlist) {
        viewModelScope.launch {
            playlistRepository.getSongsInPlaylist(playlist.id).collect { songs ->
                if (songs.isNotEmpty()) {
                    playbackManager.playPlaylist(songs, 0)
                }
            }
        }
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            musicRepository.setFavorite(song.id, !song.isFavorite)
        }
    }

    fun scanMusic() {
        viewModelScope.launch {
            _isScanning.value = true
            _scanMessage.value = null
            val result = musicRepository.scanLocalMusic()
            _isScanning.value = false
            result.fold(
                onSuccess = { count ->
                    _scanMessage.value = "Found and indexed $count songs"
                },
                onFailure = { error ->
                    _scanMessage.value = "Scan failed: ${error.message}"
                }
            )
        }
    }

    fun clearScanMessage() {
        _scanMessage.value = null
    }

    companion object {
        fun computeGreeting(): String {
            val hour = LocalTime.now().hour
            return when (hour) {
                in 5..11 -> "Good Morning ☀️"
                in 12..16 -> "Good Afternoon ⛅"
                in 17..20 -> "Good Evening 🌇"
                else -> "Good Night 🌙"
            }
        }
    }
}
