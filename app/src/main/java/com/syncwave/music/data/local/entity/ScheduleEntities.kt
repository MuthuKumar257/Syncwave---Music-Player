package com.syncwave.music.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.syncwave.music.domain.model.MissedSchedulePolicy
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.RepeatType
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import com.syncwave.music.domain.model.SchedulePriority
import com.syncwave.music.domain.model.ScheduleTargetType
import com.syncwave.music.domain.model.TransitionType

@Entity(
    tableName = "music_schedules",
    indices = [
        Index(value = ["startTime"]),
        Index(value = ["isEnabled"]),
        Index(value = ["priority"])
    ]
)
data class MusicScheduleEntity(
    @PrimaryKey val id: String,
    val name: String,
    val startTime: String, // "HH:mm"
    val endTime: String?,
    val startDate: String?,
    val endDate: String?,
    val repeatType: String,
    val daysOfWeekCsv: String, // Comma-separated integers e.g. "1,2,3,4,5"
    val targetType: String,
    val targetId: String,
    val targetName: String,
    val priority: String,
    val isEnabled: Boolean,
    val transitionType: String,
    val transitionDurationSec: Int,
    val volume: Float,
    val missedSchedulePolicy: String,
    val offlineFallbackPlaylistId: String?,
    val lastExecutedAt: Long?,
    val nextOccurrenceEpochMs: Long?
) {
    fun toDomain(): MusicSchedule = MusicSchedule(
        id = id,
        name = name,
        startTime = startTime,
        endTime = endTime,
        startDate = startDate,
        endDate = endDate,
        repeatType = try { RepeatType.valueOf(repeatType) } catch (_: Exception) { RepeatType.DAILY },
        daysOfWeek = if (daysOfWeekCsv.isBlank()) emptyList() else daysOfWeekCsv.split(",").mapNotNull { it.trim().toIntOrNull() },
        targetType = try { ScheduleTargetType.valueOf(targetType) } catch (_: Exception) { ScheduleTargetType.PLAYLIST },
        targetId = targetId,
        targetName = targetName,
        priority = try { SchedulePriority.valueOf(priority) } catch (_: Exception) { SchedulePriority.NORMAL },
        isEnabled = isEnabled,
        transitionType = try { TransitionType.valueOf(transitionType) } catch (_: Exception) { TransitionType.CROSSFADE },
        transitionDurationSec = transitionDurationSec,
        volume = volume,
        missedSchedulePolicy = try { MissedSchedulePolicy.valueOf(missedSchedulePolicy) } catch (_: Exception) { MissedSchedulePolicy.SKIP },
        offlineFallbackPlaylistId = offlineFallbackPlaylistId,
        lastExecutedAt = lastExecutedAt,
        nextOccurrenceEpochMs = nextOccurrenceEpochMs
    )

    companion object {
        fun fromDomain(schedule: MusicSchedule): MusicScheduleEntity = MusicScheduleEntity(
            id = schedule.id,
            name = schedule.name,
            startTime = schedule.startTime,
            endTime = schedule.endTime,
            startDate = schedule.startDate,
            endDate = schedule.endDate,
            repeatType = schedule.repeatType.name,
            daysOfWeekCsv = schedule.daysOfWeek.joinToString(","),
            targetType = schedule.targetType.name,
            targetId = schedule.targetId,
            targetName = schedule.targetName,
            priority = schedule.priority.name,
            isEnabled = schedule.isEnabled,
            transitionType = schedule.transitionType.name,
            transitionDurationSec = schedule.transitionDurationSec,
            volume = schedule.volume,
            missedSchedulePolicy = schedule.missedSchedulePolicy.name,
            offlineFallbackPlaylistId = schedule.offlineFallbackPlaylistId,
            lastExecutedAt = schedule.lastExecutedAt,
            nextOccurrenceEpochMs = schedule.nextOccurrenceEpochMs
        )
    }
}

@Entity(
    tableName = "schedule_history",
    indices = [
        Index(value = ["scheduleId"]),
        Index(value = ["executedAt"])
    ]
)
data class ScheduleExecutionRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val scheduleId: String,
    val scheduleName: String,
    val executedAt: Long = System.currentTimeMillis(),
    val targetName: String,
    val success: Boolean,
    val statusMessage: String
) {
    fun toDomain(): ScheduleExecutionRecord = ScheduleExecutionRecord(
        id = id,
        scheduleId = scheduleId,
        scheduleName = scheduleName,
        executedAt = executedAt,
        targetName = targetName,
        success = success,
        statusMessage = statusMessage
    )

    companion object {
        fun fromDomain(record: ScheduleExecutionRecord): ScheduleExecutionRecordEntity = ScheduleExecutionRecordEntity(
            id = record.id,
            scheduleId = record.scheduleId,
            scheduleName = record.scheduleName,
            executedAt = record.executedAt,
            targetName = record.targetName,
            success = record.success,
            statusMessage = record.statusMessage
        )
    }
}
