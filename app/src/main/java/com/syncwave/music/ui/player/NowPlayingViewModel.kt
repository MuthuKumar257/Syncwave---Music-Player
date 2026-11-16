package com.syncwave.music.ui.player

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.domain.model.RepeatMode
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.playback.manager.PlaybackManager
import com.syncwave.music.playback.sync.PlaybackSessionCoordinator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NowPlayingViewModel @Inject constructor(
    private val playbackManager: PlaybackManager,
    private val musicRepository: MusicRepository,
    private val sessionCoordinator: PlaybackSessionCoordinator
) : ViewModel() {

    val playbackState = playbackManager.playbackState
    val deviceSessionState = sessionCoordinator.sessionState
    val sleepTimerRemainingMs = playbackManager.sleepTimerRemainingMs

    fun transferToDevice(targetDeviceId: String) {
        sessionCoordinator.transferToDevice(targetDeviceId)
    }

    private val _isSleepTimerActive = MutableStateFlow(false)
    val isSleepTimerActive = _isSleepTimerActive.asStateFlow()

    fun togglePlayPause() = playbackManager.togglePlayPause()

    fun seekTo(positionMs: Long) = playbackManager.seekTo(positionMs)

    fun skipToNext() = playbackManager.skipToNext()

    fun skipToPrevious() = playbackManager.skipToPrevious()

    fun toggleShuffle() {
        val current = playbackState.value.isShuffleEnabled
        playbackManager.setShuffleMode(!current)
    }

    fun cycleRepeatMode() {
        val next = when (playbackState.value.repeatMode) {
            RepeatMode.OFF -> RepeatMode.ALL
            RepeatMode.ALL -> RepeatMode.ONE
            RepeatMode.ONE -> RepeatMode.OFF
        }
        playbackManager.setRepeatMode(next)
    }

    fun setVolume(volume: Float) = playbackManager.setVolume(volume)

    fun setSpeed(speed: Float) = playbackManager.setPlaybackSpeed(speed)

    fun playQueueIndex(index: Int) {
        val queue = playbackState.value.queue
        if (index in queue.indices) {
            playbackManager.playSong(queue[index], queue, index)
        }
    }

    fun removeQueueItem(index: Int) = playbackManager.removeQueueItem(index)

    fun moveQueueItem(fromIndex: Int, toIndex: Int) = playbackManager.moveQueueItem(fromIndex, toIndex)

    fun clearQueue() = playbackManager.clearQueue()

    fun toggleFavorite() {
        val song = playbackState.value.currentSong ?: return
        viewModelScope.launch {
            musicRepository.setFavorite(song.id, !song.isFavorite)
        }
    }

    fun setSleepTimer(minutes: Int) {
        if (minutes <= 0) {
            playbackManager.cancelSleepTimer()
            _isSleepTimerActive.value = false
        } else {
            playbackManager.startSleepTimer(minutes) {
                _isSleepTimerActive.value = false
            }
            _isSleepTimerActive.value = true
        }
    }

    fun setSleepTimerAtTime(hour24: Int, minute: Int) {
        playbackManager.startSleepTimerAtTime(hour24, minute) {
            _isSleepTimerActive.value = false
        }
        _isSleepTimerActive.value = true
    }
}

