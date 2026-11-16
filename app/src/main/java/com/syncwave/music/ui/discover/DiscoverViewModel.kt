package com.syncwave.music.ui.discover

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.remote.*
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.playback.manager.PlaybackManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class PlatformFilter(val label: String) {
    ALL("All Platforms"),
    LOCAL("Local"),
    SPOTIFY("Spotify"),
    YOUTUBE("YouTube"),
    APPLE_MUSIC("Apple Music")
}

enum class SearchTypeFilter(val label: String) {
    ALL("All"),
    MOVIE("Movies"),
    SONG("Songs"),
    ARTIST("Artists"),
    VIDEO("Videos")
}

data class DiscoverUiState(
    val query: String = "",
    val activeFilter: PlatformFilter = PlatformFilter.ALL,
    val activeType: SearchTypeFilter = SearchTypeFilter.ALL,
    val activeLanguage: String = "ALL",
    val localResults: List<Song> = emptyList(),
    val movies: List<MovieSoundtrackDto> = emptyList(),
    val songs: List<UnifiedTrackDto> = emptyList(),
    val suggestions: List<SearchSuggestionDto> = emptyList(),
    val isSearching: Boolean = false,
    val searchError: String? = null
)

@HiltViewModel
class DiscoverViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val musicRepository: MusicRepository,
    private val playbackManager: PlaybackManager,
    private val apiService: SyncWaveApiService
) : ViewModel() {

    private val _query = MutableStateFlow("")
    private val _activeFilter = MutableStateFlow(PlatformFilter.ALL)
    private val _activeType = MutableStateFlow(SearchTypeFilter.ALL)
    private val _activeLanguage = MutableStateFlow("ALL")

    private val _movies = MutableStateFlow<List<MovieSoundtrackDto>>(emptyList())
    private val _songs = MutableStateFlow<List<UnifiedTrackDto>>(emptyList())
    private val _suggestions = MutableStateFlow<List<SearchSuggestionDto>>(emptyList())
    private val _isSearching = MutableStateFlow(false)
    private val _searchError = MutableStateFlow<String?>(null)
    private val _downloadingTrackIds = MutableStateFlow<Set<String>>(emptySet())
    private val _downloadedTrackIds = MutableStateFlow<Set<String>>(emptySet())
    private val _downloadMessage = MutableStateFlow<String?>(null)

    val downloadingTrackIds: StateFlow<Set<String>> = _downloadingTrackIds
    val downloadedTrackIds: StateFlow<Set<String>> = _downloadedTrackIds
    val downloadMessage: StateFlow<String?> = _downloadMessage
    val downloadTasks = musicRepository.downloadTasks

    private var searchJob: Job? = null
    private var suggestionsJob: Job? = null

    val playbackState = playbackManager.playbackState

    init {
        // Initial search for trending movie soundtrack
        searchUniversal("Vaaranam Aayiram", SearchTypeFilter.ALL, PlatformFilter.ALL, "ALL")
    }

    private data class FilterState(
        val query: String,
        val filter: PlatformFilter,
        val type: SearchTypeFilter,
        val language: String
    )

    private data class SearchState(
        val movies: List<MovieSoundtrackDto>,
        val songs: List<UnifiedTrackDto>,
        val suggestions: List<SearchSuggestionDto>,
        val isSearching: Boolean,
        val searchError: String?
    )

    val uiState: StateFlow<DiscoverUiState> = combine(
        combine(_query, _activeFilter, _activeType, _activeLanguage) { q, f, t, l ->
            FilterState(q, f, t, l)
        },
        combine(_movies, _songs, _suggestions, _isSearching, _searchError) { m, s, sug, isSearching, err ->
            SearchState(m, s, sug, isSearching, err)
        }
    ) { filterState, searchState ->
        DiscoverUiState(
            query = filterState.query,
            activeFilter = filterState.filter,
            activeType = filterState.type,
            activeLanguage = filterState.language,
            movies = searchState.movies,
            songs = searchState.songs,
            suggestions = searchState.suggestions,
            isSearching = searchState.isSearching,
            searchError = searchState.searchError
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = DiscoverUiState()
    )

    fun setQuery(q: String) {
        _query.value = q
        fetchSuggestions(q)
        if (q.isNotBlank()) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch {
                delay(300) // Debounce search
                searchUniversal(q, _activeType.value, _activeFilter.value, _activeLanguage.value)
            }
        } else {
            _movies.value = emptyList()
            _songs.value = emptyList()
        }
    }

    fun setFilter(filter: PlatformFilter) {
        _activeFilter.value = filter
        if (_query.value.isNotBlank()) {
            searchUniversal(_query.value, _activeType.value, filter, _activeLanguage.value)
        }
    }

    fun setType(type: SearchTypeFilter) {
        _activeType.value = type
        if (_query.value.isNotBlank()) {
            searchUniversal(_query.value, type, _activeFilter.value, _activeLanguage.value)
        }
    }

    fun setLanguage(lang: String) {
        _activeLanguage.value = lang
        if (_query.value.isNotBlank()) {
            searchUniversal(_query.value, _activeType.value, _activeFilter.value, lang)
        }
    }

    fun retrySearch() {
        val target = _query.value.ifBlank { "Vaaranam Aayiram" }
        searchUniversal(target, _activeType.value, _activeFilter.value, _activeLanguage.value)
    }

    fun searchUniversal(
        query: String,
        type: SearchTypeFilter,
        platform: PlatformFilter,
        language: String
    ) {
        if (query.isBlank()) return
        viewModelScope.launch {
            _isSearching.value = true
            _searchError.value = null
            try {
                val plat = if (platform != PlatformFilter.ALL && platform != PlatformFilter.LOCAL) platform.name else null
                val typ = if (type != SearchTypeFilter.ALL) type.name.lowercase() else null
                val lang = if (language != "ALL") language else null

                val response = apiService.searchUniversal(
                    query = query,
                    type = typ,
                    platform = plat,
                    language = lang,
                    limit = 25
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    val body = response.body()!!
                    _movies.value = body.movies
                    _songs.value = body.songs
                } else {
                    _searchError.value = "Search failed (HTTP ${response.code()}). Please try again."
                }
            } catch (e: Exception) {
                _searchError.value = e.message ?: "Unable to reach server. Check your connection."
            } finally {
                _isSearching.value = false
            }
        }
    }

    private fun fetchSuggestions(q: String) {
        suggestionsJob?.cancel()
        if (q.length < 2) {
            _suggestions.value = emptyList()
            return
        }
        suggestionsJob = viewModelScope.launch {
            try {
                val res = apiService.getSearchSuggestions(q)
                if (res.isSuccessful && res.body()?.success == true) {
                    _suggestions.value = res.body()?.suggestions ?: emptyList()
                }
            } catch (_: Exception) {
                // Ignore
            }
        }
    }

    fun playUnifiedTrack(track: UnifiedTrackDto) {
        if (!track.previewUrl.isNullOrBlank()) {
            val song = Song(
                id = track.id,
                title = track.title,
                artist = track.artist,
                album = track.album ?: track.movieName ?: "Online",
                durationMs = track.durationMs,
                uri = track.previewUrl,
                artworkUri = track.artworkUrl,
                source = AudioSource.ONLINE_STREAM
            )
            playbackManager.playSong(song, listOf(song), 0)
            return
        }

        // Resolve direct audio stream so playback runs inside ExoPlayer audio engine (never video app)
        viewModelScope.launch {
            try {
                val res = apiService.resolveAudioStream(track.title, track.artist)
                val audioUrl = res.body()?.audioUrl
                if (res.isSuccessful && !audioUrl.isNullOrBlank()) {
                    val song = Song(
                        id = track.id,
                        title = track.title,
                        artist = track.artist,
                        album = track.album ?: track.movieName ?: "Online",
                        durationMs = res.body()?.durationMs ?: track.durationMs,
                        uri = audioUrl,
                        artworkUri = track.artworkUrl ?: res.body()?.artworkUrl,
                        source = AudioSource.ONLINE_STREAM
                    )
                    playbackManager.playSong(song, listOf(song), 0)
                    return@launch
                }
            } catch (_: Exception) {
                // Ignore and fall back
            }
            openSourceUrl(track.sourceUrl)
        }
    }

    fun playSoundtrack(soundtrack: MovieSoundtrackDto) {
        val playable = soundtrack.tracks.filter { !it.previewUrl.isNullOrBlank() || !it.fullAudioUrl.isNullOrBlank() }.map { track ->
            Song(
                id = track.id,
                title = track.title,
                artist = track.artist,
                album = soundtrack.movieName,
                durationMs = track.durationMs,
                uri = track.fullAudioUrl ?: track.previewUrl!!,
                artworkUri = track.artworkUrl ?: soundtrack.artworkUrl,
                source = AudioSource.ONLINE_STREAM
            )
        }
        if (playable.isNotEmpty()) {
            playbackManager.playSong(playable[0], playable, 0)
        } else if (soundtrack.tracks.isNotEmpty()) {
            playUnifiedTrack(soundtrack.tracks[0])
        }
    }

    fun playLocalSong(song: Song) {
        playbackManager.playSong(song, listOf(song), 0)
    }

    fun openSourceUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            // Safe fallback
        }
    }

    fun downloadTrack(track: UnifiedTrackDto) {
        if (_downloadingTrackIds.value.contains(track.id)) return
        viewModelScope.launch {
            _downloadingTrackIds.value = _downloadingTrackIds.value + track.id
            val result = musicRepository.downloadTrackToSongsFolder(track)
            _downloadingTrackIds.value = _downloadingTrackIds.value - track.id
            result.fold(
                onSuccess = { song ->
                    _downloadedTrackIds.value = _downloadedTrackIds.value + track.id
                    _downloadMessage.value = "Saved full-length \"${song.title}\" to Songs folder"
                },
                onFailure = { error ->
                    if (error !is kotlinx.coroutines.CancellationException) {
                        _downloadMessage.value = error.message ?: "Download failed for \"${track.title}\""
                    }
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
        if (_downloadingTrackIds.value.contains(trackId)) return
        viewModelScope.launch {
            _downloadingTrackIds.value = _downloadingTrackIds.value + trackId
            val result = musicRepository.resumeDownload(trackId)
            _downloadingTrackIds.value = _downloadingTrackIds.value - trackId
            result.fold(
                onSuccess = { song ->
                    _downloadedTrackIds.value = _downloadedTrackIds.value + trackId
                    _downloadMessage.value = "Saved full-length \"${song.title}\" to Songs folder"
                },
                onFailure = { error ->
                    if (error !is kotlinx.coroutines.CancellationException) {
                        _downloadMessage.value = error.message ?: "Resume failed"
                    }
                }
            )
        }
    }

    fun cancelDownload(trackId: String) {
        viewModelScope.launch {
            musicRepository.cancelDownload(trackId)
        }
    }

    fun clearDownloadMessage() {
        _downloadMessage.value = null
    }
}
