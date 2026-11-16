package com.syncwave.music.playback.manager

import android.animation.ValueAnimator
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.syncwave.music.domain.model.PlaybackState
import com.syncwave.music.domain.model.RepeatMode
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.utils.TimeSelectionUtils
import com.syncwave.music.playback.sync.PlaybackSessionCommandReceiver
import com.syncwave.music.playback.sync.PlaybackSessionCoordinator
import com.syncwave.music.playback.sync.parseRepeatMode
import com.syncwave.music.playback.sync.toDomainSong
import com.syncwave.music.playback.sync.toSessionTrackDto
import com.google.gson.Gson
import com.syncwave.music.data.remote.PendingCommandDto
import com.syncwave.music.data.remote.SessionPlaybackDto
import com.syncwave.music.data.repository.PersistedPlaybackSessionDto
import com.syncwave.music.data.repository.PreferencesRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val musicRepository: MusicRepository,
    private val sessionCoordinator: PlaybackSessionCoordinator,
    private val preferencesRepository: PreferencesRepository
) {
    val exoPlayer: ExoPlayer = ExoPlayer.Builder(context)
        .setAudioAttributes(
            androidx.media3.common.AudioAttributes.Builder()
                .setContentType(androidx.media3.common.C.AUDIO_CONTENT_TYPE_MUSIC)
                .setUsage(androidx.media3.common.C.USAGE_MEDIA)
                .build(),
            true // Handle audio focus automatically
        )
        .setHandleAudioBecomingNoisy(true)
        .build()

    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    private var audioFocusRequest: AudioFocusRequest? = null

    private val _playbackState = MutableStateFlow(PlaybackState())
    val playbackState: StateFlow<PlaybackState> = _playbackState.asStateFlow()

    private val _sleepTimerRemainingMs = MutableStateFlow<Long?>(null)
    val sleepTimerRemainingMs: StateFlow<Long?> = _sleepTimerRemainingMs.asStateFlow()

    private val coroutineScope = CoroutineScope(Dispatchers.Main + Job())
    private var progressTrackerJob: Job? = null
    private var sleepTimerJob: Job? = null

    private var crossfadeAnimator: ValueAnimator? = null
    private var lastSyncPublishAtMs: Long = 0L

    val sessionPlayedSongIds: MutableSet<String> = java.util.Collections.synchronizedSet(mutableSetOf())
    private var isFetchingAutoQueue = false
    private val gson = Gson()
    private var isRestoringSession = false
    private var lastSessionPersistMs = 0L
    private var pendingSessionPersistJob: Job? = null

    private var currentTrackListeningMs: Long = 0L
    private var hasCountedPlayForTrack: Boolean = false
    private var lastProgressCheckMs: Long = 0L

    fun fetchAndAppendAutoQueue(referenceSong: Song) {
        if (isFetchingAutoQueue) return
        isFetchingAutoQueue = true
        android.util.Log.d("PlaybackManager", "[PlaybackManager Android] Queue generation started for track: \"${referenceSong.title}\" (${referenceSong.id})")
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val currentQueue = _playbackState.value.queue
                val excludeIds = (sessionPlayedSongIds + currentQueue.map { it.id }).distinct()
                val recommendations = musicRepository.getAutoQueueRecommendations(
                    songId = referenceSong.id,
                    songTitle = referenceSong.title,
                    artist = referenceSong.artist,
                    director = null,
                    language = null,
                    genre = referenceSong.genre,
                    mood = null,
                    excludeIds = excludeIds,
                    limit = 20
                )
                android.util.Log.d("PlaybackManager", "[PlaybackManager Android] Recommendation API response received: ${recommendations.size} tracks")
                val freshQueue = _playbackState.value.queue
                val freshIds = freshQueue.map { it.id }.toSet()
                val uniqueNewSongs = recommendations.filter { !freshIds.contains(it.id) && !sessionPlayedSongIds.contains(it.id) }
                val duplicatesFiltered = recommendations.size - uniqueNewSongs.size
                android.util.Log.d("PlaybackManager", "[PlaybackManager Android] Number of duplicate songs filtered: $duplicatesFiltered")
                android.util.Log.d("PlaybackManager", "[PlaybackManager Android] Number of valid songs added to queue: ${uniqueNewSongs.size}")
                if (uniqueNewSongs.isNotEmpty()) {
                    withContext(Dispatchers.Main) {
                        val mediaItems = uniqueNewSongs.map { toMediaItem(it) }
                        exoPlayer.addMediaItems(mediaItems)
                        _playbackState.update { state ->
                            state.copy(queue = state.queue + uniqueNewSongs)
                        }
                        sessionCoordinator.publishActiveState(_playbackState.value)
                        persistPlaybackSession(immediate = true)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("PlaybackManager", "[PlaybackManager Android] Queue generation failure: ${e.message}", e)
            } finally {
                isFetchingAutoQueue = false
            }
        }
    }

    private val isRemoteMode: Boolean
        get() = sessionCoordinator.sessionState.value.isRemoteMode

    init {
        setupPlayerListener()
        setupNoisyReceiver()
        setupSessionCoordinatorBridge()
        restoreSavedSession()
    }

    private fun setupSessionCoordinatorBridge() {
        sessionCoordinator.attachReceiver(object : PlaybackSessionCommandReceiver {
            override fun onHaltLocalAudioForRemoteHandoff(activeDeviceName: String?) {
                coroutineScope.launch {
                    if (exoPlayer.isPlaying) {
                        exoPlayer.pause()
                    }
                    _playbackState.update {
                        it.copy(
                            isPlaying = false,
                            isRemoteMode = true,
                            activeDeviceName = activeDeviceName
                        )
                    }
                }
            }

            override fun onMirrorRemotePlayback(playback: SessionPlaybackDto, activeDeviceName: String?) {
                coroutineScope.launch {
                    val mirroredSong = playback.track?.toDomainSong()
                    val mirroredQueue = playback.queue.map { it.toDomainSong() }
                    val durMs = ((playback.durationSec * 1000.0).toLong()).takeIf { it > 0L }
                        ?: mirroredSong?.durationMs ?: 0L
                    _playbackState.update {
                        it.copy(
                            currentSong = mirroredSong,
                            isPlaying = playback.isPlaying,
                            currentPositionMs = (playback.positionSec * 1000.0).toLong().coerceAtLeast(0L),
                            durationMs = durMs,
                            isShuffleEnabled = playback.isShuffle,
                            repeatMode = parseRepeatMode(playback.repeatMode),
                            volume = playback.volume,
                            queue = mirroredQueue,
                            queueIndex = playback.queueIndex,
                            isRemoteMode = true,
                            activeDeviceName = activeDeviceName
                        )
                    }
                }
            }

            override fun onExecuteRemoteCommand(cmd: PendingCommandDto) {
                coroutineScope.launch {
                    _playbackState.update { it.copy(isRemoteMode = false, activeDeviceName = null) }
                    val payload = cmd.payload
                    when (cmd.type) {
                        "PLAY_TRACK" -> {
                            val trackDto = sessionCoordinator.parseTrack(payload?.get("track"))
                            val queueDtos = sessionCoordinator.parseQueue(payload?.get("queue"))
                            if (trackDto != null) {
                                val domainSong = trackDto.toDomainSong()
                                val domainQueue = if (queueDtos.isNotEmpty()) queueDtos.map { it.toDomainSong() } else listOf(domainSong)
                                val idx = domainQueue.indexOfFirst { it.id == domainSong.id }.coerceAtLeast(0)
                                executeLocalPlaySong(domainSong, domainQueue, idx, 0L)
                            }
                        }
                        "PLAY" -> executeLocalPlay()
                        "PAUSE" -> executeLocalPause()
                        "TOGGLE_PLAY" -> if (exoPlayer.isPlaying) executeLocalPause() else executeLocalPlay()
                        "SEEK" -> {
                            val posSec = payload?.get("positionSec")?.asDouble ?: 0.0
                            executeLocalSeekTo((posSec * 1000.0).toLong().coerceAtLeast(0L))
                        }
                        "NEXT" -> executeLocalSkipToNext()
                        "PREVIOUS" -> executeLocalSkipToPrevious()
                        "SET_VOLUME" -> {
                            val vol = payload?.get("volume")?.asFloat ?: 0.85f
                            executeLocalSetVolume(vol)
                        }
                        "TOGGLE_SHUFFLE" -> {
                            val nextShuffle = !_playbackState.value.isShuffleEnabled
                            executeLocalShuffle(nextShuffle)
                        }
                        "TOGGLE_REPEAT" -> {
                            val nextMode = when (_playbackState.value.repeatMode) {
                                RepeatMode.OFF -> RepeatMode.ALL
                                RepeatMode.ALL -> RepeatMode.ONE
                                RepeatMode.ONE -> RepeatMode.OFF
                            }
                            executeLocalRepeat(nextMode)
                        }
                        "SYNC_TAKEOVER" -> {
                            val trackDto = sessionCoordinator.parseTrack(payload?.get("track"))
                            val queueDtos = sessionCoordinator.parseQueue(payload?.get("queue"))
                            val posSec = payload?.get("positionSec")?.asDouble ?: 0.0
                            val shouldPlay = payload?.get("isPlaying")?.asBoolean ?: false
                            if (trackDto != null) {
                                val domainSong = trackDto.toDomainSong()
                                val domainQueue = if (queueDtos.isNotEmpty()) queueDtos.map { it.toDomainSong() } else listOf(domainSong)
                                val idx = domainQueue.indexOfFirst { it.id == domainSong.id }.coerceAtLeast(0)
                                val posMs = (posSec * 1000.0).toLong().coerceAtLeast(0L)
                                if (shouldPlay) {
                                    executeLocalPlaySong(domainSong, domainQueue, idx, posMs)
                                } else {
                                    _playbackState.update {
                                        it.copy(
                                            currentSong = domainSong,
                                            queue = domainQueue,
                                            queueIndex = idx,
                                            currentPositionMs = posMs,
                                            isPlaying = false,
                                            isRemoteMode = false,
                                            activeDeviceName = null
                                        )
                                    }
                                    sessionCoordinator.publishActiveState(_playbackState.value)
                                }
                            }
                        }
                    }
                }
            }
        })
    }

    private fun setupPlayerListener() {
        exoPlayer.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                _playbackState.update { it.copy(isPlaying = isPlaying) }
                if (isPlaying) {
                    startProgressTracker()
                } else {
                    stopProgressTracker()
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                when (playbackState) {
                    Player.STATE_READY -> {
                        _playbackState.update {
                            val resolvedDur = exoPlayer.duration.takeIf { d -> d > 0L }
                                ?: it.currentSong?.durationMs
                                ?: 0L
                            it.copy(
                                durationMs = resolvedDur,
                                currentPositionMs = exoPlayer.currentPosition.coerceAtLeast(0L)
                            )
                        }
                    }
                    Player.STATE_ENDED -> {
                        val currentSong = _playbackState.value.currentSong
                        if (currentSong != null) {
                            val durationToRecord = currentTrackListeningMs.coerceAtLeast(currentSong.durationMs)
                            coroutineScope.launch(Dispatchers.IO) {
                                musicRepository.recordPlayHistory(
                                    songId = currentSong.id,
                                    songTitle = currentSong.title,
                                    artistName = currentSong.artist,
                                    durationMs = durationToRecord,
                                    completed = true
                                )
                            }
                        }
                        handleTrackEnded()
                    }
                    else -> {}
                }
            }

            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                updateCurrentMediaItem()
            }

            override fun onPlayerError(error: PlaybackException) {
                val songTitle = _playbackState.value.currentSong?.title ?: "audio file"
                _playbackState.update {
                    it.copy(
                        isPlaying = false,
                        errorMessage = "Could not play \"$songTitle\": ${error.message ?: "corrupted or unavailable file"}"
                    )
                }
                stopProgressTracker()
            }
        })
    }

    fun clearError() {
        _playbackState.update { it.copy(errorMessage = null) }
    }

    private fun setupNoisyReceiver() {
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context?, intent: Intent?) {
                if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                    pause()
                }
            }
        }
        context.registerReceiver(receiver, filter)
    }

    private fun startProgressTracker() {
        progressTrackerJob?.cancel()
        lastProgressCheckMs = System.currentTimeMillis()
        progressTrackerJob = coroutineScope.launch {
            while (isActive) {
                if (exoPlayer.isPlaying && !isRemoteMode) {
                    val currentSong = _playbackState.value.currentSong
                    val resolvedDur = exoPlayer.duration.takeIf { d -> d > 0L }
                        ?: currentSong?.durationMs
                        ?: _playbackState.value.durationMs

                    val now = System.currentTimeMillis()
                    val deltaMs = (now - lastProgressCheckMs).coerceIn(0L, 2000L)
                    lastProgressCheckMs = now
                    currentTrackListeningMs += deltaMs

                    val thresholdMs = if (resolvedDur in 1..59999L) resolvedDur / 2 else 30000L
                    if (currentSong != null && !hasCountedPlayForTrack && currentTrackListeningMs >= thresholdMs) {
                        hasCountedPlayForTrack = true
                        coroutineScope.launch(Dispatchers.IO) {
                            musicRepository.recordPlayHistory(
                                songId = currentSong.id,
                                songTitle = currentSong.title,
                                artistName = currentSong.artist,
                                durationMs = currentTrackListeningMs,
                                completed = false
                            )
                        }
                    }

                    _playbackState.update {
                        it.copy(
                            currentPositionMs = exoPlayer.currentPosition.coerceAtLeast(0L),
                            durationMs = resolvedDur.coerceAtLeast(0L),
                            isRemoteMode = false
                        )
                    }
                    if (now - lastSyncPublishAtMs >= 3000L) {
                        lastSyncPublishAtMs = now
                        sessionCoordinator.publishActiveState(_playbackState.value)
                        persistPlaybackSession(immediate = false)
                    }
                } else {
                    lastProgressCheckMs = System.currentTimeMillis()
                }
                delay(500)
            }
        }
    }

    private fun stopProgressTracker() {
        progressTrackerJob?.cancel()
    }

    private fun updateCurrentMediaItem() {
        val index = exoPlayer.currentMediaItemIndex
        val queue = _playbackState.value.queue
        val currentSong = queue.getOrNull(index)
        val resolvedDur = exoPlayer.duration.takeIf { d -> d > 0L }
            ?: currentSong?.durationMs
            ?: 0L

        currentTrackListeningMs = 0L
        hasCountedPlayForTrack = false
        lastProgressCheckMs = System.currentTimeMillis()

        _playbackState.update {
            it.copy(
                currentSong = currentSong,
                queueIndex = index,
                currentPositionMs = exoPlayer.currentPosition.coerceAtLeast(0L),
                durationMs = resolvedDur.coerceAtLeast(0L)
            )
        }

        if (currentSong != null) {
            sessionPlayedSongIds.add(currentSong.id)
            val remainingItems = exoPlayer.mediaItemCount - 1 - index
            if (remainingItems < 5 && _playbackState.value.repeatMode != RepeatMode.ONE) {
                fetchAndAppendAutoQueue(currentSong)
            }
            // Play count recording is deferred to progressTracker once the >=30s threshold is reached
            persistPlaybackSession(immediate = false)
        }
    }

    private fun handleTrackEnded() {
        val state = _playbackState.value
        when (state.repeatMode) {
            RepeatMode.ONE -> {
                exoPlayer.seekTo(0)
                exoPlayer.play()
            }
            RepeatMode.ALL -> {
                if (exoPlayer.hasNextMediaItem()) {
                    exoPlayer.seekToNextMediaItem()
                } else if (state.queue.isNotEmpty()) {
                    exoPlayer.seekTo(0, 0)
                }
                exoPlayer.play()
            }
            RepeatMode.OFF -> {
                if (exoPlayer.hasNextMediaItem()) {
                    exoPlayer.seekToNextMediaItem()
                    exoPlayer.play()
                } else {
                    val currentSong = _playbackState.value.currentSong
                    if (currentSong != null) {
                        fetchAndAppendAutoQueue(currentSong)
                    } else {
                        exoPlayer.pause()
                    }
                }
            }
        }
    }

    fun playSong(song: Song, queue: List<Song> = listOf(song), startIndex: Int = 0) {
        if (queue.size <= 1) {
            sessionPlayedSongIds.clear()
            sessionPlayedSongIds.add(song.id)
        }
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand(
                "PLAY_TRACK",
                mapOf(
                    "track" to song.toSessionTrackDto(),
                    "queue" to queue.take(50).map { it.toSessionTrackDto() }
                )
            )
            return
        }
        executeLocalPlaySong(song, queue, startIndex, 0L)
        val remainingUpcoming = queue.size - 1 - startIndex
        if (queue.size <= 1 || remainingUpcoming < 5) {
            fetchAndAppendAutoQueue(song)
        }
    }

    private fun executeLocalPlaySong(song: Song, queue: List<Song>, startIndex: Int, startPosMs: Long) {
        val mediaItems = queue.map { toMediaItem(it) }
        _playbackState.update {
            it.copy(
                queue = queue,
                queueIndex = startIndex,
                currentSong = queue.getOrNull(startIndex) ?: song,
                isRemoteMode = false,
                activeDeviceName = null,
                errorMessage = null
            )
        }

        exoPlayer.setMediaItems(mediaItems, startIndex, startPosMs)
        exoPlayer.prepare()
        exoPlayer.play()
        lastSyncPublishAtMs = System.currentTimeMillis()
        sessionCoordinator.publishActiveState(_playbackState.value.copy(isPlaying = true, currentPositionMs = startPosMs))
        persistPlaybackSession(immediate = true)
    }

    fun playPlaylist(songs: List<Song>, startIndex: Int = 0) {
        if (songs.isEmpty()) return
        playSong(songs[startIndex], songs, startIndex)
    }

    fun togglePlayPause() {
        if (isRemoteMode) {
            val cmd = if (_playbackState.value.isPlaying) "PAUSE" else "PLAY"
            sessionCoordinator.sendRemoteCommand(cmd)
            return
        }
        if (exoPlayer.isPlaying) {
            executeLocalPause()
        } else {
            executeLocalPlay()
        }
    }

    fun play() {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("PLAY")
            return
        }
        executeLocalPlay()
    }

    fun pause() {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("PAUSE")
            return
        }
        executeLocalPause()
    }

    private fun executeLocalPlay() {
        exoPlayer.play()
        _playbackState.update { it.copy(isPlaying = true, isRemoteMode = false) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    private fun executeLocalPause() {
        exoPlayer.pause()
        _playbackState.update { it.copy(isPlaying = false, isRemoteMode = false) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun seekTo(positionMs: Long) {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("SEEK", mapOf("positionSec" to positionMs / 1000.0))
            _playbackState.update { it.copy(currentPositionMs = positionMs) }
            return
        }
        executeLocalSeekTo(positionMs)
    }

    private fun executeLocalSeekTo(positionMs: Long) {
        exoPlayer.seekTo(positionMs)
        _playbackState.update { it.copy(currentPositionMs = positionMs) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun skipToNext() {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("NEXT")
            return
        }
        executeLocalSkipToNext()
    }

    private fun executeLocalSkipToNext() {
        if (exoPlayer.hasNextMediaItem()) {
            exoPlayer.seekToNextMediaItem()
        } else if (_playbackState.value.repeatMode == RepeatMode.ALL && _playbackState.value.queue.isNotEmpty()) {
            exoPlayer.seekTo(0, 0)
        }
        sessionCoordinator.publishActiveState(_playbackState.value)
    }

    fun skipToPrevious() {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("PREVIOUS")
            return
        }
        executeLocalSkipToPrevious()
    }

    private fun executeLocalSkipToPrevious() {
        if (exoPlayer.currentPosition > 3000L) {
            exoPlayer.seekTo(0)
        } else if (exoPlayer.hasPreviousMediaItem()) {
            exoPlayer.seekToPreviousMediaItem()
        }
        sessionCoordinator.publishActiveState(_playbackState.value)
    }

    fun setShuffleMode(enabled: Boolean) {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("TOGGLE_SHUFFLE")
            return
        }
        executeLocalShuffle(enabled)
    }

    private fun executeLocalShuffle(enabled: Boolean) {
        exoPlayer.shuffleModeEnabled = enabled
        _playbackState.update { it.copy(isShuffleEnabled = enabled) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun setRepeatMode(mode: RepeatMode) {
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("TOGGLE_REPEAT")
            return
        }
        executeLocalRepeat(mode)
    }

    private fun executeLocalRepeat(mode: RepeatMode) {
        val playerRepeatMode = when (mode) {
            RepeatMode.OFF -> Player.REPEAT_MODE_OFF
            RepeatMode.ALL -> Player.REPEAT_MODE_ALL
            RepeatMode.ONE -> Player.REPEAT_MODE_ONE
        }
        exoPlayer.repeatMode = playerRepeatMode
        _playbackState.update { it.copy(repeatMode = mode) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun setPlaybackSpeed(speed: Float) {
        exoPlayer.setPlaybackSpeed(speed)
        _playbackState.update { it.copy(playbackSpeed = speed) }
        persistPlaybackSession(immediate = true)
    }

    fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        if (isRemoteMode) {
            sessionCoordinator.sendRemoteCommand("SET_VOLUME", mapOf("volume" to clamped))
            _playbackState.update { it.copy(volume = clamped) }
            return
        }
        executeLocalSetVolume(clamped)
    }

    private fun executeLocalSetVolume(clamped: Float) {
        exoPlayer.volume = clamped
        _playbackState.update { it.copy(volume = clamped) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun removeQueueItem(index: Int) {
        val currentQueue = _playbackState.value.queue.toMutableList()
        if (index !in currentQueue.indices) return
        currentQueue.removeAt(index)

        if (index < exoPlayer.mediaItemCount) {
            exoPlayer.removeMediaItem(index)
        }

        val newCurrentIndex = exoPlayer.currentMediaItemIndex
        val newCurrentSong = currentQueue.getOrNull(newCurrentIndex)
        _playbackState.update {
            it.copy(
                queue = currentQueue,
                queueIndex = newCurrentIndex,
                currentSong = newCurrentSong ?: it.currentSong
            )
        }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun moveQueueItem(fromIndex: Int, toIndex: Int) {
        val currentQueue = _playbackState.value.queue.toMutableList()
        if (fromIndex !in currentQueue.indices || toIndex !in currentQueue.indices || fromIndex == toIndex) return
        val item = currentQueue.removeAt(fromIndex)
        currentQueue.add(toIndex, item)

        if (fromIndex < exoPlayer.mediaItemCount && toIndex < exoPlayer.mediaItemCount) {
            exoPlayer.moveMediaItem(fromIndex, toIndex)
        }

        val newCurrentIndex = exoPlayer.currentMediaItemIndex
        val newCurrentSong = currentQueue.getOrNull(newCurrentIndex)
        _playbackState.update {
            it.copy(
                queue = currentQueue,
                queueIndex = newCurrentIndex,
                currentSong = newCurrentSong ?: it.currentSong
            )
        }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun addToQueue(song: Song) {
        val currentQueue = _playbackState.value.queue
        if (currentQueue.any { it.id == song.id }) return
        exoPlayer.addMediaItem(toMediaItem(song))
        _playbackState.update { it.copy(queue = it.queue + song) }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    fun clearQueue() {
        val currentSong = _playbackState.value.currentSong
        if (currentSong != null) {
            val currIdx = exoPlayer.currentMediaItemIndex
            for (i in (exoPlayer.mediaItemCount - 1) downTo (currIdx + 1)) {
                exoPlayer.removeMediaItem(i)
            }
            for (i in (currIdx - 1) downTo 0) {
                exoPlayer.removeMediaItem(i)
            }
            _playbackState.update {
                it.copy(
                    queue = listOf(currentSong),
                    queueIndex = 0
                )
            }
            fetchAndAppendAutoQueue(currentSong)
        } else {
            exoPlayer.clearMediaItems()
            _playbackState.update {
                it.copy(
                    queue = emptyList(),
                    queueIndex = -1
                )
            }
        }
        sessionCoordinator.publishActiveState(_playbackState.value)
        persistPlaybackSession(immediate = true)
    }

    /**
     * Crossfades smoothly from current audio to target song/playlist.
     */
    fun crossfadeTo(targetSongs: List<Song>, startIndex: Int = 0, durationSec: Int = 3) {
        if (targetSongs.isEmpty()) return
        val durationMs = (durationSec * 1000L).coerceAtLeast(1000L)

        crossfadeAnimator?.cancel()
        val originalVolume = exoPlayer.volume.takeIf { it > 0.1f } ?: 1.0f

        // 1. Fade out current
        crossfadeAnimator = ValueAnimator.ofFloat(originalVolume, 0f).apply {
            duration = durationMs / 2
            addUpdateListener { animator ->
                val v = animator.animatedValue as Float
                exoPlayer.volume = v
            }
            start()
        }

        coroutineScope.launch {
            _playbackState.update { it.copy(isCrossfading = true) }
            delay(durationMs / 2)

            // 2. Switch track
            playPlaylist(targetSongs, startIndex)
            exoPlayer.volume = 0f

            // 3. Fade in new
            crossfadeAnimator = ValueAnimator.ofFloat(0f, originalVolume).apply {
                duration = durationMs / 2
                addUpdateListener { animator ->
                    val v = animator.animatedValue as Float
                    exoPlayer.volume = v
                }
                start()
            }
            delay(durationMs / 2)
            _playbackState.update { it.copy(isCrossfading = false) }
        }
    }

    fun startSleepTimer(minutes: Int, onTimerFinished: () -> Unit = {}) {
        val exactMinutes = minutes.coerceAtLeast(1)
        startSleepTimerDurationMs(exactMinutes * 60_000L, onTimerFinished)
    }

    fun startSleepTimerAtTime(hour24: Int, minute: Int, onTimerFinished: () -> Unit = {}) {
        val delayMs = TimeSelectionUtils.calculateDelayMsUntilTime(hour24, minute)
        startSleepTimerDurationMs(delayMs, onTimerFinished)
    }

    private fun startSleepTimerDurationMs(durationMs: Long, onTimerFinished: () -> Unit) {
        sleepTimerJob?.cancel()
        val endEpochMs = System.currentTimeMillis() + durationMs
        _sleepTimerRemainingMs.value = durationMs
        sleepTimerJob = coroutineScope.launch {
            while (isActive) {
                val remaining = endEpochMs - System.currentTimeMillis()
                if (remaining <= 0L) break
                _sleepTimerRemainingMs.value = remaining
                delay(minOf(1000L, remaining))
            }
            _sleepTimerRemainingMs.value = 0L
            // Fade out over 5 seconds before pausing
            val initialVol = exoPlayer.volume
            val steps = 10
            for (i in steps downTo 0) {
                exoPlayer.volume = initialVol * (i.toFloat() / steps)
                delay(500)
            }
            pause()
            exoPlayer.volume = initialVol
            _sleepTimerRemainingMs.value = null
            onTimerFinished()
        }
    }

    fun cancelSleepTimer() {
        sleepTimerJob?.cancel()
        sleepTimerJob = null
        _sleepTimerRemainingMs.value = null
    }

    private fun toMediaItem(song: Song): MediaItem {
        return MediaItem.Builder()
            .setMediaId(song.id)
            .setUri(Uri.parse(song.uri))
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(song.title)
                    .setArtist(song.artist)
                    .setAlbumTitle(song.album)
                    .setArtworkUri(song.artworkUri?.let { Uri.parse(it) })
                    .build()
            )
            .build()
    }

    fun persistPlaybackSession(immediate: Boolean = false) {
        if (isRestoringSession) return
        val state = _playbackState.value
        val currSong = state.currentSong
        val dto = PersistedPlaybackSessionDto(
            lastPlayedSongId = currSong?.id,
            currentSong = currSong?.toSessionTrackDto(),
            positionMs = state.currentPositionMs,
            isPlaying = false,
            queue = state.queue.take(100).map { it.toSessionTrackDto() },
            queueIndex = state.queueIndex,
            sessionPlayedSongIds = sessionPlayedSongIds.toList(),
            isShuffle = state.isShuffleEnabled,
            repeatMode = state.repeatMode.name,
            volume = state.volume,
            playbackSpeed = state.playbackSpeed,
            savedAt = System.currentTimeMillis()
        )

        fun doSave() {
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val json = gson.toJson(dto)
                    preferencesRepository.savePlaybackSessionJson(
                        json = json,
                        songId = currSong?.id,
                        positionMs = state.currentPositionMs
                    )
                } catch (_: Exception) {}
            }
        }

        if (immediate) {
            pendingSessionPersistJob?.cancel()
            lastSessionPersistMs = System.currentTimeMillis()
            doSave()
        } else {
            val now = System.currentTimeMillis()
            if (now - lastSessionPersistMs >= 3000L) {
                lastSessionPersistMs = now
                doSave()
            } else {
                pendingSessionPersistJob?.cancel()
                pendingSessionPersistJob = coroutineScope.launch {
                    delay(3000L)
                    lastSessionPersistMs = System.currentTimeMillis()
                    doSave()
                }
            }
        }
    }

    fun restoreSavedSession() {
        coroutineScope.launch(Dispatchers.IO) {
            try {
                val json = preferencesRepository.getPlaybackSessionJson()
                if (json.isNullOrBlank()) return@launch

                val session = gson.fromJson(json, PersistedPlaybackSessionDto::class.java) ?: return@launch
                val restoredQueue = session.queue.map { it.toDomainSong() }
                val restoredCurrentSong = session.currentSong?.toDomainSong()
                    ?: restoredQueue.getOrNull(session.queueIndex)
                    ?: return@launch

                val finalQueue = if (restoredQueue.isEmpty()) listOf(restoredCurrentSong) else restoredQueue
                val rawIdx = if (session.queueIndex in finalQueue.indices) {
                    session.queueIndex
                } else {
                    finalQueue.indexOfFirst { it.id == restoredCurrentSong.id }
                }
                val finalIndex = if (rawIdx >= 0) rawIdx else 0
                val targetPositionMs = session.positionMs.coerceAtLeast(0L)
                val restoredRepeat = parseRepeatMode(session.repeatMode)

                sessionPlayedSongIds.clear()
                if (session.sessionPlayedSongIds.isNotEmpty()) {
                    sessionPlayedSongIds.addAll(session.sessionPlayedSongIds)
                }
                sessionPlayedSongIds.add(restoredCurrentSong.id)

                withContext(Dispatchers.Main) {
                    isRestoringSession = true
                    try {
                        _playbackState.update {
                            it.copy(
                                currentSong = restoredCurrentSong,
                                queue = finalQueue,
                                queueIndex = finalIndex,
                                currentPositionMs = targetPositionMs,
                                durationMs = restoredCurrentSong.durationMs.coerceAtLeast(0L),
                                isPlaying = false,
                                isShuffleEnabled = session.isShuffle,
                                repeatMode = restoredRepeat,
                                volume = session.volume,
                                playbackSpeed = session.playbackSpeed,
                                isRemoteMode = false,
                                activeDeviceName = null,
                                errorMessage = null
                            )
                        }

                        val mediaItems = finalQueue.map { toMediaItem(it) }
                        exoPlayer.setMediaItems(mediaItems, finalIndex, targetPositionMs)
                        exoPlayer.playWhenReady = false
                        exoPlayer.shuffleModeEnabled = session.isShuffle
                        exoPlayer.repeatMode = when (restoredRepeat) {
                            RepeatMode.OFF -> Player.REPEAT_MODE_OFF
                            RepeatMode.ALL -> Player.REPEAT_MODE_ALL
                            RepeatMode.ONE -> Player.REPEAT_MODE_ONE
                        }
                        exoPlayer.volume = session.volume
                        exoPlayer.setPlaybackSpeed(session.playbackSpeed)
                        exoPlayer.prepare()

                        sessionCoordinator.publishActiveState(_playbackState.value)
                        val remainingUpcoming = finalQueue.size - 1 - finalIndex
                        if (remainingUpcoming < 5) {
                            fetchAndAppendAutoQueue(restoredCurrentSong)
                        }
                    } finally {
                        isRestoringSession = false
                    }
                }
            } catch (_: Exception) {
                isRestoringSession = false
            }
        }
    }

    fun clearSessionHistory() {
        sessionPlayedSongIds.clear()
        _playbackState.value.currentSong?.let {
            sessionPlayedSongIds.add(it.id)
        }
        persistPlaybackSession(immediate = true)
    }
}

