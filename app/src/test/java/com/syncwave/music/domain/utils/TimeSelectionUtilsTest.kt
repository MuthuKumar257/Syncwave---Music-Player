package com.syncwave.music.domain.utils

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime

class TimeSelectionUtilsTest {

    @Test
    fun `ALL_MINUTES contains every minute from 0 to 59 without skipping`() {
        assertEquals(60, TimeSelectionUtils.ALL_MINUTES.size)
        for (m in 0..59) {
            assertEquals(m, TimeSelectionUtils.ALL_MINUTES[m])
        }
    }

    @Test
    fun `ALL_SLEEP_MINUTES contains every 1-minute step from 1 to 180`() {
        assertEquals(180, TimeSelectionUtils.ALL_SLEEP_MINUTES.size)
        assertEquals(1, TimeSelectionUtils.ALL_SLEEP_MINUTES.first())
        assertEquals(7, TimeSelectionUtils.ALL_SLEEP_MINUTES[6])
        assertEquals(180, TimeSelectionUtils.ALL_SLEEP_MINUTES.last())
    }

    @Test
    fun `to24Hour from24Hour and formatting preserve every minute without rounding or snapping`() {
        for (m in 0..59) {
            val (h24, min) = TimeSelectionUtils.to24Hour(10, m, isPm = false)
            assertEquals(10, h24)
            assertEquals(m, min)

            val (parsedH12, parsedMin, isPm) = TimeSelectionUtils.from24Hour(h24, min)
            assertEquals(10, parsedH12)
            assertEquals(m, parsedMin)
            assertEquals(false, isPm)

            val padded = m.toString().padStart(2, '0')
            assertEquals("10:$padded", TimeSelectionUtils.formatCanonical24Hour(h24, min))
            assertEquals("10:$padded AM", TimeSelectionUtils.formatTo12Hour(h24, min))
        }

        assertEquals("00:03", TimeSelectionUtils.formatCanonical24Hour(0, 3))
        assertEquals("12:03 AM", TimeSelectionUtils.formatTo12Hour(0, 3))
        assertEquals("23:59", TimeSelectionUtils.formatCanonical24Hour(23, 59))
        assertEquals("11:59 PM", TimeSelectionUtils.formatTo12Hour(23, 59))
    }

    @Test
    fun `calculateDelayMsUntilTime schedules exact 1-minute stop time`() {
        val now = LocalDateTime.of(2026, 11, 12, 10, 0, 0)
        // Target 10:03 AM -> exact 3 minutes = 180_000 ms
        val delay3Min = TimeSelectionUtils.calculateDelayMsUntilTime(10, 3, now)
        assertEquals(180_000L, delay3Min)

        // Target 09:59 AM -> next day (23h 59m)
        val delayNextDay = TimeSelectionUtils.calculateDelayMsUntilTime(9, 59, now)
        assertEquals((23L * 60L + 59L) * 60_000L, delayNextDay)
    }

    @Test
    fun `formatCountdown displays exact mm ss and hh mm ss`() {
        assertEquals("7:00", TimeSelectionUtils.formatCountdown(420_000L))
        assertEquals("1:01", TimeSelectionUtils.formatCountdown(61_000L))
        assertEquals("1:02:03", TimeSelectionUtils.formatCountdown(3_723_000L))
    }
}
