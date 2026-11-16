package com.syncwave.music.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.Song

@Entity(
    tableName = "songs",
    indices = [
        Index(value = ["title"]),
        Index(value = ["artist"]),
        Index(value = ["album"]),
        Index(value = ["dateAdded"])
    ]
)
data class SongEntity(
    @PrimaryKey val id: String,
    val title: String,
    val artist: String,
    val album: String,
    val durationMs: Long,
    val uri: String,
    val artworkUri: String?,
    val trackNumber: Int,
    val year: Int,
    val genre: String?,
    val dateAdded: Long,
    val isFavorite: Boolean = false,
    val source: String = AudioSource.LOCAL.name,
    val fileFormat: String = "",
    val folderName: String? = null
) {
    fun toDomain(): Song = Song(
        id = id,
        title = title,
        artist = artist,
        album = album,
        durationMs = durationMs,
        uri = uri,
        artworkUri = artworkUri,
        trackNumber = trackNumber,
        year = year,
        genre = genre,
        dateAdded = dateAdded,
        isFavorite = isFavorite,
        source = try { AudioSource.valueOf(source) } catch (_: Exception) { AudioSource.LOCAL },
        fileFormat = fileFormat,
        folderName = folderName
    )

    companion object {
        fun fromDomain(song: Song): SongEntity = SongEntity(
            id = song.id,
            title = song.title,
            artist = song.artist,
            album = song.album,
            durationMs = song.durationMs,
            uri = song.uri,
            artworkUri = song.artworkUri,
            trackNumber = song.trackNumber,
            year = song.year,
            genre = song.genre,
            dateAdded = song.dateAdded,
            isFavorite = song.isFavorite,
            source = song.source.name,
            fileFormat = song.fileFormat,
            folderName = song.folderName
        )
    }
}

