package com.syncwave.music.scheduler.engine

import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.PlaybackState
import com.syncwave.music.domain.model.SchedulePriority

enum class ConflictResolutionAction {
    EXECUTE_IMMEDIATELY,
    DEFER_UNTIL_CURRENT_TRACK_FINISHES,
    DEFER_UNTIL_CURRENT_PLAYLIST_FINISHES,
    IGNORE_CANDIDATE,
    DISMISS_CURRENT_AND_SWITCH
}

object ScheduleConflictResolver {

    /**
     * Resolves conflict between a candidate incoming schedule and the currently active playback/schedule.
     */
    fun resolveConflict(
        candidateSchedule: MusicSchedule,
        currentSchedule: MusicSchedule?,
        currentPlaybackState: PlaybackState,
        isUserManualOverride: Boolean = false
    ): ConflictResolutionAction {
        // Rule 5: Manual override always takes precedence over automated schedules
        if (isUserManualOverride) {
            return ConflictResolutionAction.IGNORE_CANDIDATE
        }

        // If no music is currently playing and no schedule active, execute immediately
        if (!currentPlaybackState.isPlaying && currentSchedule == null) {
            return ConflictResolutionAction.EXECUTE_IMMEDIATELY
        }

        // If a scheduled session is already active
        if (currentSchedule != null) {
            // Rule 1: Higher priority wins
            if (candidateSchedule.priority.level > currentSchedule.priority.level) {
                return ConflictResolutionAction.DISMISS_CURRENT_AND_SWITCH
            } else if (candidateSchedule.priority.level < currentSchedule.priority.level) {
                // Lower priority is ignored when higher is playing
                return ConflictResolutionAction.IGNORE_CANDIDATE
            }

            // Same priority: Rule 2: New schedule replaces existing playback
            return ConflictResolutionAction.DISMISS_CURRENT_AND_SWITCH
        }

        // If user was casually playing unmanaged music
        return when (candidateSchedule.priority) {
            SchedulePriority.URGENT, SchedulePriority.HIGH -> {
                ConflictResolutionAction.DISMISS_CURRENT_AND_SWITCH
            }
            SchedulePriority.NORMAL -> {
                ConflictResolutionAction.DISMISS_CURRENT_AND_SWITCH
            }
            SchedulePriority.LOW -> {
                // Low priority allows current track to finish smoothly before switching
                ConflictResolutionAction.DEFER_UNTIL_CURRENT_TRACK_FINISHES
            }
        }
    }
}
