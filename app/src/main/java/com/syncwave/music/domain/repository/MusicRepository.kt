package com.syncwave.music.domain.repository

import android.net.Uri
import com.syncwave.music.data.remote.UnifiedTrackDto
import com.syncwave.music.domain.model.Album
import com.syncwave.music.domain.model.Artist
import com.syncwave.music.domain.model.PlayHistory
import com.syncwave.music.domain.model.Song
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow

enum class DownloadStatus {
    CHECKING,
    DOWNLOADING,
    PAUSED,
    VALIDATING,
    COMPLETED,
    FAILED
}

data class DownloadTaskInfo(
    val trackId: String,
    val title: String,
    val artist: String,
    val artworkUrl: String? = null,
    val status: DownloadStatus,
    val bytesDownloaded: Long = 0L,
    val totalBytes: Long = 0L,
    val expectedDurationMs: Long = 0L,
    val fileFormat: String = "MP3",
    val partFilePath: String = "",
    val downloadUrl: String = "",
    val supportsRange: Boolean = true,
    val errorMessage: String? = null
) {
    val progressFraction: Float
        get() = if (totalBytes > 0L) (bytesDownloaded.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f) else 0f
}

interface MusicRepository {
    fun getAllSongs(): Flow<List<Song>>
    fun getRecentlyAddedSongs(): Flow<List<Song>>
    fun getFavoriteSongs(): Flow<List<Song>>
    fun getRecentlyPlayedSongs(limit: Int = 20): Flow<List<Song>>
    fun searchSongs(query: String): Flow<List<Song>>
    fun getAllAlbums(): Flow<List<Album>>
    fun getAllArtists(): Flow<List<Artist>>
    fun getSongsByAlbum(album: String): Flow<List<Song>>
    fun getSongsByArtist(artist: String): Flow<List<Song>>
    suspend fun getSongById(id: String): Song?
    suspend fun setFavorite(id: String, isFavorite: Boolean)
    suspend fun recordPlayHistory(songId: String, songTitle: String, artistName: String, durationMs: Long, completed: Boolean)
    suspend fun clearHistory()
    val downloadTasks: StateFlow<Map<String, DownloadTaskInfo>>
    suspend fun scanLocalMusic(): Result<Int>
    suspend fun addMusicFolder(treeUri: Uri, makeDefault: Boolean): Result<Int>
    suspend fun setDefaultMusicFolder(treeUri: String)
    suspend fun removeMusicFolder(treeUri: String): Result<Int>
    fun getFolderDisplayName(treeUri: String): String
    suspend fun downloadTrackToSongsFolder(track: UnifiedTrackDto): Result<Song>
    suspend fun pauseDownload(trackId: String)
    suspend fun resumeDownload(trackId: String): Result<Song>
    suspend fun cancelDownload(trackId: String)
    suspend fun getAutoQueueRecommendations(
        songId: String,
        songTitle: String?,
        artist: String?,
        director: String?,
        language: String?,
        genre: String?,
        mood: String?,
        excludeIds: List<String>,
        limit: Int = 12
    ): List<Song>
}

