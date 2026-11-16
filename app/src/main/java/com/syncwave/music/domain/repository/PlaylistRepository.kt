package com.syncwave.music.domain.repository

import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.model.Song
import kotlinx.coroutines.flow.Flow

interface PlaylistRepository {
    fun getAllPlaylists(): Flow<List<Playlist>>
    fun getFavoritePlaylists(): Flow<List<Playlist>>
    fun observePlaylistById(id: String): Flow<Playlist?>
    fun getSongsInPlaylist(playlistId: String): Flow<List<Song>>
    suspend fun getPlaylistById(id: String): Playlist?
    suspend fun createPlaylist(name: String, artworkUri: String? = null): Playlist
    suspend fun updatePlaylist(playlist: Playlist)
    suspend fun deletePlaylist(id: String)
    suspend fun addSongToPlaylist(playlistId: String, songId: String)
    suspend fun removeSongFromPlaylist(playlistId: String, songId: String)
    suspend fun setPlaylistFavorite(id: String, isFavorite: Boolean)
}

