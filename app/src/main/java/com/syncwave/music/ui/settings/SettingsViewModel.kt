package com.syncwave.music.ui.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.repository.PreferencesRepository
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.scheduler.engine.ScheduleAlarmScheduler
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val isDarkMode: Boolean = true,
    val isCrossfadeEnabled: Boolean = true,
    val crossfadeDurationSec: Int = 3,
    val playbackSpeed: Float = 1.0f,
    val canScheduleExactAlarms: Boolean = true,
    val historyClearedMessage: String? = null
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val preferencesRepository: PreferencesRepository,
    private val musicRepository: MusicRepository,
    private val alarmScheduler: ScheduleAlarmScheduler
) : ViewModel() {

    private val _historyClearedMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<SettingsUiState> = combine(
        preferencesRepository.isDarkMode,
        preferencesRepository.isCrossfadeEnabled,
        preferencesRepository.crossfadeDurationSec,
        preferencesRepository.playbackSpeed,
        _historyClearedMessage
    ) { darkMode, crossfadeEnabled, crossfadeSec, speed, message ->
        SettingsUiState(
            isDarkMode = darkMode,
            isCrossfadeEnabled = crossfadeEnabled,
            crossfadeDurationSec = crossfadeSec,
            playbackSpeed = speed,
            canScheduleExactAlarms = alarmScheduler.canScheduleExactAlarms(),
            historyClearedMessage = message
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = SettingsUiState()
    )

    fun setDarkMode(enabled: Boolean) {
        viewModelScope.launch {
            preferencesRepository.setDarkMode(enabled)
        }
    }

    fun setCrossfadeEnabled(enabled: Boolean) {
        viewModelScope.launch {
            preferencesRepository.setCrossfadeEnabled(enabled)
        }
    }

    fun setCrossfadeDuration(seconds: Int) {
        viewModelScope.launch {
            preferencesRepository.setCrossfadeDuration(seconds)
        }
    }

    fun setPlaybackSpeed(speed: Float) {
        viewModelScope.launch {
            preferencesRepository.setPlaybackSpeed(speed)
        }
    }

    fun clearListeningHistory() {
        viewModelScope.launch {
            musicRepository.clearHistory()
            _historyClearedMessage.value = "Listening history successfully cleared"
        }
    }

    fun clearMessage() {
        _historyClearedMessage.value = null
    }

    fun openExactAlarmSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${context.packageName}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            } catch (_: Exception) {}
        }
    }
}
