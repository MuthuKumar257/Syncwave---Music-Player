package com.syncwave.music.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.syncwave.music.data.local.entity.DownloadTaskEntity
import com.syncwave.music.data.local.entity.FavoriteEntity
import com.syncwave.music.data.local.entity.PlayHistoryEntity
import com.syncwave.music.data.local.entity.SongEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface HistoryAndFavoritesDao {
    // Play History
    @Query("SELECT * FROM play_history ORDER BY playedAt DESC LIMIT :limit")
    fun getRecentHistory(limit: Int = 50): Flow<List<PlayHistoryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlayHistory(history: PlayHistoryEntity)

    @Query("""
        SELECT s.* FROM songs s
        INNER JOIN (
            SELECT songId, MAX(playedAt) as maxPlayedAt 
            FROM play_history 
            GROUP BY songId 
            ORDER BY maxPlayedAt DESC 
            LIMIT :limit
        ) ph ON s.id = ph.songId
        ORDER BY ph.maxPlayedAt DESC
    """)
    fun getRecentlyPlayedSongs(limit: Int = 20): Flow<List<SongEntity>>

    @Query("DELETE FROM play_history")
    suspend fun clearHistory()

    // Favorites
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addFavorite(favorite: FavoriteEntity)

    @Query("DELETE FROM favorites WHERE targetId = :targetId AND targetType = :targetType")
    suspend fun removeFavorite(targetId: String, targetType: String)

    @Query("SELECT EXISTS(SELECT 1 FROM favorites WHERE targetId = :targetId AND targetType = :targetType)")
    suspend fun isFavorite(targetId: String, targetType: String): Boolean

    // Downloads
    @Query("SELECT * FROM download_tasks ORDER BY createdAt DESC")
    fun getAllDownloadTasks(): Flow<List<DownloadTaskEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDownloadTask(task: DownloadTaskEntity)

    @Query("UPDATE download_tasks SET status = :status, progress = :progress, downloadedBytes = :downloadedBytes WHERE id = :id")
    suspend fun updateDownloadProgress(id: String, status: String, progress: Float, downloadedBytes: Long)

    @Query("DELETE FROM download_tasks WHERE id = :id")
    suspend fun deleteDownloadTask(id: String)
}

