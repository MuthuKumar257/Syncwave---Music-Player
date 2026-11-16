package com.syncwave.music.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.syncwave.music.domain.model.Playlist

@Entity(
    tableName = "playlists",
    indices = [
        Index(value = ["name"]),
        Index(value = ["createdAt"])
    ]
)
data class PlaylistEntity(
    @PrimaryKey val id: String,
    val name: String,
    val artworkUri: String?,
    val songCount: Int = 0,
    val totalDurationMs: Long = 0L,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isFavorite: Boolean = false
) {
    fun toDomain(): Playlist = Playlist(
        id = id,
        name = name,
        artworkUri = artworkUri,
        songCount = songCount,
        totalDurationMs = totalDurationMs,
        createdAt = createdAt,
        updatedAt = updatedAt,
        isFavorite = isFavorite
    )

    companion object {
        fun fromDomain(playlist: Playlist): PlaylistEntity = PlaylistEntity(
            id = playlist.id,
            name = playlist.name,
            artworkUri = playlist.artworkUri,
            songCount = playlist.songCount,
            totalDurationMs = playlist.totalDurationMs,
            createdAt = playlist.createdAt,
            updatedAt = playlist.updatedAt,
            isFavorite = playlist.isFavorite
        )
    }
}

@Entity(
    tableName = "playlist_songs",
    primaryKeys = ["playlistId", "songId"],
    foreignKeys = [
        ForeignKey(
            entity = PlaylistEntity::class,
            parentColumns = ["id"],
            childColumns = ["playlistId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = SongEntity::class,
            parentColumns = ["id"],
            childColumns = ["songId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["playlistId"]),
        Index(value = ["songId"]),
        Index(value = ["playlistId", "orderIndex"])
    ]
)
data class PlaylistSongCrossRef(
    val playlistId: String,
    val songId: String,
    val orderIndex: Int = 0,
    val addedAt: Long = System.currentTimeMillis()
)

