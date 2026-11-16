package com.syncwave.music.ui.home

import com.google.gson.Gson
import com.syncwave.music.data.remote.PersonalizedFeedDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeRecommendationsTest {

    @Test
    fun `PersonalizedFeedDto deserializes all 12 mood playlists, artist albums, and ordered sections`() {
        val moods = listOf(
            "Happy", "Sad", "Romantic", "Love", "Motivation", "Energetic",
            "Relaxing", "Party", "Melancholic", "Devotional", "Focus", "Travel"
        )
        val moodJson = moods.joinToString(",") { m ->
            """
            {
              "id": "${m.lowercase()}",
              "mood": "$m",
              "title": "$m Vibes",
              "description": "Curated $m mix",
              "artworkUrl": "https://example.com/$m.jpg",
              "accentColor": "#F59E0B",
              "trackCount": 1,
              "tracks": [
                {
                  "id": "track_$m",
                  "title": "Nenjukkul Peidhidum",
                  "artist": "Harris Jayaraj",
                  "movieName": "Vaaranam Aayiram",
                  "album": "Vaaranam Aayiram",
                  "composer": "Harris Jayaraj",
                  "singers": ["Hariharan"],
                  "durationMs": 255000,
                  "artworkUrl": "https://i.ytimg.com/vi/FzLpP8VBC6E/hqdefault.jpg",
                  "sourcePlatform": "YOUTUBE",
                  "sourceUrl": "https://www.youtube.com/watch?v=FzLpP8VBC6E",
                  "embedUrl": "https://www.youtube.com/embed/FzLpP8VBC6E",
                  "videoId": "FzLpP8VBC6E",
                  "previewUrl": null,
                  "versionType": "ORIGINAL",
                  "isPlayableDirectly": true,
                  "releaseYear": 2008,
                  "language": "Tamil"
                }
              ]
            }
            """.trimIndent()
        }

        val json = """
            {
              "greeting": "Good evening",
              "timeOfDay": "EVENING",
              "contextTitle": "Evening Hits",
              "contextDescription": "Melodies for your evening",
              "preferredLanguages": ["Tamil", "Hindi"],
              "recentlyPlayed": [],
              "recommendedForYou": [],
              "madeForYou": [],
              "favouriteArtists": [
                {
                  "id": "dir_harris_jayaraj",
                  "name": "Harris Jayaraj",
                  "role": "DIRECTOR",
                  "roleTitle": "Music Director",
                  "languages": ["Tamil"],
                  "imageUrl": "https://example.com/harris.jpg",
                  "isFavourite": true,
                  "tracks": [],
                  "albums": [
                    {
                      "id": "album_vaaranam_aayiram",
                      "name": "Vaaranam Aayiram",
                      "releaseYear": 2008,
                      "language": "Tamil",
                      "artworkUrl": "https://i.ytimg.com/vi/FzLpP8VBC6E/hqdefault.jpg",
                      "tracks": []
                    }
                  ]
                }
              ],
              "recommendedSingers": [],
              "recommendedMusicDirectors": [],
              "moodPlaylists": [$moodJson],
              "similarSongs": [],
              "popularSongs": [],
              "trendingInLanguages": [],
              "discoverNewMusic": []
            }
        """.trimIndent()

        val feed = Gson().fromJson(json, PersonalizedFeedDto::class.java)
        assertEquals("Good evening", feed.greeting)
        assertEquals(12, feed.moodPlaylists.size)
        assertEquals(moods, feed.moodPlaylists.map { it.mood })
        assertTrue(feed.moodPlaylists.all { it.tracks.isNotEmpty() })
        assertEquals(1, feed.favouriteArtists.size)
        assertEquals("Vaaranam Aayiram", feed.favouriteArtists.first().albums.first().name)
    }
}
