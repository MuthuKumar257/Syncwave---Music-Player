package com.syncwave.music.scheduler.engine

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.repository.ScheduleRepository
import com.syncwave.music.scheduler.receiver.ScheduleAlarmReceiver
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ScheduleAlarmScheduler @Inject constructor(
    @ApplicationContext private val context: Context,
    private val scheduleRepository: ScheduleRepository
) {
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    fun canScheduleExactAlarms(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager?.canScheduleExactAlarms() == true
        } else {
            true
        }
    }

    suspend fun scheduleAlarm(schedule: MusicSchedule) {
        if (!schedule.isEnabled || alarmManager == null) {
            cancelAlarm(schedule.id)
            return
        }

        val nextEpochMs = ScheduleOccurrenceCalculator.calculateNextOccurrenceEpochMs(schedule)
        if (nextEpochMs == null || nextEpochMs <= System.currentTimeMillis()) {
            cancelAlarm(schedule.id)
            return
        }

        // Save computed next occurrence in DB for dashboard display
        scheduleRepository.updateExecutionTime(
            id = schedule.id,
            timestamp = schedule.lastExecutedAt ?: 0L,
            nextEpochMs = nextEpochMs
        )

        val intent = Intent(context, ScheduleAlarmReceiver::class.java).apply {
            action = ScheduleAlarmReceiver.ACTION_TRIGGER_SCHEDULE
            putExtra(ScheduleAlarmReceiver.EXTRA_SCHEDULE_ID, schedule.id)
            putExtra(ScheduleAlarmReceiver.EXTRA_TARGET_TYPE, schedule.targetType.name)
            putExtra(ScheduleAlarmReceiver.EXTRA_TARGET_ID, schedule.targetId)
            putExtra(ScheduleAlarmReceiver.EXTRA_SCHEDULE_NAME, schedule.name)
            putExtra(ScheduleAlarmReceiver.EXTRA_TRANSITION_TYPE, schedule.transitionType.name)
            putExtra(ScheduleAlarmReceiver.EXTRA_TRANSITION_SEC, schedule.transitionDurationSec)
            putExtra(ScheduleAlarmReceiver.EXTRA_VOLUME, schedule.volume)
        }

        val requestCode = schedule.id.hashCode()
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        try {
            if (canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    nextEpochMs,
                    pendingIntent
                )
            } else {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    nextEpochMs,
                    pendingIntent
                )
            }
        } catch (e: SecurityException) {
            // In case of permission revocation during execution, fallback safely
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                nextEpochMs,
                pendingIntent
            )
        }
    }

    fun cancelAlarm(scheduleId: String) {
        if (alarmManager == null) return
        val intent = Intent(context, ScheduleAlarmReceiver::class.java).apply {
            action = ScheduleAlarmReceiver.ACTION_TRIGGER_SCHEDULE
        }
        val requestCode = scheduleId.hashCode()
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    fun rescheduleAllActiveAlarms() {
        CoroutineScope(Dispatchers.IO).launch {
            val activeSchedules = scheduleRepository.getActiveSchedulesSync()
            for (schedule in activeSchedules) {
                scheduleAlarm(schedule)
            }
        }
    }
}
