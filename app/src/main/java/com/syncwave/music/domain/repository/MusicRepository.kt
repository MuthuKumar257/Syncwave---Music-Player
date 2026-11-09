package com.syncwave.music.domain.repository

import com.syncwave.music.domain.model.Album
import com.syncwave.music.domain.model.Artist
import com.syncwave.music.domain.model.PlayHistory
import com.syncwave.music.domain.model.Song
import kotlinx.coroutines.flow.Flow

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
    suspend fun scanLocalMusic(): Result<Int>
}
