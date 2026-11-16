package com.syncwave.music.domain.model

enum class RepeatMode {
    OFF,
    ALL,
    ONE
}

data class PlaybackState(
    val currentSong: Song? = null,
    val isPlaying: Boolean = false,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val isShuffleEnabled: Boolean = false,
    val repeatMode: RepeatMode = RepeatMode.OFF,
    val playbackSpeed: Float = 1.0f,
    val volume: Float = 1.0f,
    val queue: List<Song> = emptyList(),
    val queueIndex: Int = -1,
    val isCrossfading: Boolean = false,
    val isRemoteMode: Boolean = false,
    val activeDeviceName: String? = null,
    val errorMessage: String? = null
) {
    val progress: Float
        get() = if (durationMs > 0) (currentPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f) else 0f

    val nextSong: Song?
        get() {
            if (queue.isEmpty()) return null
            if (repeatMode == RepeatMode.ONE && currentSong != null) return currentSong
            return if (isShuffleEnabled) {
                if (queue.size > 1) queue.getOrNull((queueIndex + 1) % queue.size)
                else if (repeatMode == RepeatMode.ALL) queue.firstOrNull() else null
            } else {
                if (queueIndex + 1 < queue.size) queue.getOrNull(queueIndex + 1)
                else if (repeatMode == RepeatMode.ALL) queue.firstOrNull()
                else null
            }
        }
}

data class PlayHistory(
    val id: Long = 0,
    val songId: String,
    val songTitle: String,
    val artistName: String,
    val playedAt: Long = System.currentTimeMillis(),
    val durationListenedMs: Long = 0L,
    val completed: Boolean = false
)

