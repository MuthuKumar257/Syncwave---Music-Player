package com.syncwave.music.domain.model

enum class RepeatType {
    ONCE,
    DAILY,
    WEEKDAYS,
    CUSTOM_DAYS
}

enum class SchedulePriority(val level: Int) {
    LOW(1),
    NORMAL(2),
    HIGH(3),
    URGENT(4)
}

enum class TransitionType {
    IMMEDIATE,
    CROSSFADE,
    FADE_OUT_IN
}

enum class MissedSchedulePolicy {
    PLAY_IMMEDIATELY,
    SKIP,
    PLAY_IF_WITHIN_WINDOW
}

enum class ScheduleTargetType {
    PLAYLIST,
    SONG
}

data class MusicSchedule(
    val id: String,
    val name: String,
    val startTime: String, // format "HH:mm" e.g. "06:00", "18:30"
    val endTime: String? = null,
    val startDate: String? = null, // format "yyyy-MM-dd"
    val endDate: String? = null,
    val repeatType: RepeatType = RepeatType.DAILY,
    val daysOfWeek: List<Int> = emptyList(), // 1 = Monday ... 7 = Sunday (Calendar / java.time.DayOfWeek)
    val targetType: ScheduleTargetType = ScheduleTargetType.PLAYLIST,
    val targetId: String,
    val targetName: String,
    val priority: SchedulePriority = SchedulePriority.NORMAL,
    val isEnabled: Boolean = true,
    val transitionType: TransitionType = TransitionType.CROSSFADE,
    val transitionDurationSec: Int = 3,
    val volume: Float = 1.0f,
    val missedSchedulePolicy: MissedSchedulePolicy = MissedSchedulePolicy.SKIP,
    val offlineFallbackPlaylistId: String? = null,
    val lastExecutedAt: Long? = null,
    val nextOccurrenceEpochMs: Long? = null
)

data class ScheduleExecutionRecord(
    val id: Long = 0,
    val scheduleId: String,
    val scheduleName: String,
    val executedAt: Long = System.currentTimeMillis(),
    val targetName: String,
    val success: Boolean,
    val statusMessage: String
)
