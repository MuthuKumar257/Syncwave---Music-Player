package com.syncwave.music.playback.service

import android.app.PendingIntent
import android.content.Intent
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.syncwave.music.MainActivity
import com.syncwave.music.domain.model.TransitionType
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.repository.PlaylistRepository
import com.syncwave.music.playback.manager.PlaybackManager
import com.syncwave.music.scheduler.receiver.ScheduleAlarmReceiver
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SyncWaveMediaSessionService : MediaSessionService() {

    @Inject
    lateinit var playbackManager: PlaybackManager

    @Inject
    lateinit var musicRepository: MusicRepository

    @Inject
    lateinit var playlistRepository: PlaylistRepository

    private var mediaSession: MediaSession? = null
    private val serviceScope = CoroutineScope(Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        val activityIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        mediaSession = MediaSession.Builder(this, playbackManager.exoPlayer)
            .setSessionActivity(pendingIntent)
            .build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        return mediaSession
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_SCHEDULE_PLAY) {
            handleSchedulePlayback(intent)
        }
        return super.onStartCommand(intent, flags, startId)
    }

    private fun handleSchedulePlayback(intent: Intent) {
        val targetType = intent.getStringExtra(ScheduleAlarmReceiver.EXTRA_TARGET_TYPE) ?: "PLAYLIST"
        val targetId = intent.getStringExtra(ScheduleAlarmReceiver.EXTRA_TARGET_ID) ?: return
        val transitionTypeStr = intent.getStringExtra(ScheduleAlarmReceiver.EXTRA_TRANSITION_TYPE) ?: "CROSSFADE"
        val transitionSec = intent.getIntExtra(ScheduleAlarmReceiver.EXTRA_TRANSITION_SEC, 3)
        val volume = intent.getFloatExtra(ScheduleAlarmReceiver.EXTRA_VOLUME, 1.0f)

        serviceScope.launch(Dispatchers.IO) {
            val songsToPlay = if (targetType == "PLAYLIST") {
                playlistRepository.getSongsInPlaylist(targetId).first()
            } else {
                val song = musicRepository.getSongById(targetId)
                if (song != null) listOf(song) else emptyList()
            }

            if (songsToPlay.isNotEmpty()) {
                launch(Dispatchers.Main) {
                    playbackManager.setVolume(volume)
                    val transitionType = try {
                        TransitionType.valueOf(transitionTypeStr)
                    } catch (_: Exception) {
                        TransitionType.CROSSFADE
                    }

                    when (transitionType) {
                        TransitionType.CROSSFADE -> {
                            playbackManager.crossfadeTo(songsToPlay, 0, transitionSec)
                        }
                        TransitionType.FADE_OUT_IN -> {
                            playbackManager.crossfadeTo(songsToPlay, 0, transitionSec)
                        }
                        TransitionType.IMMEDIATE -> {
                            playbackManager.playPlaylist(songsToPlay, 0)
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
            mediaSession = null
        }
        super.onDestroy()
    }

    companion object {
        const val ACTION_SCHEDULE_PLAY = "com.syncwave.music.ACTION_SCHEDULE_PLAY"
    }
}
