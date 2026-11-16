package com.syncwave.music.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.syncwave.music.domain.model.PlayHistory

@Entity(
    tableName = "favorites",
    indices = [
        Index(value = ["targetId", "targetType"], unique = true)
    ]
)
data class FavoriteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val targetId: String,
    val targetType: String, // "SONG" or "PLAYLIST"
    val addedAt: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "play_history",
    indices = [
        Index(value = ["songId"]),
        Index(value = ["playedAt"])
    ]
)
data class PlayHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val songId: String,
    val songTitle: String,
    val artistName: String,
    val playedAt: Long = System.currentTimeMillis(),
    val durationListenedMs: Long = 0L,
    val completed: Boolean = false
) {
    fun toDomain(): PlayHistory = PlayHistory(
        id = id,
        songId = songId,
        songTitle = songTitle,
        artistName = artistName,
        playedAt = playedAt,
        durationListenedMs = durationListenedMs,
        completed = completed
    )

    companion object {
        fun fromDomain(history: PlayHistory): PlayHistoryEntity = PlayHistoryEntity(
            id = history.id,
            songId = history.songId,
            songTitle = history.songTitle,
            artistName = history.artistName,
            playedAt = history.playedAt,
            durationListenedMs = history.durationListenedMs,
            completed = history.completed
        )
    }
}

@Entity(
    tableName = "download_tasks",
    indices = [
        Index(value = ["status"]),
        Index(value = ["createdAt"])
    ]
)
data class DownloadTaskEntity(
    @PrimaryKey val id: String,
    val url: String,
    val title: String,
    val artist: String,
    val status: String, // "QUEUED", "DOWNLOADING", "PAUSED", "COMPLETED", "FAILED"
    val progress: Float = 0f,
    val totalBytes: Long = 0L,
    val downloadedBytes: Long = 0L,
    val filePath: String? = null,
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

