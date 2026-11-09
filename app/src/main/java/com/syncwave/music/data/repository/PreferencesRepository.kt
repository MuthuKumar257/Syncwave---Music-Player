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
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

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
    }
}
