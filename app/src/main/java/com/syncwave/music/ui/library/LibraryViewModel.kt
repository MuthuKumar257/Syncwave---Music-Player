package com.syncwave.music.ui.library

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.repository.PreferencesRepository
import com.syncwave.music.domain.model.Album
import com.syncwave.music.domain.model.Artist
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.repository.PlaylistRepository
import com.syncwave.music.playback.manager.PlaybackManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class LibraryTab(val title: String) {
    SONGS("Songs"),
    PLAYLISTS("Playlists"),
    ALBUMS("Albums"),
    ARTISTS("Artists"),
    FAVORITES("Favorites")
}

enum class LibrarySourceFilter(val label: String) {
    ALL("All"),
    DOWNLOADED("Downloaded"),
    FOLDERS("Folders"),
    DEVICE("Device")
}

data class LibraryUiState(
    val selectedTab: LibraryTab = LibraryTab.SONGS,
    val sourceFilter: LibrarySourceFilter = LibrarySourceFilter.ALL,
    val searchQuery: String = "",
    val songs: List<Song> = emptyList(),
    val playlists: List<Playlist> = emptyList(),
    val albums: List<Album> = emptyList(),
    val artists: List<Artist> = emptyList(),
    val favoriteSongs: List<Song> = emptyList(),
    val musicFolderCount: Int = 0,
    val defaultFolderUri: String? = null,
    val isScanning: Boolean = false,
    val scanMessage: String? = null
)

@HiltViewModel
class LibraryViewModel @Inject constructor(
    private val musicRepository: MusicRepository,
    private val playlistRepository: PlaylistRepository,
    private val preferencesRepository: PreferencesRepository,
    private val playbackManager: PlaybackManager
) : ViewModel() {

    private val _selectedTab = MutableStateFlow(LibraryTab.SONGS)
    private val _sourceFilter = MutableStateFlow(LibrarySourceFilter.ALL)
    private val _searchQuery = MutableStateFlow("")
    private val _isScanning = MutableStateFlow(false)
    private val _scanMessage = MutableStateFlow<String?>(null)

    val playbackState = playbackManager.playbackState
    val downloadTasks = musicRepository.downloadTasks

    @Suppress("UNCHECKED_CAST")
    val uiState: StateFlow<LibraryUiState> = combine(
        _selectedTab,
        _searchQuery,
        _searchQuery.flatMapLatest { query ->
            if (query.isBlank()) musicRepository.getAllSongs() else musicRepository.searchSongs(query)
        },
        playlistRepository.getAllPlaylists(),
        musicRepository.getAllAlbums(),
        musicRepository.getAllArtists(),
        musicRepository.getFavoriteSongs(),
        _isScanning,
        _scanMessage,
        _sourceFilter,
        preferencesRepository.musicFolderUris,
        preferencesRepository.defaultMusicFolderUri
    ) { args: Array<Any?> ->
        val filter = args[9] as LibrarySourceFilter
        val allMatchingSongs = args[2] as List<Song>
        val filteredSongs = when (filter) {
            LibrarySourceFilter.ALL -> allMatchingSongs
            LibrarySourceFilter.DOWNLOADED -> allMatchingSongs.filter { it.source == AudioSource.DOWNLOADED }
            LibrarySourceFilter.FOLDERS -> allMatchingSongs.filter {
                it.source != AudioSource.DOWNLOADED &&
                    !it.folderName.isNullOrBlank() &&
                    it.folderName != "Device Library"
            }
            LibrarySourceFilter.DEVICE -> allMatchingSongs.filter {
                it.source == AudioSource.LOCAL &&
                    (it.folderName.isNullOrBlank() || it.folderName == "Device Library")
            }
        }
        val folderUris = args[10] as Set<String>
        LibraryUiState(
            selectedTab = args[0] as LibraryTab,
            sourceFilter = filter,
            searchQuery = args[1] as String,
            songs = filteredSongs,
            playlists = args[3] as List<Playlist>,
            albums = args[4] as List<Album>,
            artists = args[5] as List<Artist>,
            favoriteSongs = args[6] as List<Song>,
            musicFolderCount = folderUris.size,
            defaultFolderUri = args[11] as String?,
            isScanning = args[7] as Boolean,
            scanMessage = args[8] as String?
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = LibraryUiState()
    )

    fun setTab(tab: LibraryTab) {
        _selectedTab.value = tab
    }

    fun setSourceFilter(filter: LibrarySourceFilter) {
        _sourceFilter.value = filter
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun playSong(song: Song, queue: List<Song>) {
        val index = queue.indexOf(song).coerceAtLeast(0)
        playbackManager.playSong(song, queue, index)
    }

    fun toggleFavorite(song: Song) {
        viewModelScope.launch {
            musicRepository.setFavorite(song.id, !song.isFavorite)
        }
    }

    fun createPlaylist(name: String) {
        viewModelScope.launch {
            if (name.isNotBlank()) {
                playlistRepository.createPlaylist(name)
            }
        }
    }

    fun deletePlaylist(playlistId: String) {
        viewModelScope.launch {
            playlistRepository.deletePlaylist(playlistId)
        }
    }

    fun scanMusic() {
        viewModelScope.launch {
            _isScanning.value = true
            val result = musicRepository.scanLocalMusic()
            _isScanning.value = false
            result.fold(
                onSuccess = { count ->
                    _scanMessage.value = "Indexed $count local songs"
                },
                onFailure = { error ->
                    _scanMessage.value = "Scanning error: ${error.message}"
                }
            )
        }
    }

    fun addMusicFolder(treeUri: Uri, makeDefault: Boolean = false) {
        viewModelScope.launch {
            _isScanning.value = true
            val result = musicRepository.addMusicFolder(treeUri, makeDefault)
            _isScanning.value = false
            result.fold(
                onSuccess = { count ->
                    _scanMessage.value = "Folder added • $count total songs indexed"
                },
                onFailure = { error ->
                    _scanMessage.value = "Folder scan failed: ${error.message}"
                }
            )
        }
    }

    fun pauseDownload(trackId: String) {
        viewModelScope.launch {
            musicRepository.pauseDownload(trackId)
        }
    }

    fun resumeDownload(trackId: String) {
        viewModelScope.launch {
            val result = musicRepository.resumeDownload(trackId)
            result.onSuccess { song ->
                _scanMessage.value = "Completed full download: ${song.title}"
            }.onFailure { error ->
                if (error !is kotlinx.coroutines.CancellationException) {
                    _scanMessage.value = error.message ?: "Download failed"
                }
            }
        }
    }

    fun cancelDownload(trackId: String) {
        viewModelScope.launch {
            musicRepository.cancelDownload(trackId)
        }
    }

    fun clearScanMessage() {
        _scanMessage.value = null
    }
}

