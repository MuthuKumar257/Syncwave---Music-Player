package com.syncwave.music.data.repository

import com.syncwave.music.data.local.dao.PlaylistDao
import com.syncwave.music.data.local.dao.ScheduleDao
import com.syncwave.music.data.local.entity.PlaylistEntity
import com.syncwave.music.data.remote.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SyncRepository @Inject constructor(
    private val apiService: SyncWaveApiService,
    private val playlistDao: PlaylistDao,
    private val scheduleDao: ScheduleDao,
    private val preferencesRepository: PreferencesRepository
) {

    suspend fun login(email: String, pass: String): Result<UserDto> {
        return try {
            val response = apiService.login(LoginRequest(email, pass))
            if (response.isSuccessful && response.body()?.success == true) {
                val token = response.body()?.token
                val user = response.body()?.user
                if (token != null && user != null) {
                    Result.success(user)
                } else {
                    Result.failure(Exception("Missing token in response"))
                }
            } else {
                Result.failure(Exception("Authentication failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(email: String, pass: String, name: String): Result<UserDto> {
        return try {
            val response = apiService.register(RegisterRequest(email, pass, name))
            if (response.isSuccessful && response.body()?.success == true) {
                val user = response.body()?.user
                if (user != null) {
                    Result.success(user)
                } else {
                    Result.failure(Exception("Missing user data"))
                }
            } else {
                Result.failure(Exception("Registration failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncPlaylists(token: String): Result<Int> {
        return try {
            val response = apiService.getPlaylists("Bearer $token")
            if (response.isSuccessful && response.body()?.success == true) {
                val cloudPlaylists = response.body()?.data ?: emptyList()
                for (cp in cloudPlaylists) {
                    val local = playlistDao.getPlaylistById(cp.id)
                    if (local == null) {
                        playlistDao.insertPlaylist(
                            PlaylistEntity(
                                id = cp.id,
                                name = cp.name,
                                artworkUri = cp.artworkUrl,
                                songCount = cp.songCount
                            )
                        )
                    }
                }
                Result.success(cloudPlaylists.size)
            } else {
                Result.failure(Exception("Playlists sync failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logScheduleExecution(token: String, scheduleId: String, message: String): Result<Unit> {
        return try {
            val response = apiService.logExecution(
                token = "Bearer $token",
                scheduleId = scheduleId,
                log = ExecutionLogRequest(
                    success = true,
                    statusMessage = message,
                    clientPlatform = "ANDROID"
                )
            )
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Log execution response code ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

