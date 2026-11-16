package com.syncwave.music.scheduler.engine

import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.RepeatType
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object ScheduleOccurrenceCalculator {

    private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")
    private val DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    /**
     * Calculates the next epoch millis for when the schedule should trigger.
     * Returns null if the schedule has expired (e.g. past end date or one-time past).
     */
    fun calculateNextOccurrenceEpochMs(
        schedule: MusicSchedule,
        fromDateTime: LocalDateTime = LocalDateTime.now()
    ): Long? {
        if (!schedule.isEnabled) return null

        val startTime = try {
            LocalTime.parse(schedule.startTime, TIME_FORMATTER)
        } catch (_: Exception) {
            return null
        }

        val startDate = schedule.startDate?.let {
            try { LocalDate.parse(it, DATE_FORMATTER) } catch (_: Exception) { null }
        }
        val endDate = schedule.endDate?.let {
            try { LocalDate.parse(it, DATE_FORMATTER) } catch (_: Exception) { null }
        }

        // If fromDateTime is past the end date, schedule is expired
        if (endDate != null && fromDateTime.toLocalDate().isAfter(endDate)) {
            return null
        }

        var candidateDate = fromDateTime.toLocalDate()

        // If today is before startDate, jump to startDate
        if (startDate != null && candidateDate.isBefore(startDate)) {
            candidateDate = startDate
        }

        val candidateDateTime = LocalDateTime.of(candidateDate, startTime)

        val nextDateTime = when (schedule.repeatType) {
            RepeatType.ONCE -> {
                if (candidateDateTime.isAfter(fromDateTime)) {
                    candidateDateTime
                } else {
                    null // Expired one-time schedule
                }
            }

            RepeatType.DAILY -> {
                if (candidateDateTime.isAfter(fromDateTime)) {
                    candidateDateTime
                } else {
                    candidateDateTime.plusDays(1)
                }
            }

            RepeatType.WEEKDAYS -> {
                var dt = if (candidateDateTime.isAfter(fromDateTime)) candidateDateTime else candidateDateTime.plusDays(1)
                while (dt.dayOfWeek == DayOfWeek.SATURDAY || dt.dayOfWeek == DayOfWeek.SUNDAY) {
                    dt = dt.plusDays(1)
                }
                dt
            }

            RepeatType.CUSTOM_DAYS -> {
                if (schedule.daysOfWeek.isEmpty()) return null
                var dt = if (candidateDateTime.isAfter(fromDateTime)) candidateDateTime else candidateDateTime.plusDays(1)
                // Search up to 14 days ahead
                var found = false
                for (i in 0..14) {
                    val dayVal = dt.dayOfWeek.value // 1 = Monday ... 7 = Sunday
                    if (schedule.daysOfWeek.contains(dayVal)) {
                        found = true
                        break
                    }
                    dt = dt.plusDays(1)
                }
                if (found) dt else null
            }
        } ?: return null

        // Check if nextDateTime exceeds endDate
        if (endDate != null && nextDateTime.toLocalDate().isAfter(endDate)) {
            return null
        }

        return nextDateTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    }
}

