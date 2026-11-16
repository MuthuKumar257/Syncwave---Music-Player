package com.syncwave.music.playback

import com.google.gson.Gson
import com.syncwave.music.data.remote.SessionTrackDto
import com.syncwave.music.data.repository.PersistedPlaybackSessionDto
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.RepeatMode
import com.syncwave.music.playback.sync.parseRepeatMode
import com.syncwave.music.playback.sync.toDomainSong
import com.syncwave.music.playback.sync.toSessionTrackDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackSessionRestorationTest {

    private val gson = Gson()

    @Test
    fun `PersistedPlaybackSessionDto serializes and deserializes accurately`() {
        val currentTrack = SessionTrackDto(
            id = "track_101",
            title = "Ennavale Adi Ennavale",
            artist = "A. R. Rahman, Unni Menon",
            album = "Kadhalan",
            durationMs = 312000L,
            artworkUrl = "https://images.example.com/kadhalan.jpg",
            externalUrl = "https://youtube.com/watch?v=ennavale123",
            source = "YOUTUBE"
        )

        val queueTracks = listOf(
            currentTrack,
            SessionTrackDto(
                id = "track_102",
                title = "Urvasi Urvasi",
                artist = "A. R. Rahman, Suresh Peters",
                album = "Kadhalan",
                durationMs = 340000L,
                artworkUrl = "https://images.example.com/urvasi.jpg",
                externalUrl = "https://youtube.com/watch?v=urvasi123",
                source = "YOUTUBE"
            ),
            SessionTrackDto(
                id = "track_103",
                title = "Mukkabla",
                artist = "Mano, Swarnalatha",
                album = "Kadhalan",
                durationMs = 320000L,
                artworkUrl = "https://images.example.com/mukkabla.jpg",
                externalUrl = "https://youtube.com/watch?v=mukkabla123",
                source = "YOUTUBE"
            )
        )

        val session = PersistedPlaybackSessionDto(
            lastPlayedSongId = "track_101",
            currentSong = currentTrack,
            positionMs = 45200L,
            isPlaying = false,
            queue = queueTracks,
            queueIndex = 0,
            sessionPlayedSongIds = listOf("track_99", "track_100", "track_101"),
            isShuffle = false,
            repeatMode = "ALL",
            volume = 0.85f,
            playbackSpeed = 1.0f,
            savedAt = 1700000000000L
        )

        val json = gson.toJson(session)
        assertNotNull(json)

        val restored = gson.fromJson(json, PersistedPlaybackSessionDto::class.java)
        assertEquals("track_101", restored.lastPlayedSongId)
        assertEquals("Ennavale Adi Ennavale", restored.currentSong?.title)
        assertEquals(45200L, restored.positionMs)
        assertFalse("Restored session should be paused on startup", restored.isPlaying)
        assertEquals(3, restored.queue.size)
        assertEquals("track_102", restored.queue[1].id)
        assertEquals("track_103", restored.queue[2].id)
        assertEquals(0, restored.queueIndex)
        assertEquals(3, restored.sessionPlayedSongIds.size)
        assertTrue(restored.sessionPlayedSongIds.contains("track_99"))
        assertTrue(restored.sessionPlayedSongIds.contains("track_101"))
        assertEquals("ALL", restored.repeatMode)
        assertEquals(0.85f, restored.volume, 0.001f)
    }

    @Test
    fun `SessionTrackDto accurately maps to domain Song model`() {
        val dto = SessionTrackDto(
            id = "local_song_456",
            title = "Aalaporaan Thamizhan",
            artist = "Kailash Kher, D. Sathyaprakash",
            album = "Mersal",
            durationMs = 348000L,
            artworkUrl = "content://media/external/audio/albumart/1",
            externalUrl = "content://media/external/audio/media/456",
            source = "LOCAL"
        )

        val domainSong = dto.toDomainSong()
        assertEquals("local_song_456", domainSong.id)
        assertEquals("Aalaporaan Thamizhan", domainSong.title)
        assertEquals("Kailash Kher, D. Sathyaprakash", domainSong.artist)
        assertEquals("Mersal", domainSong.album)
        assertEquals(348000L, domainSong.durationMs)
        assertEquals("content://media/external/audio/media/456", domainSong.uri)
        assertEquals(AudioSource.LOCAL, domainSong.source)

        // Inverse mapping
        val mappedDto = domainSong.toSessionTrackDto()
        assertEquals(domainSong.id, mappedDto.id)
        assertEquals(domainSong.title, mappedDto.title)
        assertEquals("LOCAL", mappedDto.source)
    }

    @Test
    fun `repeat mode parsing handles edge cases`() {
        assertEquals(RepeatMode.ALL, parseRepeatMode("ALL"))
        assertEquals(RepeatMode.ONE, parseRepeatMode("ONE"))
        assertEquals(RepeatMode.OFF, parseRepeatMode("OFF"))
        assertEquals(RepeatMode.OFF, parseRepeatMode(null))
        assertEquals(RepeatMode.OFF, parseRepeatMode("UNKNOWN"))
    }

    @Test
    fun `session played songs prevent duplicate recommendations`() {
        val restoredSessionPlayed = setOf("song_1", "song_2", "song_3")
        val currentQueueIds = setOf("song_3", "song_4")

        val incomingCandidates = listOf("song_1", "song_2", "song_4", "song_5", "song_6")
        val deduplicated = incomingCandidates.filter {
            !restoredSessionPlayed.contains(it) && !currentQueueIds.contains(it)
        }

        assertEquals(2, deduplicated.size)
        assertEquals(listOf("song_5", "song_6"), deduplicated)
    }
}
