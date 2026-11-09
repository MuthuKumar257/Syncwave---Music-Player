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
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.syncwave.music.domain.model.PlaybackState
import com.syncwave.music.domain.model.RepeatMode
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
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
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val musicRepository: MusicRepository
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

    private val coroutineScope = CoroutineScope(Dispatchers.Main + Job())
    private var progressTrackerJob: Job? = null
    private var sleepTimerJob: Job? = null

    private var crossfadeAnimator: ValueAnimator? = null

    init {
        setupPlayerListener()
        setupNoisyReceiver()
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
                            it.copy(
                                durationMs = exoPlayer.duration.coerceAtLeast(0L),
                                currentPositionMs = exoPlayer.currentPosition
                            )
                        }
                    }
                    Player.STATE_ENDED -> {
                        val currentSong = _playbackState.value.currentSong
                        if (currentSong != null) {
                            coroutineScope.launch(Dispatchers.IO) {
                                musicRepository.recordPlayHistory(
                                    songId = currentSong.id,
                                    songTitle = currentSong.title,
                                    artistName = currentSong.artist,
                                    durationMs = currentSong.durationMs,
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
        })
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
        progressTrackerJob = coroutineScope.launch {
            while (isActive) {
                if (exoPlayer.isPlaying) {
                    _playbackState.update {
                        it.copy(
                            currentPositionMs = exoPlayer.currentPosition,
                            durationMs = exoPlayer.duration.coerceAtLeast(0L)
                        )
                    }
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
        _playbackState.update {
            it.copy(
                currentSong = currentSong,
                queueIndex = index,
                currentPositionMs = exoPlayer.currentPosition,
                durationMs = exoPlayer.duration.coerceAtLeast(0L)
            )
        }

        if (currentSong != null) {
            coroutineScope.launch(Dispatchers.IO) {
                musicRepository.recordPlayHistory(
                    songId = currentSong.id,
                    songTitle = currentSong.title,
                    artistName = currentSong.artist,
                    durationMs = 0L,
                    completed = false
                )
            }
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
                    exoPlayer.pause()
                }
            }
        }
    }

    fun playSong(song: Song, queue: List<Song> = listOf(song), startIndex: Int = 0) {
        val mediaItems = queue.map { toMediaItem(it) }
        _playbackState.update {
            it.copy(
                queue = queue,
                queueIndex = startIndex,
                currentSong = queue.getOrNull(startIndex) ?: song
            )
        }

        exoPlayer.setMediaItems(mediaItems, startIndex, 0L)
        exoPlayer.prepare()
        exoPlayer.play()
    }

    fun playPlaylist(songs: List<Song>, startIndex: Int = 0) {
        if (songs.isEmpty()) return
        playSong(songs[startIndex], songs, startIndex)
    }

    fun togglePlayPause() {
        if (exoPlayer.isPlaying) {
            pause()
        } else {
            play()
        }
    }

    fun play() {
        exoPlayer.play()
    }

    fun pause() {
        exoPlayer.pause()
    }

    fun seekTo(positionMs: Long) {
        exoPlayer.seekTo(positionMs)
        _playbackState.update { it.copy(currentPositionMs = positionMs) }
    }

    fun skipToNext() {
        if (exoPlayer.hasNextMediaItem()) {
            exoPlayer.seekToNextMediaItem()
        } else if (_playbackState.value.repeatMode == RepeatMode.ALL && _playbackState.value.queue.isNotEmpty()) {
            exoPlayer.seekTo(0, 0)
        }
    }

    fun skipToPrevious() {
        if (exoPlayer.currentPosition > 3000L) {
            exoPlayer.seekTo(0)
        } else if (exoPlayer.hasPreviousMediaItem()) {
            exoPlayer.seekToPreviousMediaItem()
        }
    }

    fun setShuffleMode(enabled: Boolean) {
        exoPlayer.shuffleModeEnabled = enabled
        _playbackState.update { it.copy(isShuffleEnabled = enabled) }
    }

    fun setRepeatMode(mode: RepeatMode) {
        val playerRepeatMode = when (mode) {
            RepeatMode.OFF -> Player.REPEAT_MODE_OFF
            RepeatMode.ALL -> Player.REPEAT_MODE_ALL
            RepeatMode.ONE -> Player.REPEAT_MODE_ONE
        }
        exoPlayer.repeatMode = playerRepeatMode
        _playbackState.update { it.copy(repeatMode = mode) }
    }

    fun setPlaybackSpeed(speed: Float) {
        exoPlayer.setPlaybackSpeed(speed)
        _playbackState.update { it.copy(playbackSpeed = speed) }
    }

    fun setVolume(volume: Float) {
        val clamped = volume.coerceIn(0f, 1f)
        exoPlayer.volume = clamped
        _playbackState.update { it.copy(volume = clamped) }
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
        sleepTimerJob?.cancel()
        val durationMs = minutes * 60 * 1000L
        sleepTimerJob = coroutineScope.launch {
            delay(durationMs)
            // Fade out over 5 seconds before pausing
            val initialVol = exoPlayer.volume
            val steps = 10
            for (i in steps downTo 0) {
                exoPlayer.volume = initialVol * (i.toFloat() / steps)
                delay(500)
            }
            pause()
            exoPlayer.volume = initialVol
            onTimerFinished()
        }
    }

    fun cancelSleepTimer() {
        sleepTimerJob?.cancel()
        sleepTimerJob = null
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
}
