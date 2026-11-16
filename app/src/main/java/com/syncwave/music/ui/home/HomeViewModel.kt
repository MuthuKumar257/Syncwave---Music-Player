package com.syncwave.music.ui.home

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.remote.*
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.repository.PlaylistRepository
import com.syncwave.music.domain.repository.ScheduleRepository
import com.syncwave.music.playback.manager.PlaybackManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import com.google.gson.Gson
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
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
    val isLoadingFeed: Boolean = false,
    val isRefreshing: Boolean = false,
    val feedError: String? = null,
    val scanMessage: String? = null,
    val personalizedFeed: PersonalizedFeedDto? = null,
    val userPreferences: UserPreferencesDto? = null,
    val activeLanguage: String = "ALL",
    val isGeneratingPlaylist: Boolean = false,
    val generatedPlaylist: SmartPlaylistDto? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val musicRepository: MusicRepository,
    private val playlistRepository: PlaylistRepository,
    private val scheduleRepository: ScheduleRepository,
    private val playbackManager: PlaybackManager,
    private val apiService: SyncWaveApiService
) : ViewModel() {

    private val _isScanning = MutableStateFlow(false)
    private val _isLoadingFeed = MutableStateFlow(false)
    private val _isRefreshing = MutableStateFlow(false)
    private val _feedError = MutableStateFlow<String?>(null)
    private val _scanMessage = MutableStateFlow<String?>(null)

    private val _personalizedFeed = MutableStateFlow<PersonalizedFeedDto?>(loadCachedFeed())
    private val _userPreferences = MutableStateFlow<UserPreferencesDto?>(null)
    private val _activeLanguage = MutableStateFlow("ALL")
    private val _isGeneratingPlaylist = MutableStateFlow(false)
    private val _generatedPlaylist = MutableStateFlow<SmartPlaylistDto?>(null)
    private val gson = Gson()
    private var activeFeedJob: Job? = null

    val playbackState = playbackManager.playbackState

    init {
        fetchPreferences()
        fetchFeed()
    }

    private fun loadCachedFeed(): PersonalizedFeedDto? {
        return try {
            val prefs = context.getSharedPreferences("syncwave_home_cache", Context.MODE_PRIVATE)
            val json = prefs.getString("feed_json", null) ?: return null
            Gson().fromJson(json, PersonalizedFeedDto::class.java)
        } catch (_: Exception) {
            null
        }
    }

    private fun saveCachedFeed(feed: PersonalizedFeedDto) {
        try {
            val prefs = context.getSharedPreferences("syncwave_home_cache", Context.MODE_PRIVATE)
            prefs.edit().putString("feed_json", gson.toJson(feed)).apply()
        } catch (_: Exception) {
            // Ignore cache write errors
        }
    }

    private data class LocalHomeState(
        val recentlyPlayed: List<Song>,
        val recentlyAdded: List<Song>,
        val favPlaylists: List<Playlist>,
        val activeSchedules: List<MusicSchedule>,
        val scanning: Boolean,
        val loadingFeed: Boolean,
        val msg: String?
    )

    private data class RemoteRecState(
        val feed: PersonalizedFeedDto?,
        val preferences: UserPreferencesDto?,
        val activeLang: String,
        val isGenerating: Boolean,
        val generated: SmartPlaylistDto?
    )

    val uiState: StateFlow<HomeUiState> = combine(
        combine(
            musicRepository.getRecentlyPlayedSongs(12),
            musicRepository.getRecentlyAddedSongs(),
            playlistRepository.getFavoritePlaylists(),
            scheduleRepository.getActiveSchedules(),
            _isScanning,
            _isLoadingFeed,
            _scanMessage
        ) { args: Array<Any?> ->
            @Suppress("UNCHECKED_CAST")
            LocalHomeState(
                recentlyPlayed = args[0] as List<Song>,
                recentlyAdded = args[1] as List<Song>,
                favPlaylists = args[2] as List<Playlist>,
                activeSchedules = args[3] as List<MusicSchedule>,
                scanning = args[4] as Boolean,
                loadingFeed = args[5] as Boolean,
                msg = args[6] as String?
            )
        },
        combine(
            _personalizedFeed,
            _userPreferences,
            _activeLanguage,
            _isGeneratingPlaylist,
            _generatedPlaylist
        ) { feed, pref, lang, generating, generated ->
            RemoteRecState(feed, pref, lang, generating, generated)
        },
        _isRefreshing,
        _feedError
    ) { local, remote, refreshing, feedErr ->
        val nextSchedule = local.activeSchedules.minByOrNull { it.nextOccurrenceEpochMs ?: Long.MAX_VALUE }
        HomeUiState(
            greeting = remote.feed?.greeting ?: computeGreeting(),
            nextSchedule = nextSchedule,
            recentlyPlayed = local.recentlyPlayed,
            recentlyAdded = local.recentlyAdded.take(15),
            favoritePlaylists = local.favPlaylists,
            isScanning = local.scanning,
            isLoadingFeed = local.loadingFeed,
            isRefreshing = refreshing,
            feedError = feedErr,
            scanMessage = local.msg,
            personalizedFeed = remote.feed,
            userPreferences = remote.preferences,
            activeLanguage = remote.activeLang,
            isGeneratingPlaylist = remote.isGenerating,
            generatedPlaylist = remote.generated
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = HomeUiState(greeting = computeGreeting(), personalizedFeed = _personalizedFeed.value)
    )

    fun refreshHome() {
        if (activeFeedJob?.isActive == true || _isRefreshing.value) return
        activeFeedJob = viewModelScope.launch {
            _isRefreshing.value = true
            _feedError.value = null
            try {
                val lang = if (_activeLanguage.value != "ALL") _activeLanguage.value else null
                val prefCall = async {
                    try {
                        val prefRes = apiService.getUserPreferences()
                        if (prefRes.isSuccessful && prefRes.body()?.success == true) {
                            _userPreferences.value = prefRes.body()?.resolvePreferences()
                        }
                    } catch (_: Exception) {}
                }
                val feedCall = async {
                    val res = apiService.getRecommendations(
                        language = lang,
                        seed = System.currentTimeMillis().toString()
                    )
                    if (res.isSuccessful && res.body()?.success == true && res.body()?.data != null) {
                        val data = res.body()!!.data!!
                        _personalizedFeed.value = data
                        saveCachedFeed(data)
                    } else {
                        _feedError.value = "Server returned HTTP ${res.code()}"
                    }
                }
                awaitAll(prefCall, feedCall)
            } catch (e: Exception) {
                _feedError.value = e.message ?: "Unable to refresh recommendations"
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    fun fetchFeed(languageOverride: String? = null) {
        if (activeFeedJob?.isActive == true) return
        activeFeedJob = viewModelScope.launch {
            val hasCache = _personalizedFeed.value != null
            if (!hasCache) _isLoadingFeed.value = true
            _feedError.value = null
            try {
                val lang = languageOverride ?: if (_activeLanguage.value != "ALL") _activeLanguage.value else null
                val res = apiService.getRecommendations(language = lang)
                if (res.isSuccessful && res.body()?.success == true && res.body()?.data != null) {
                    val data = res.body()!!.data!!
                    _personalizedFeed.value = data
                    saveCachedFeed(data)
                } else {
                    _feedError.value = "Unable to refresh recommendations (HTTP ${res.code()})"
                }
            } catch (e: Exception) {
                _feedError.value = e.message ?: "Network unavailable"
            } finally {
                _isLoadingFeed.value = false
            }
        }
    }

    fun fetchPreferences() {
        viewModelScope.launch {
            try {
                val res = apiService.getUserPreferences()
                if (res.isSuccessful && res.body()?.success == true) {
                    _userPreferences.value = res.body()?.resolvePreferences()
                }
            } catch (_: Exception) {}
        }
    }

    fun setLanguageFilter(lang: String) {
        _activeLanguage.value = lang
        fetchFeed(if (lang != "ALL") lang else null)
    }

    fun updatePreferredLanguages(languages: List<String>) {
        viewModelScope.launch {
            try {
                val current = _userPreferences.value ?: UserPreferencesDto()
                val updated = current.copy(preferredLanguages = languages)
                val res = apiService.updateUserPreferences(updated)
                if (res.isSuccessful && res.body()?.success == true) {
                    _userPreferences.value = res.body()?.resolvePreferences()
                    fetchFeed()
                }
            } catch (_: Exception) {}
        }
    }

    fun generateSmartPlaylist(language: String?, mood: String?, durationMin: Int = 45) {
        viewModelScope.launch {
            _isGeneratingPlaylist.value = true
            try {
                val req = SmartPlaylistRequest(
                    language = language,
                    genreOrMood = mood,
                    targetDurationMinutes = durationMin
                )
                val res = apiService.generateSmartPlaylist(req)
                if (res.isSuccessful && res.body()?.success == true) {
                    _generatedPlaylist.value = res.body()?.playlist
                }
            } catch (_: Exception) {
            } finally {
                _isGeneratingPlaylist.value = false
            }
        }
    }

    fun clearGeneratedPlaylist() {
        _generatedPlaylist.value = null
    }

    fun saveSmartPlaylist(smart: SmartPlaylistDto) {
        viewModelScope.launch {
            val playlist = playlistRepository.createPlaylist(smart.name, smart.description)
            // Add tracks to local database if playable or save references
            _scanMessage.value = "Saved '${smart.name}' to Playlists"
        }
    }

    fun sendFeedback(trackId: String, feedbackType: String) {
        viewModelScope.launch {
            try {
                apiService.sendFeedback(FeedbackRequest(targetId = trackId, feedbackType = feedbackType))
                if (feedbackType == "HIDE") {
                    _personalizedFeed.value = _personalizedFeed.value?.let { current ->
                        current.copy(
                            recentlyPlayed = current.recentlyPlayed.filter { it.id != trackId },
                            recommendedForYou = current.recommendedForYou.filter { it.id != trackId },
                            madeForYou = current.madeForYou.filter { it.id != trackId },
                            similarSongs = current.similarSongs.filter { it.id != trackId },
                            popularSongs = current.popularSongs.filter { it.id != trackId },
                            trendingInLanguages = current.trendingInLanguages.filter { it.id != trackId },
                            discoverNewMusic = current.discoverNewMusic.filter { it.id != trackId },
                            discoverNew = current.discoverNew.filter { it.id != trackId }
                        )
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun unifiedTrackToDirectSongOrNull(track: UnifiedTrackDto): Song? {
        val directUrl = track.fullAudioUrl?.takeIf { it.isNotBlank() }
            ?: track.previewUrl?.takeIf { it.isNotBlank() }
            ?: return null
        return Song(
            id = track.id,
            title = track.title,
            artist = track.singers?.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: track.artist,
            album = track.movieName ?: track.album ?: "Online",
            durationMs = track.durationMs,
            uri = directUrl,
            artworkUri = track.artworkUrl,
            source = AudioSource.ONLINE_STREAM
        )
    }

    fun playUnifiedTracksAt(tracks: List<UnifiedTrackDto>, startIndex: Int = 0) {
        if (tracks.isEmpty()) return
        val safeIndex = startIndex.coerceIn(0, tracks.lastIndex)
        val clicked = tracks[safeIndex]

        val directQueue = tracks.mapNotNull { unifiedTrackToDirectSongOrNull(it) }
        val clickedDirect = unifiedTrackToDirectSongOrNull(clicked)
        if (clickedDirect != null && directQueue.isNotEmpty()) {
            val idxInDirect = directQueue.indexOfFirst { it.id == clickedDirect.id }.coerceAtLeast(0)
            playbackManager.playSong(directQueue[idxInDirect], directQueue, idxInDirect)
            recordPlayInteraction(clicked)
            return
        }

        // Resolve full stream URL via backend audio resolver so playback starts reliably in ExoPlayer
        viewModelScope.launch {
            try {
                val res = apiService.resolveAudioStream(clicked.title, clicked.artist)
                val audioUrl = res.body()?.audioUrl
                if (res.isSuccessful && !audioUrl.isNullOrBlank()) {
                    val song = Song(
                        id = clicked.id,
                        title = clicked.title,
                        artist = clicked.singers?.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: clicked.artist,
                        album = clicked.movieName ?: clicked.album ?: "Online",
                        durationMs = res.body()?.durationMs ?: clicked.durationMs,
                        uri = audioUrl,
                        artworkUri = clicked.artworkUrl ?: res.body()?.artworkUrl,
                        source = AudioSource.ONLINE_STREAM
                    )
                    playbackManager.playSong(song, listOf(song), 0)
                    recordPlayInteraction(clicked)
                    return@launch
                }
            } catch (_: Exception) {
                // Fallback to source URL only if audio resolver fails
            }
            openSourceUrl(clicked.sourceUrl)
        }
    }

    private fun recordPlayInteraction(track: UnifiedTrackDto) {
        viewModelScope.launch {
            try {
                apiService.recordListeningStat(
                    SongListeningStatRequest(
                        songId = track.id,
                        songName = track.title,
                        movieOrAlbum = track.movieName ?: track.album,
                        musicDirector = track.composer ?: track.artist,
                        singers = track.singers,
                        language = track.language,
                        playCount = 1
                    )
                )
            } catch (_: Exception) {}
        }
    }

    fun playUnifiedTrack(track: UnifiedTrackDto) {
        playUnifiedTracksAt(listOf(track), 0)
    }

    fun playRecommendedTracks(tracks: List<UnifiedTrackDto>) {
        playUnifiedTracksAt(tracks, 0)
    }

    fun playSoundtrack(soundtrack: MovieSoundtrackDto) {
        val playable = soundtrack.tracks.filter { !it.previewUrl.isNullOrBlank() }.map { track ->
            Song(
                id = track.id,
                title = track.title,
                artist = track.artist,
                album = soundtrack.movieName,
                durationMs = track.durationMs,
                uri = track.previewUrl!!,
                artworkUri = track.artworkUrl ?: soundtrack.artworkUrl,
                source = AudioSource.ONLINE_STREAM
            )
        }
        if (playable.isNotEmpty()) {
            playbackManager.playSong(playable[0], playable, 0)
        } else if (soundtrack.tracks.isNotEmpty()) {
            openSourceUrl(soundtrack.tracks[0].sourceUrl)
        }
    }

    fun playDailyMix(mix: DailyMixDto) {
        val playable = mix.tracks.filter { !it.previewUrl.isNullOrBlank() }.map { track ->
            Song(
                id = track.id,
                title = track.title,
                artist = track.artist,
                album = mix.title,
                durationMs = track.durationMs,
                uri = track.previewUrl!!,
                artworkUri = track.artworkUrl ?: mix.coverUrl,
                source = AudioSource.ONLINE_STREAM
            )
        }
        if (playable.isNotEmpty()) {
            playbackManager.playSong(playable[0], playable, 0)
        } else if (mix.tracks.isNotEmpty()) {
            openSourceUrl(mix.tracks[0].sourceUrl)
        }
    }

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

    fun openSourceUrl(url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (_: Exception) {}
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
