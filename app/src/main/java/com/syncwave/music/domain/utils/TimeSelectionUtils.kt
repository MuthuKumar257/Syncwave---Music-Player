package com.syncwave.music.domain.utils

import java.time.Duration
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.Locale

object TimeSelectionUtils {
    val ALL_HOURS_12: List<Int> = (1..12).toList()
    val ALL_MINUTES: List<Int> = (0..59).toList()
    val ALL_SLEEP_MINUTES: List<Int> = (1..180).toList()

    fun to24Hour(hour12: Int, minute: Int, isPm: Boolean): Pair<Int, Int> {
        val clampedHour12 = hour12.coerceIn(1, 12)
        val clampedMinute = minute.coerceIn(0, 59)
        var hour24 = clampedHour12 % 12
        if (isPm) hour24 += 12
        return hour24 to clampedMinute
    }

    fun from24Hour(hour24: Int, minute: Int): Triple<Int, Int, Boolean> {
        val clampedHour24 = hour24.coerceIn(0, 23)
        val clampedMinute = minute.coerceIn(0, 59)
        val isPm = clampedHour24 >= 12
        val hour12 = (clampedHour24 % 12).let { if (it == 0) 12 else it }
        return Triple(hour12, clampedMinute, isPm)
    }

    fun formatTo12Hour(hour24: Int, minute: Int): String {
        val (hour12, clampedMinute, isPm) = from24Hour(hour24, minute)
        val period = if (isPm) "PM" else "AM"
        return String.format(Locale.US, "%02d:%02d %s", hour12, clampedMinute, period)
    }

    fun formatCanonical24Hour(hour24: Int, minute: Int): String {
        return String.format(Locale.US, "%02d:%02d", hour24.coerceIn(0, 23), minute.coerceIn(0, 59))
    }

    fun calculateDelayMsUntilTime(
        hour24: Int,
        minute: Int,
        now: LocalDateTime = LocalDateTime.now()
    ): Long {
        val targetTime = LocalTime.of(hour24.coerceIn(0, 23), minute.coerceIn(0, 59))
        var targetDateTime = now.toLocalDate().atTime(targetTime)
        if (!targetDateTime.isAfter(now)) {
            targetDateTime = targetDateTime.plusDays(1)
        }
        return Duration.between(now, targetDateTime).toMillis().coerceAtLeast(1000L)
    }

    fun formatCountdown(remainingMs: Long): String {
        val totalSec = (remainingMs.coerceAtLeast(0L) + 999L) / 1000L
        val hours = totalSec / 3600L
        val mins = (totalSec % 3600L) / 60L
        val secs = totalSec % 60L
        return if (hours > 0L) {
            String.format(Locale.US, "%d:%02d:%02d", hours, mins, secs)
        } else {
            String.format(Locale.US, "%d:%02d", mins, secs)
        }
    }
}
