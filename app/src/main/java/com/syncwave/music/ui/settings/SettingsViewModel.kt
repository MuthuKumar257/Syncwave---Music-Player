package com.syncwave.music.ui.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.remote.ProfileStatsDto
import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.data.remote.UserPreferencesDto
import com.syncwave.music.data.repository.PreferencesRepository
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.playback.sync.PlaybackSessionCoordinator
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

data class LocalFolderItem(
    val uri: String,
    val name: String,
    val isDefault: Boolean
)

data class SettingsUiState(
    val isDarkMode: Boolean = true,
    val isCrossfadeEnabled: Boolean = true,
    val crossfadeDurationSec: Int = 3,
    val playbackSpeed: Float = 1.0f,
    val canScheduleExactAlarms: Boolean = true,
    val preferredLanguages: List<String> = listOf("Tamil", "Telugu", "Hindi"),
    val historyClearedMessage: String? = null,
    val profileStats: ProfileStatsDto? = null,
    val isAuthenticated: Boolean = false,
    val authUserEmail: String? = null,
    val authUserName: String? = null,
    val authProvider: String? = null,
    val localFolders: List<LocalFolderItem> = emptyList(),
    val defaultFolderUri: String? = null,
    val isScanningFolders: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val preferencesRepository: PreferencesRepository,
    private val musicRepository: MusicRepository,
    private val alarmScheduler: ScheduleAlarmScheduler,
    private val apiService: SyncWaveApiService,
    private val sessionCoordinator: PlaybackSessionCoordinator
) : ViewModel() {

    val deviceSessionState = sessionCoordinator.sessionState

    fun transferPlaybackToDevice(deviceId: String) {
        sessionCoordinator.transferToDevice(deviceId)
    }

    private val _historyClearedMessage = MutableStateFlow<String?>(null)
    private val _preferredLanguages = MutableStateFlow(listOf("Tamil", "Telugu", "Hindi"))
    private val _profileStats = MutableStateFlow<ProfileStatsDto?>(null)
    private val _isScanningFolders = MutableStateFlow(false)

    init {
        loadRemotePreferences()
        loadProfileStats()
    }

    fun loadProfileStats() {
        viewModelScope.launch {
            try {
                val res = apiService.getProfileStats()
                if (res.isSuccessful && res.body()?.success == true) {
                    _profileStats.value = res.body()?.stats
                }
            } catch (_: Exception) {}
        }
    }

    private fun loadRemotePreferences() {
        viewModelScope.launch {
            try {
                val res = apiService.getUserPreferences()
                if (res.isSuccessful && res.body()?.success == true) {
                    val langs = res.body()?.resolvePreferences()?.preferredLanguages
                    if (!langs.isNullOrEmpty()) {
                        _preferredLanguages.value = langs
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private data class AudioPreferences(
        val isDarkMode: Boolean,
        val isCrossfadeEnabled: Boolean,
        val crossfadeDurationSec: Int,
        val playbackSpeed: Float
    )

    private data class AuthSessionInfo(
        val isAuthenticated: Boolean,
        val email: String?,
        val name: String?,
        val provider: String?
    )

    private val authSessionFlow = combine(
        preferencesRepository.authToken,
        preferencesRepository.authUserEmail,
        preferencesRepository.authUserName,
        preferencesRepository.authProvider
    ) { token, email, name, provider ->
        AuthSessionInfo(
            isAuthenticated = !token.isNullOrBlank(),
            email = email,
            name = name,
            provider = provider
        )
    }

    private data class FolderPreferences(
        val folders: List<LocalFolderItem>,
        val defaultUri: String?,
        val isScanning: Boolean
    )

    private val folderPreferencesFlow = combine(
        preferencesRepository.musicFolderUris,
        preferencesRepository.defaultMusicFolderUri,
        _isScanningFolders
    ) { uris, defaultUri, isScanning ->
        val items = uris.sortedWith(compareByDescending<String> { it == defaultUri }.thenBy { it }).map { uri ->
            LocalFolderItem(
                uri = uri,
                name = musicRepository.getFolderDisplayName(uri),
                isDefault = uri == defaultUri
            )
        }
        FolderPreferences(items, defaultUri, isScanning)
    }

    private data class AuthAndFolders(
        val auth: AuthSessionInfo,
        val folders: FolderPreferences
    )

    val uiState: StateFlow<SettingsUiState> = combine(
        combine(
            preferencesRepository.isDarkMode,
            preferencesRepository.isCrossfadeEnabled,
            preferencesRepository.crossfadeDurationSec,
            preferencesRepository.playbackSpeed
        ) { darkMode, crossfadeEnabled, crossfadeSec, speed ->
            AudioPreferences(darkMode, crossfadeEnabled, crossfadeSec, speed)
        },
        _preferredLanguages,
        _historyClearedMessage,
        _profileStats,
        combine(authSessionFlow, folderPreferencesFlow) { auth, folders ->
            AuthAndFolders(auth, folders)
        }
    ) { audio, languages, message, stats, authAndFolders ->
        val auth = authAndFolders.auth
        val folders = authAndFolders.folders
        SettingsUiState(
            isDarkMode = audio.isDarkMode,
            isCrossfadeEnabled = audio.isCrossfadeEnabled,
            crossfadeDurationSec = audio.crossfadeDurationSec,
            playbackSpeed = audio.playbackSpeed,
            canScheduleExactAlarms = alarmScheduler.canScheduleExactAlarms(),
            preferredLanguages = languages,
            historyClearedMessage = message,
            profileStats = stats,
            isAuthenticated = auth.isAuthenticated,
            authUserEmail = auth.email,
            authUserName = auth.name,
            authProvider = auth.provider,
            localFolders = folders.folders,
            defaultFolderUri = folders.defaultUri,
            isScanningFolders = folders.isScanning
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = SettingsUiState()
    )

    fun toggleLanguage(lang: String) {
        val current = _preferredLanguages.value
        val updated = if (current.contains(lang)) {
            if (current.size <= 1) current else current.filter { it != lang }
        } else {
            current + lang
        }
        _preferredLanguages.value = updated
        viewModelScope.launch {
            try {
                apiService.updateUserPreferences(UserPreferencesDto(preferredLanguages = updated))
            } catch (_: Exception) {}
        }
    }

    fun resetPersonalization() {
        viewModelScope.launch {
            try {
                _preferredLanguages.value = listOf("Tamil")
                apiService.updateUserPreferences(UserPreferencesDto(preferredLanguages = listOf("Tamil"), favouriteArtists = emptyList()))
                _historyClearedMessage.value = "Personalized preferences successfully reset"
            } catch (_: Exception) {}
        }
    }

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

    fun signOut() {
        viewModelScope.launch {
            preferencesRepository.clearAuthSession()
            _historyClearedMessage.value = "Signed out of SyncWave account"
        }
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

    fun addMusicFolder(treeUri: Uri, makeDefault: Boolean) {
        viewModelScope.launch {
            _isScanningFolders.value = true
            val result = musicRepository.addMusicFolder(treeUri, makeDefault)
            _isScanningFolders.value = false
            result.fold(
                onSuccess = { count ->
                    _historyClearedMessage.value = "Folder saved • $count songs indexed"
                },
                onFailure = { error ->
                    _historyClearedMessage.value = "Folder scan failed: ${error.message}"
                }
            )
        }
    }

    fun setDefaultMusicFolder(treeUri: String) {
        viewModelScope.launch {
            musicRepository.setDefaultMusicFolder(treeUri)
            _historyClearedMessage.value = "Default music folder updated"
        }
    }

    fun removeMusicFolder(treeUri: String) {
        viewModelScope.launch {
            _isScanningFolders.value = true
            val result = musicRepository.removeMusicFolder(treeUri)
            _isScanningFolders.value = false
            result.fold(
                onSuccess = { count ->
                    _historyClearedMessage.value = "Folder removed • $count songs remaining"
                },
                onFailure = { error ->
                    _historyClearedMessage.value = "Failed to remove folder: ${error.message}"
                }
            )
        }
    }

    fun scanLocalMusic() {
        viewModelScope.launch {
            _isScanningFolders.value = true
            val result = musicRepository.scanLocalMusic()
            _isScanningFolders.value = false
            result.fold(
                onSuccess = { count ->
                    _historyClearedMessage.value = "Synchronized $count local songs"
                },
                onFailure = { error ->
                    _historyClearedMessage.value = "Sync failed: ${error.message}"
                }
            )
        }
    }
}
