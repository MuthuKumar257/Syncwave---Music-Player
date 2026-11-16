package com.syncwave.music.ui.scheduler

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.domain.model.MissedSchedulePolicy
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.model.RepeatType
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import com.syncwave.music.domain.model.SchedulePriority
import com.syncwave.music.domain.model.ScheduleTargetType
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.model.TransitionType
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.repository.PlaylistRepository
import com.syncwave.music.domain.repository.ScheduleRepository
import com.syncwave.music.domain.utils.TimeSelectionUtils
import com.syncwave.music.scheduler.engine.ScheduleAlarmScheduler
import com.syncwave.music.scheduler.engine.ScheduleOccurrenceCalculator
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class SchedulerDashboardUiState(
    val schedules: List<MusicSchedule> = emptyList(),
    val nextSchedule: MusicSchedule? = null,
    val executionHistory: List<ScheduleExecutionRecord> = emptyList(),
    val canScheduleExactAlarms: Boolean = true
)

data class ScheduleFormState(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val timeHour: Int = 8,
    val timeMinute: Int = 0,
    val repeatType: RepeatType = RepeatType.DAILY,
    val selectedDays: List<Int> = listOf(1, 2, 3, 4, 5), // Mon - Fri
    val targetType: ScheduleTargetType = ScheduleTargetType.PLAYLIST,
    val targetId: String = "",
    val targetName: String = "",
    val priority: SchedulePriority = SchedulePriority.NORMAL,
    val transitionType: TransitionType = TransitionType.CROSSFADE,
    val transitionSec: Int = 3,
    val volume: Float = 0.8f,
    val availablePlaylists: List<Playlist> = emptyList(),
    val availableSongs: List<Song> = emptyList(),
    val isSaving: Boolean = false,
    val saveSuccess: Boolean = false,
    val errorMessage: String? = null,
    val formVersion: Long = 0L
)

@HiltViewModel
class SchedulerViewModel @Inject constructor(
    private val scheduleRepository: ScheduleRepository,
    private val playlistRepository: PlaylistRepository,
    private val musicRepository: MusicRepository,
    private val alarmScheduler: ScheduleAlarmScheduler
) : ViewModel() {

    val dashboardState: StateFlow<SchedulerDashboardUiState> = combine(
        scheduleRepository.getAllSchedules(),
        scheduleRepository.getExecutionHistory(30)
    ) { schedules, history ->
        val next = schedules.filter { it.isEnabled }
            .minByOrNull { it.nextOccurrenceEpochMs ?: Long.MAX_VALUE }

        SchedulerDashboardUiState(
            schedules = schedules,
            nextSchedule = next,
            executionHistory = history,
            canScheduleExactAlarms = alarmScheduler.canScheduleExactAlarms()
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = SchedulerDashboardUiState()
    )

    private val _formState = MutableStateFlow(ScheduleFormState())
    val formState: StateFlow<ScheduleFormState> = _formState

    init {
        loadAvailableTargets()
    }

    private fun loadAvailableTargets() {
        viewModelScope.launch {
            combine(
                playlistRepository.getAllPlaylists(),
                musicRepository.getAllSongs()
            ) { playlists, songs ->
                playlists to songs
            }.collect { (playlists, songs) ->
                _formState.value = _formState.value.copy(
                    availablePlaylists = playlists,
                    availableSongs = songs,
                    targetId = if (_formState.value.targetId.isEmpty()) {
                        playlists.firstOrNull()?.id ?: songs.firstOrNull()?.id ?: ""
                    } else _formState.value.targetId,
                    targetName = if (_formState.value.targetName.isEmpty()) {
                        playlists.firstOrNull()?.name ?: songs.firstOrNull()?.title ?: ""
                    } else _formState.value.targetName
                )
            }
        }
    }

    fun loadScheduleForEditing(scheduleId: String) {
        viewModelScope.launch {
            val schedule = scheduleRepository.getScheduleById(scheduleId) ?: return@launch
            val parts = schedule.startTime.split(":")
            val hour = parts.getOrNull(0)?.toIntOrNull() ?: 8
            val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0

            _formState.value = _formState.value.copy(
                id = schedule.id,
                name = schedule.name,
                timeHour = hour.coerceIn(0, 23),
                timeMinute = minute.coerceIn(0, 59),
                repeatType = schedule.repeatType,
                selectedDays = schedule.daysOfWeek,
                targetType = schedule.targetType,
                targetId = schedule.targetId,
                targetName = schedule.targetName,
                priority = schedule.priority,
                transitionType = schedule.transitionType,
                transitionSec = schedule.transitionDurationSec,
                volume = schedule.volume,
                formVersion = _formState.value.formVersion + 1L
            )
        }
    }

    fun resetForm() {
        _formState.value = ScheduleFormState(
            availablePlaylists = _formState.value.availablePlaylists,
            availableSongs = _formState.value.availableSongs,
            formVersion = _formState.value.formVersion + 1L
        )
    }

    fun updateForm(transform: (ScheduleFormState) -> ScheduleFormState) {
        _formState.value = transform(_formState.value)
    }

    fun createAndSelectPlaylist(name: String) {
        viewModelScope.launch {
            if (name.isBlank()) return@launch
            val playlist = playlistRepository.createPlaylist(name.trim())
            _formState.value = _formState.value.copy(
                targetType = ScheduleTargetType.PLAYLIST,
                targetId = playlist.id,
                targetName = playlist.name
            )
        }
    }

    fun toggleScheduleEnabled(schedule: MusicSchedule, isEnabled: Boolean) {
        viewModelScope.launch {
            val updated = schedule.copy(isEnabled = isEnabled)
            scheduleRepository.setScheduleEnabled(schedule.id, isEnabled)
            if (isEnabled) {
                alarmScheduler.scheduleAlarm(updated)
            } else {
                alarmScheduler.cancelAlarm(schedule.id)
            }
        }
    }

    fun deleteSchedule(scheduleId: String) {
        viewModelScope.launch {
            alarmScheduler.cancelAlarm(scheduleId)
            scheduleRepository.deleteSchedule(scheduleId)
        }
    }

    fun saveSchedule() {
        val current = _formState.value
        if (current.name.isBlank()) {
            _formState.value = current.copy(errorMessage = "Please enter a schedule name")
            return
        }
        if (current.targetId.isBlank()) {
            _formState.value = current.copy(errorMessage = "Please select a playlist or song")
            return
        }

        viewModelScope.launch {
            _formState.value = current.copy(isSaving = true, errorMessage = null)
            val startTimeStr = TimeSelectionUtils.formatCanonical24Hour(current.timeHour, current.timeMinute)

            val schedule = MusicSchedule(
                id = current.id,
                name = current.name.trim(),
                startTime = startTimeStr,
                repeatType = current.repeatType,
                daysOfWeek = current.selectedDays,
                targetType = current.targetType,
                targetId = current.targetId,
                targetName = current.targetName,
                priority = current.priority,
                isEnabled = true,
                transitionType = current.transitionType,
                transitionDurationSec = current.transitionSec,
                volume = current.volume,
                missedSchedulePolicy = MissedSchedulePolicy.SKIP
            )

            scheduleRepository.saveSchedule(schedule)
            alarmScheduler.scheduleAlarm(schedule)

            _formState.value = current.copy(isSaving = false, saveSuccess = true)
        }
    }
}

