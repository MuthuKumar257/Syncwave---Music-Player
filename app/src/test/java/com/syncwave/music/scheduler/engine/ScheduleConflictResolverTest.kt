package com.syncwave.music.scheduler.engine

import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.PlaybackState
import com.syncwave.music.domain.model.RepeatType
import com.syncwave.music.domain.model.SchedulePriority
import com.syncwave.music.domain.model.ScheduleTargetType
import com.syncwave.music.domain.model.Song
import org.junit.Assert.assertEquals
import org.junit.Test

class ScheduleConflictResolverTest {

    private fun createSchedule(
        id: String,
        name: String,
        priority: SchedulePriority,
        startTime: String = "08:00"
    ): MusicSchedule {
        return MusicSchedule(
            id = id,
            name = name,
            startTime = startTime,
            repeatType = RepeatType.DAILY,
            targetType = ScheduleTargetType.PLAYLIST,
            targetId = "pl_$id",
            targetName = name,
            priority = priority
        )
    }

    @Test
    fun manualOverride_ignoresCandidate() {
        val candidate = createSchedule("c1", "Workout", SchedulePriority.HIGH)
        val current = createSchedule("c0", "Devotional", SchedulePriority.NORMAL)
        val playback = PlaybackState(isPlaying = true)

        val result = ScheduleConflictResolver.resolveConflict(
            candidateSchedule = candidate,
            currentSchedule = current,
            currentPlaybackState = playback,
            isUserManualOverride = true
        )

        assertEquals(ConflictResolutionAction.IGNORE_CANDIDATE, result)
    }

    @Test
    fun higherPriorityWins_dismissCurrentAndSwitch() {
        val candidate = createSchedule("c1", "Urgent Alarm", SchedulePriority.URGENT)
        val current = createSchedule("c0", "Background Music", SchedulePriority.LOW)
        val playback = PlaybackState(isPlaying = true)

        val result = ScheduleConflictResolver.resolveConflict(
            candidateSchedule = candidate,
            currentSchedule = current,
            currentPlaybackState = playback,
            isUserManualOverride = false
        )

        assertEquals(ConflictResolutionAction.DISMISS_CURRENT_AND_SWITCH, result)
    }

    @Test
    fun lowerPriorityCandidate_isIgnoredWhenHigherIsPlaying() {
        val candidate = createSchedule("c1", "Low Priority Routine", SchedulePriority.LOW)
        val current = createSchedule("c0", "Important Focus", SchedulePriority.HIGH)
        val playback = PlaybackState(isPlaying = true)

        val result = ScheduleConflictResolver.resolveConflict(
            candidateSchedule = candidate,
            currentSchedule = current,
            currentPlaybackState = playback,
            isUserManualOverride = false
        )

        assertEquals(ConflictResolutionAction.IGNORE_CANDIDATE, result)
    }

    @Test
    fun idlePlayback_executesCandidateImmediately() {
        val candidate = createSchedule("c1", "Morning Devotional", SchedulePriority.NORMAL)
        val playback = PlaybackState(isPlaying = false)

        val result = ScheduleConflictResolver.resolveConflict(
            candidateSchedule = candidate,
            currentSchedule = null,
            currentPlaybackState = playback,
            isUserManualOverride = false
        )

        assertEquals(ConflictResolutionAction.EXECUTE_IMMEDIATELY, result)
    }
}

