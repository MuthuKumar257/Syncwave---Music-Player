package com.syncwave.music.playback

import com.google.gson.Gson
import com.syncwave.music.data.remote.AutoQueueRequest
import com.syncwave.music.data.remote.AutoQueueResponse
import com.syncwave.music.data.remote.UnifiedTrackDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AutoQueueContinuousPlaybackTest {

    private val gson = Gson()

    @Test
    fun `AutoQueueRequest and AutoQueueResponse serialize and deserialize correctly`() {
        val request = AutoQueueRequest(
            songId = "song_123",
            songTitle = "Nenjukkul Peidhidum",
            artist = "Harris Jayaraj",
            director = "Harris Jayaraj",
            language = "Tamil",
            genre = "Melody",
            mood = "Romantic",
            excludeIds = listOf("song_100", "song_101"),
            limit = 10
        )

        val reqJson = gson.toJson(request)
        val deserializedReq = gson.fromJson(reqJson, AutoQueueRequest::class.java)

        assertEquals("song_123", deserializedReq.songId)
        assertEquals("Harris Jayaraj", deserializedReq.artist)
        assertEquals(2, deserializedReq.excludeIds.size)
        assertTrue(deserializedReq.excludeIds.contains("song_100"))

        val responseJson = """
            {
              "success": true,
              "count": 2,
              "tracks": [
                {
                  "id": "auto_1",
                  "title": "Adiye",
                  "artist": "A. R. Rahman",
                  "movieName": "Kadal",
                  "album": "Kadal",
                  "composer": "A. R. Rahman",
                  "durationMs": 302000,
                  "artworkUrl": "https://example.com/adiye.jpg",
                  "sourcePlatform": "YOUTUBE",
                  "sourceUrl": "https://youtube.com/watch?v=123",
                  "versionType": "ORIGINAL",
                  "isPlayableDirectly": true,
                  "language": "Tamil"
                },
                {
                  "id": "auto_2",
                  "title": "Munbe Vaa",
                  "artist": "A. R. Rahman",
                  "movieName": "Sillunu Oru Kaadhal",
                  "album": "Sillunu Oru Kaadhal",
                  "composer": "A. R. Rahman",
                  "durationMs": 350000,
                  "artworkUrl": "https://example.com/munbe.jpg",
                  "sourcePlatform": "YOUTUBE",
                  "sourceUrl": "https://youtube.com/watch?v=456",
                  "versionType": "ORIGINAL",
                  "isPlayableDirectly": true,
                  "language": "Tamil"
                }
              ]
            }
        """.trimIndent()

        val resp = gson.fromJson(responseJson, AutoQueueResponse::class.java)
        assertTrue(resp.success)
        assertEquals(2, resp.tracks.size)
        assertEquals("auto_1", resp.tracks[0].id)
        assertEquals("Adiye", resp.tracks[0].title)
        assertEquals("auto_2", resp.tracks[1].id)
    }

    @Test
    fun `deduplication filters out tracks in sessionPlayedSongIds or current queue`() {
        val sessionPlayed = mutableSetOf("played_1", "played_2")
        val currentQueueIds = listOf("current_1", "current_2")

        val incomingRecommendations = listOf(
            UnifiedTrackDto(
                id = "played_1",
                title = "Already Played",
                artist = "Artist",
                movieName = null,
                album = null,
                composer = null,
                singers = null,
                durationMs = 200000,
                artworkUrl = null,
                sourcePlatform = "LOCAL",
                sourceUrl = "",
                embedUrl = null,
                previewUrl = null,
                versionType = "ORIGINAL",
                isPlayableDirectly = true,
                releaseYear = null,
                language = "Tamil"
            ),
            UnifiedTrackDto(
                id = "current_2",
                title = "In Queue",
                artist = "Artist",
                movieName = null,
                album = null,
                composer = null,
                singers = null,
                durationMs = 200000,
                artworkUrl = null,
                sourcePlatform = "LOCAL",
                sourceUrl = "",
                embedUrl = null,
                previewUrl = null,
                versionType = "ORIGINAL",
                isPlayableDirectly = true,
                releaseYear = null,
                language = "Tamil"
            ),
            UnifiedTrackDto(
                id = "fresh_song",
                title = "Fresh Song",
                artist = "Artist",
                movieName = null,
                album = null,
                composer = null,
                singers = null,
                durationMs = 200000,
                artworkUrl = null,
                sourcePlatform = "LOCAL",
                sourceUrl = "",
                embedUrl = null,
                previewUrl = null,
                versionType = "ORIGINAL",
                isPlayableDirectly = true,
                releaseYear = null,
                language = "Tamil"
            )
        )

        val filtered = incomingRecommendations.filter {
            !sessionPlayed.contains(it.id) && !currentQueueIds.contains(it.id)
        }

        assertEquals(1, filtered.size)
        assertEquals("fresh_song", filtered.first().id)
        assertFalse(filtered.any { it.id == "played_1" })
        assertFalse(filtered.any { it.id == "current_2" })
    }
}
