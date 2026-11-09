package com.syncwave.music.scheduler.receiver

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.syncwave.music.MainActivity
import com.syncwave.music.SyncWaveApp
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import com.syncwave.music.domain.repository.ScheduleRepository
import com.syncwave.music.playback.service.SyncWaveMediaSessionService
import com.syncwave.music.scheduler.engine.ScheduleAlarmScheduler
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class ScheduleAlarmReceiver : BroadcastReceiver() {

    @Inject
    lateinit var scheduleRepository: ScheduleRepository

    @Inject
    lateinit var alarmScheduler: ScheduleAlarmScheduler

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_TRIGGER_SCHEDULE) return

        val scheduleId = intent.getStringExtra(EXTRA_SCHEDULE_ID) ?: return
        val targetType = intent.getStringExtra(EXTRA_TARGET_TYPE) ?: "PLAYLIST"
        val targetId = intent.getStringExtra(EXTRA_TARGET_ID) ?: return
        val scheduleName = intent.getStringExtra(EXTRA_SCHEDULE_NAME) ?: "Smart Schedule"
        val transitionType = intent.getStringExtra(EXTRA_TRANSITION_TYPE) ?: "CROSSFADE"
        val transitionSec = intent.getIntExtra(EXTRA_TRANSITION_SEC, 3)
        val volume = intent.getFloatExtra(EXTRA_VOLUME, 1.0f)

        val pendingResult = goAsync()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val schedule = scheduleRepository.getScheduleById(scheduleId)
                if (schedule != null && schedule.isEnabled) {
                    // Send playback intent to MediaSessionService
                    val serviceIntent = Intent(context, SyncWaveMediaSessionService::class.java).apply {
                        action = SyncWaveMediaSessionService.ACTION_SCHEDULE_PLAY
                        putExtra(EXTRA_SCHEDULE_ID, scheduleId)
                        putExtra(EXTRA_TARGET_TYPE, targetType)
                        putExtra(EXTRA_TARGET_ID, targetId)
                        putExtra(EXTRA_TRANSITION_TYPE, transitionType)
                        putExtra(EXTRA_TRANSITION_SEC, transitionSec)
                        putExtra(EXTRA_VOLUME, volume)
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent)
                    } else {
                        context.startService(serviceIntent)
                    }

                    // Show notification for active schedule
                    showScheduleNotification(context, scheduleName, schedule.targetName)

                    // Record success in history
                    scheduleRepository.recordExecution(
                        ScheduleExecutionRecord(
                            scheduleId = scheduleId,
                            scheduleName = scheduleName,
                            targetName = schedule.targetName,
                            success = true,
                            statusMessage = "Executed successfully with $transitionType ($transitionSec s)"
                        )
                    )

                    // Schedule next occurrence if recurring
                    alarmScheduler.scheduleAlarm(schedule)
                } else {
                    scheduleRepository.recordExecution(
                        ScheduleExecutionRecord(
                            scheduleId = scheduleId,
                            scheduleName = scheduleName,
                            targetName = targetId,
                            success = false,
                            statusMessage = "Schedule was disabled or removed"
                        )
                    )
                }
            } catch (e: Exception) {
                scheduleRepository.recordExecution(
                    ScheduleExecutionRecord(
                        scheduleId = scheduleId,
                        scheduleName = scheduleName,
                        targetName = targetId,
                        success = false,
                        statusMessage = "Execution failed: ${e.message}"
                    )
                )
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun showScheduleNotification(context: Context, scheduleName: String, targetName: String) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val openAppIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, SyncWaveApp.SCHEDULER_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle("SyncWave Scheduler Active")
            .setContentText("Playing \"$scheduleName\" • $targetName")
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    companion object {
        const val ACTION_TRIGGER_SCHEDULE = "com.syncwave.music.ACTION_TRIGGER_SCHEDULE"
        const val EXTRA_SCHEDULE_ID = "extra_schedule_id"
        const val EXTRA_TARGET_TYPE = "extra_target_type"
        const val EXTRA_TARGET_ID = "extra_target_id"
        const val EXTRA_SCHEDULE_NAME = "extra_schedule_name"
        const val EXTRA_TRANSITION_TYPE = "extra_transition_type"
        const val EXTRA_TRANSITION_SEC = "extra_transition_sec"
        const val EXTRA_VOLUME = "extra_volume"

        private const val NOTIFICATION_ID = 2001
    }
}
