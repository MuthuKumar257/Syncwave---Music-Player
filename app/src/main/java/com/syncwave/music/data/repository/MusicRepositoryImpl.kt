package com.syncwave.music.data.repository

import com.syncwave.music.data.local.dao.HistoryAndFavoritesDao
import com.syncwave.music.data.local.dao.SongDao
import com.syncwave.music.data.local.entity.FavoriteEntity
import com.syncwave.music.data.local.entity.PlayHistoryEntity
import com.syncwave.music.data.mediastore.AudioScanner
import com.syncwave.music.domain.model.Album
import com.syncwave.music.domain.model.Artist
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.MusicRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MusicRepositoryImpl @Inject constructor(
    private val songDao: SongDao,
    private val historyAndFavoritesDao: HistoryAndFavoritesDao,
    private val audioScanner: AudioScanner
) : MusicRepository {

    override fun getAllSongs(): Flow<List<Song>> =
        songDao.getAllSongs().map { list -> list.map { it.toDomain() } }

    override fun getRecentlyAddedSongs(): Flow<List<Song>> =
        songDao.getRecentlyAddedSongs().map { list -> list.map { it.toDomain() } }

    override fun getFavoriteSongs(): Flow<List<Song>> =
        songDao.getFavoriteSongs().map { list -> list.map { it.toDomain() } }

    override fun getRecentlyPlayedSongs(limit: Int): Flow<List<Song>> =
        historyAndFavoritesDao.getRecentlyPlayedSongs(limit).map { list -> list.map { it.toDomain() } }

    override fun searchSongs(query: String): Flow<List<Song>> =
        songDao.searchSongs(query).map { list -> list.map { it.toDomain() } }

    override fun getAllAlbums(): Flow<List<Album>> =
        songDao.getAllSongs().map { songs ->
            songs.groupBy { it.album }
                .map { (albumName, albumSongs) ->
                    val first = albumSongs.first()
                    Album(
                        id = albumName,
                        title = albumName,
                        artist = first.artist,
                        artworkUri = albumSongs.firstOrNull { it.artworkUri != null }?.artworkUri,
                        songCount = albumSongs.size,
                        year = first.year
                    )
                }
                .sortedBy { it.title }
        }

    override fun getAllArtists(): Flow<List<Artist>> =
        songDao.getAllSongs().map { songs ->
            songs.groupBy { it.artist }
                .map { (artistName, artistSongs) ->
                    Artist(
                        id = artistName,
                        name = artistName,
                        songCount = artistSongs.size,
                        albumCount = artistSongs.map { it.album }.distinct().size
                    )
                }
                .sortedBy { it.name }
        }

    override fun getSongsByAlbum(album: String): Flow<List<Song>> =
        songDao.getSongsByAlbum(album).map { list -> list.map { it.toDomain() } }

    override fun getSongsByArtist(artist: String): Flow<List<Song>> =
        songDao.getSongsByArtist(artist).map { list -> list.map { it.toDomain() } }

    override suspend fun getSongById(id: String): Song? =
        songDao.getSongById(id)?.toDomain()

    override suspend fun setFavorite(id: String, isFavorite: Boolean) {
        songDao.setFavorite(id, isFavorite)
        if (isFavorite) {
            historyAndFavoritesDao.addFavorite(FavoriteEntity(targetId = id, targetType = "SONG"))
        } else {
            historyAndFavoritesDao.removeFavorite(id, "SONG")
        }
    }

    override suspend fun recordPlayHistory(
        songId: String,
        songTitle: String,
        artistName: String,
        durationMs: Long,
        completed: Boolean
    ) {
        historyAndFavoritesDao.insertPlayHistory(
            PlayHistoryEntity(
                songId = songId,
                songTitle = songTitle,
                artistName = artistName,
                durationListenedMs = durationMs,
                completed = completed
            )
        )
    }

    override suspend fun clearHistory() {
        historyAndFavoritesDao.clearHistory()
    }

    override suspend fun scanLocalMusic(): Result<Int> = audioScanner.scanLocalAudio()
}
