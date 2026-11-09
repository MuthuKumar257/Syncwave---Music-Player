package com.syncwave.music.scheduler.engine

import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.RepeatType
import com.syncwave.music.domain.model.SchedulePriority
import com.syncwave.music.domain.model.ScheduleTargetType
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

class ScheduleOccurrenceCalculatorTest {

    @Test
    fun calculateNextOccurrence_dailyFutureToday() {
        val schedule = MusicSchedule(
            id = "s1",
            name = "Morning",
            startTime = "10:00",
            repeatType = RepeatType.DAILY,
            targetType = ScheduleTargetType.PLAYLIST,
            targetId = "pl1",
            targetName = "Morning Routine",
            isEnabled = true
        )

        val from = LocalDateTime.of(2026, 11, 9, 8, 0)
        val epochMs = ScheduleOccurrenceCalculator.calculateNextOccurrenceEpochMs(schedule, from)

        assertNotNull(epochMs)
        val expected = LocalDateTime.of(2026, 11, 9, 10, 0)
            .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        assertTrue(epochMs == expected)
    }

    @Test
    fun calculateNextOccurrence_dailyPastToday_triggersTomorrow() {
        val schedule = MusicSchedule(
            id = "s1",
            name = "Evening",
            startTime = "06:00",
            repeatType = RepeatType.DAILY,
            targetType = ScheduleTargetType.PLAYLIST,
            targetId = "pl1",
            targetName = "Morning Devotional",
            isEnabled = true
        )

        val from = LocalDateTime.of(2026, 11, 9, 14, 0) // 2:00 PM today
        val epochMs = ScheduleOccurrenceCalculator.calculateNextOccurrenceEpochMs(schedule, from)

        assertNotNull(epochMs)
        val expected = LocalDateTime.of(2026, 11, 10, 6, 0) // 6:00 AM tomorrow
            .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        assertTrue(epochMs == expected)
    }

    @Test
    fun calculateNextOccurrence_weekdays_skipsWeekend() {
        val schedule = MusicSchedule(
            id = "s1",
            name = "Work Focus",
            startTime = "09:00",
            repeatType = RepeatType.WEEKDAYS,
            targetType = ScheduleTargetType.PLAYLIST,
            targetId = "pl1",
            targetName = "Focus Flow",
            isEnabled = true
        )

        // Friday 2026-11-13 at 10:00 AM (past 9 AM)
        val friday = LocalDateTime.of(2026, 11, 13, 10, 0)
        val epochMs = ScheduleOccurrenceCalculator.calculateNextOccurrenceEpochMs(schedule, friday)

        assertNotNull(epochMs)
        // Should skip Sat 14 and Sun 15, and trigger on Monday 16 at 09:00 AM
        val expected = LocalDateTime.of(2026, 11, 16, 9, 0)
            .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        assertTrue(epochMs == expected)
    }

    @Test
    fun calculateNextOccurrence_disabledSchedule_returnsNull() {
        val schedule = MusicSchedule(
            id = "s1",
            name = "Disabled Routine",
            startTime = "09:00",
            repeatType = RepeatType.DAILY,
            targetType = ScheduleTargetType.PLAYLIST,
            targetId = "pl1",
            targetName = "Focus Flow",
            isEnabled = false
        )

        val from = LocalDateTime.of(2026, 11, 9, 8, 0)
        val epochMs = ScheduleOccurrenceCalculator.calculateNextOccurrenceEpochMs(schedule, from)

        assertNull(epochMs)
    }
}
