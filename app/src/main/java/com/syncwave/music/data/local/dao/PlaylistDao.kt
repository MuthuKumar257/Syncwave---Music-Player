package com.syncwave.music.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.syncwave.music.data.local.entity.PlaylistEntity
import com.syncwave.music.data.local.entity.PlaylistSongCrossRef
import com.syncwave.music.data.local.entity.SongEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PlaylistDao {
    @Query("SELECT * FROM playlists ORDER BY name ASC")
    fun getAllPlaylists(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE isFavorite = 1 ORDER BY name ASC")
    fun getFavoritePlaylists(): Flow<List<PlaylistEntity>>

    @Query("SELECT * FROM playlists WHERE id = :id LIMIT 1")
    suspend fun getPlaylistById(id: String): PlaylistEntity?

    @Query("SELECT * FROM playlists WHERE id = :id LIMIT 1")
    fun observePlaylistById(id: String): Flow<PlaylistEntity?>

    @Query("""
        SELECT s.* FROM songs s
        INNER JOIN playlist_songs ps ON s.id = ps.songId
        WHERE ps.playlistId = :playlistId
        ORDER BY ps.orderIndex ASC
    """)
    fun getSongsInPlaylist(playlistId: String): Flow<List<SongEntity>>

    @Query("""
        SELECT s.* FROM songs s
        INNER JOIN playlist_songs ps ON s.id = ps.songId
        WHERE ps.playlistId = :playlistId
        ORDER BY ps.orderIndex ASC
    """)
    suspend fun getSongsInPlaylistSync(playlistId: String): List<SongEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Update
    suspend fun updatePlaylist(playlist: PlaylistEntity)

    @Query("DELETE FROM playlists WHERE id = :id")
    suspend fun deletePlaylistById(id: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCrossRef(crossRef: PlaylistSongCrossRef)

    @Query("DELETE FROM playlist_songs WHERE playlistId = :playlistId AND songId = :songId")
    suspend fun removeSongFromPlaylist(playlistId: String, songId: String)

    @Query("DELETE FROM playlist_songs WHERE playlistId = :playlistId")
    suspend fun clearPlaylistSongs(playlistId: String)

    @Query("SELECT COUNT(*) FROM playlist_songs WHERE playlistId = :playlistId")
    suspend fun getSongCountInPlaylist(playlistId: String): Int

    @Transaction
    suspend fun updatePlaylistDurationAndCount(playlistId: String) {
        val songs = getSongsInPlaylistSync(playlistId)
        val count = songs.size
        val duration = songs.sumOf { it.durationMs }
        val artwork = songs.firstOrNull { it.artworkUri != null }?.artworkUri
        val playlist = getPlaylistById(playlistId)
        if (playlist != null) {
            updatePlaylist(
                playlist.copy(
                    songCount = count,
                    totalDurationMs = duration,
                    artworkUri = artwork ?: playlist.artworkUri,
                    updatedAt = System.currentTimeMillis()
                )
            )
        }
    }
}
