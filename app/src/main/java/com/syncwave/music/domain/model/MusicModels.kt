package com.syncwave.music.domain.model

enum class AudioSource {
    LOCAL,
    DOWNLOADED,
    ONLINE_STREAM
}

data class Song(
    val id: String,
    val title: String,
    val artist: String = "Unknown Artist",
    val album: String = "Unknown Album",
    val durationMs: Long = 0L,
    val uri: String,
    val artworkUri: String? = null,
    val trackNumber: Int = 0,
    val year: Int = 0,
    val genre: String? = null,
    val dateAdded: Long = System.currentTimeMillis(),
    val isFavorite: Boolean = false,
    val source: AudioSource = AudioSource.LOCAL,
    val fileFormat: String = "",
    val folderName: String? = null
)

data class Album(
    val id: String,
    val title: String,
    val artist: String,
    val artworkUri: String? = null,
    val songCount: Int = 0,
    val year: Int = 0
)

data class Artist(
    val id: String,
    val name: String,
    val songCount: Int = 0,
    val albumCount: Int = 0
)

data class Playlist(
    val id: String,
    val name: String,
    val artworkUri: String? = null,
    val songCount: Int = 0,
    val totalDurationMs: Long = 0L,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isFavorite: Boolean = false
)

