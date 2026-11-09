package com.syncwave.music.data.repository

import com.syncwave.music.data.local.dao.PlaylistDao
import com.syncwave.music.data.local.entity.PlaylistEntity
import com.syncwave.music.data.local.entity.PlaylistSongCrossRef
import com.syncwave.music.domain.model.Playlist
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.PlaylistRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaylistRepositoryImpl @Inject constructor(
    private val playlistDao: PlaylistDao
) : PlaylistRepository {

    override fun getAllPlaylists(): Flow<List<Playlist>> =
        playlistDao.getAllPlaylists().map { list -> list.map { it.toDomain() } }

    override fun getFavoritePlaylists(): Flow<List<Playlist>> =
        playlistDao.getFavoritePlaylists().map { list -> list.map { it.toDomain() } }

    override fun observePlaylistById(id: String): Flow<Playlist?> =
        playlistDao.observePlaylistById(id).map { it?.toDomain() }

    override fun getSongsInPlaylist(playlistId: String): Flow<List<Song>> =
        playlistDao.getSongsInPlaylist(playlistId).map { list -> list.map { it.toDomain() } }

    override suspend fun getPlaylistById(id: String): Playlist? =
        playlistDao.getPlaylistById(id)?.toDomain()

    override suspend fun createPlaylist(name: String, artworkUri: String?): Playlist {
        val newPlaylist = Playlist(
            id = UUID.randomUUID().toString(),
            name = name.trim(),
            artworkUri = artworkUri,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )
        playlistDao.insertPlaylist(PlaylistEntity.fromDomain(newPlaylist))
        return newPlaylist
    }

    override suspend fun updatePlaylist(playlist: Playlist) {
        playlistDao.updatePlaylist(PlaylistEntity.fromDomain(playlist))
    }

    override suspend fun deletePlaylist(id: String) {
        playlistDao.deletePlaylistById(id)
    }

    override suspend fun addSongToPlaylist(playlistId: String, songId: String) {
        val currentCount = playlistDao.getSongCountInPlaylist(playlistId)
        playlistDao.insertCrossRef(
            PlaylistSongCrossRef(
                playlistId = playlistId,
                songId = songId,
                orderIndex = currentCount
            )
        )
        playlistDao.updatePlaylistDurationAndCount(playlistId)
    }

    override suspend fun removeSongFromPlaylist(playlistId: String, songId: String) {
        playlistDao.removeSongFromPlaylist(playlistId, songId)
        playlistDao.updatePlaylistDurationAndCount(playlistId)
    }

    override suspend fun setPlaylistFavorite(id: String, isFavorite: Boolean) {
        val playlist = playlistDao.getPlaylistById(id)
        if (playlist != null) {
            playlistDao.updatePlaylist(playlist.copy(isFavorite = isFavorite))
        }
    }
}
