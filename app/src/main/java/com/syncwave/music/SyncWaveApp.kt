package com.syncwave.music

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class SyncWaveApp : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val playbackChannel = NotificationChannel(
                PLAYBACK_CHANNEL_ID,
                "Playback Controls",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows currently playing music controls"
                setShowBadge(false)
            }

            val schedulerChannel = NotificationChannel(
                SCHEDULER_CHANNEL_ID,
                "Smart Music Scheduler",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for automated scheduled music routines"
                enableVibration(true)
            }

            val downloadChannel = NotificationChannel(
                DOWNLOAD_CHANNEL_ID,
                "Audio Downloads",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows progress for audio downloads"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannels(
                listOf(playbackChannel, schedulerChannel, downloadChannel)
            )
        }
    }

    companion object {
        const val PLAYBACK_CHANNEL_ID = "syncwave_playback_channel"
        const val SCHEDULER_CHANNEL_ID = "syncwave_scheduler_channel"
        const val DOWNLOAD_CHANNEL_ID = "syncwave_download_channel"
    }
}
