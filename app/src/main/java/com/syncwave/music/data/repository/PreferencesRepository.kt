package com.syncwave.music.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.syncwave.music.data.remote.SessionTrackDto
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

data class PersistedPlaybackSessionDto(
    val lastPlayedSongId: String?,
    val currentSong: SessionTrackDto?,
    val positionMs: Long,
    val isPlaying: Boolean,
    val queue: List<SessionTrackDto>,
    val queueIndex: Int,
    val sessionPlayedSongIds: List<String>,
    val isShuffle: Boolean,
    val repeatMode: String,
    val volume: Float = 0.85f,
    val playbackSpeed: Float = 1.0f,
    val savedAt: Long = System.currentTimeMillis()
)

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "syncwave_settings")

@Singleton
class PreferencesRepository @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val dataStore = context.dataStore

    val isDarkMode: Flow<Boolean> = dataStore.data.map { preferences ->
        preferences[KEY_DARK_MODE] ?: true
    }

    val crossfadeDurationSec: Flow<Int> = dataStore.data.map { preferences ->
        preferences[KEY_CROSSFADE_DURATION] ?: 3
    }

    val isCrossfadeEnabled: Flow<Boolean> = dataStore.data.map { preferences ->
        preferences[KEY_CROSSFADE_ENABLED] ?: true
    }

    val playbackSpeed: Flow<Float> = dataStore.data.map { preferences ->
        preferences[KEY_PLAYBACK_SPEED] ?: 1.0f
    }

    val lastPlayedSongId: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_LAST_SONG_ID]
    }

    val lastPositionMs: Flow<Long> = dataStore.data.map { preferences ->
        preferences[KEY_LAST_POSITION_MS] ?: 0L
    }

    val hasCompletedOnboarding: Flow<Boolean> = dataStore.data.map { preferences ->
        preferences[KEY_ONBOARDING_COMPLETED] ?: false
    }

    val authToken: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_AUTH_TOKEN]
    }

    val authUserEmail: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_AUTH_USER_EMAIL]
    }

    val authUserName: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_AUTH_USER_NAME]
    }

    val authProvider: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_AUTH_PROVIDER]
    }

    val defaultMusicFolderUri: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_DEFAULT_MUSIC_FOLDER_URI]
    }

    val musicFolderUris: Flow<Set<String>> = dataStore.data.map { preferences ->
        preferences[KEY_MUSIC_FOLDER_URIS] ?: emptySet()
    }

    val hasPromptedDefaultFolder: Flow<Boolean> = dataStore.data.map { preferences ->
        preferences[KEY_DEFAULT_FOLDER_PROMPTED] ?: false
    }

    suspend fun addMusicFolderUri(uri: String, makeDefault: Boolean) {
        dataStore.edit { preferences ->
            val current = (preferences[KEY_MUSIC_FOLDER_URIS] ?: emptySet()).toMutableSet()
            current.add(uri)
            preferences[KEY_MUSIC_FOLDER_URIS] = current
            if (makeDefault || preferences[KEY_DEFAULT_MUSIC_FOLDER_URI].isNullOrBlank()) {
                preferences[KEY_DEFAULT_MUSIC_FOLDER_URI] = uri
            }
            preferences[KEY_DEFAULT_FOLDER_PROMPTED] = true
        }
    }

    suspend fun setDefaultMusicFolderUri(uri: String) {
        dataStore.edit { preferences ->
            val current = (preferences[KEY_MUSIC_FOLDER_URIS] ?: emptySet()).toMutableSet()
            current.add(uri)
            preferences[KEY_MUSIC_FOLDER_URIS] = current
            preferences[KEY_DEFAULT_MUSIC_FOLDER_URI] = uri
        }
    }

    suspend fun removeMusicFolderUri(uri: String) {
        dataStore.edit { preferences ->
            val current = (preferences[KEY_MUSIC_FOLDER_URIS] ?: emptySet()).toMutableSet()
            current.remove(uri)
            preferences[KEY_MUSIC_FOLDER_URIS] = current
            if (preferences[KEY_DEFAULT_MUSIC_FOLDER_URI] == uri) {
                if (current.isNotEmpty()) {
                    preferences[KEY_DEFAULT_MUSIC_FOLDER_URI] = current.first()
                } else {
                    preferences.remove(KEY_DEFAULT_MUSIC_FOLDER_URI)
                }
            }
        }
    }

    suspend fun setDefaultFolderPrompted(prompted: Boolean) {
        dataStore.edit { preferences ->
            preferences[KEY_DEFAULT_FOLDER_PROMPTED] = prompted
        }
    }

    suspend fun saveAuthSession(
        token: String,
        userId: String,
        email: String,
        displayName: String,
        provider: String
    ) {
        dataStore.edit { preferences ->
            preferences[KEY_AUTH_TOKEN] = token
            preferences[KEY_AUTH_USER_ID] = userId
            preferences[KEY_AUTH_USER_EMAIL] = email
            preferences[KEY_AUTH_USER_NAME] = displayName
            preferences[KEY_AUTH_PROVIDER] = provider
        }
    }

    suspend fun clearAuthSession() {
        dataStore.edit { preferences ->
            preferences.remove(KEY_AUTH_TOKEN)
            preferences.remove(KEY_AUTH_USER_ID)
            preferences.remove(KEY_AUTH_USER_EMAIL)
            preferences.remove(KEY_AUTH_USER_NAME)
            preferences.remove(KEY_AUTH_PROVIDER)
        }
    }

    suspend fun getOrCreateDeviceId(): String {
        val current = dataStore.data.first()[KEY_DEVICE_ID]
        if (!current.isNullOrBlank()) return current
        val generated = "android_${UUID.randomUUID()}"
        dataStore.edit { preferences ->
            preferences[KEY_DEVICE_ID] = generated
        }
        return generated
    }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        dataStore.edit { preferences ->
            preferences[KEY_ONBOARDING_COMPLETED] = completed
        }
    }

    suspend fun setDarkMode(enabled: Boolean) {
        dataStore.edit { preferences ->
            preferences[KEY_DARK_MODE] = enabled
        }
    }

    suspend fun setCrossfadeDuration(seconds: Int) {
        dataStore.edit { preferences ->
            preferences[KEY_CROSSFADE_DURATION] = seconds
        }
    }

    suspend fun setCrossfadeEnabled(enabled: Boolean) {
        dataStore.edit { preferences ->
            preferences[KEY_CROSSFADE_ENABLED] = enabled
        }
    }

    suspend fun setPlaybackSpeed(speed: Float) {
        dataStore.edit { preferences ->
            preferences[KEY_PLAYBACK_SPEED] = speed
        }
    }

    val playbackSessionJson: Flow<String?> = dataStore.data.map { preferences ->
        preferences[KEY_PLAYBACK_SESSION_JSON]
    }

    suspend fun savePlaybackSessionJson(json: String, songId: String?, positionMs: Long) {
        dataStore.edit { preferences ->
            preferences[KEY_PLAYBACK_SESSION_JSON] = json
            if (!songId.isNullOrBlank()) {
                preferences[KEY_LAST_SONG_ID] = songId
            }
            preferences[KEY_LAST_POSITION_MS] = positionMs
        }
    }

    suspend fun getPlaybackSessionJson(): String? {
        return dataStore.data.first()[KEY_PLAYBACK_SESSION_JSON]
    }

    suspend fun saveLastPlaybackState(songId: String, positionMs: Long) {
        dataStore.edit { preferences ->
            preferences[KEY_LAST_SONG_ID] = songId
            preferences[KEY_LAST_POSITION_MS] = positionMs
        }
    }

    companion object {
        private val KEY_DARK_MODE = booleanPreferencesKey("dark_mode")
        private val KEY_CROSSFADE_DURATION = intPreferencesKey("crossfade_duration")
        private val KEY_CROSSFADE_ENABLED = booleanPreferencesKey("crossfade_enabled")
        private val KEY_PLAYBACK_SPEED = floatPreferencesKey("playback_speed")
        private val KEY_LAST_SONG_ID = stringPreferencesKey("last_song_id")
        private val KEY_LAST_POSITION_MS = longPreferencesKey("last_position_ms")
        private val KEY_ONBOARDING_COMPLETED = booleanPreferencesKey("onboarding_completed")
        private val KEY_AUTH_TOKEN = stringPreferencesKey("auth_token")
        private val KEY_AUTH_USER_ID = stringPreferencesKey("auth_user_id")
        private val KEY_AUTH_USER_EMAIL = stringPreferencesKey("auth_user_email")
        private val KEY_AUTH_USER_NAME = stringPreferencesKey("auth_user_name")
        private val KEY_AUTH_PROVIDER = stringPreferencesKey("auth_provider")
        private val KEY_DEVICE_ID = stringPreferencesKey("device_id")
        private val KEY_DEFAULT_MUSIC_FOLDER_URI = stringPreferencesKey("default_music_folder_uri")
        private val KEY_MUSIC_FOLDER_URIS = stringSetPreferencesKey("music_folder_uris")
        private val KEY_DEFAULT_FOLDER_PROMPTED = booleanPreferencesKey("default_folder_prompted")
        private val KEY_PLAYBACK_SESSION_JSON = stringPreferencesKey("playback_session_json")
    }
}

