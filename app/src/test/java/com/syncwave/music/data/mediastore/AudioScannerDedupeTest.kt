package com.syncwave.music.data.mediastore

import com.syncwave.music.data.local.entity.SongEntity
import com.syncwave.music.domain.model.AudioSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AudioScannerDedupeTest {

    @Test
    fun `isSupportedAudio accepts standard audio formats and rejects non-audio`() {
        assertTrue(AudioScanner.isSupportedAudio("track.mp3"))
        assertTrue(AudioScanner.isSupportedAudio("lossless.FLAC"))
        assertTrue(AudioScanner.isSupportedAudio("voice.m4a"))
        assertTrue(AudioScanner.isSupportedAudio("sample.wav"))
        assertTrue(AudioScanner.isSupportedAudio("stream", "audio/aac"))
        assertFalse(AudioScanner.isSupportedAudio("cover.jpg", "image/jpeg"))
        assertFalse(AudioScanner.isSupportedAudio("notes.txt", "text/plain"))
    }

    @Test
    fun `extractFileFormat and parseFilenameFallback handle standard naming`() {
        assertEquals("MP3", AudioScanner.extractFileFormat("Nenjukkul.mp3"))
        assertEquals("FLAC", AudioScanner.extractFileFormat("song.flac"))
        assertEquals("M4A", AudioScanner.extractFileFormat("noext", "audio/m4a"))

        val (title, artist) = AudioScanner.parseFilenameFallback("Harris Jayaraj - Nenjukkul Peidhidum.mp3")
        assertEquals("Nenjukkul Peidhidum", title)
        assertEquals("Harris Jayaraj", artist)
    }

    @Test
    fun `deduplicateUnifiedSongs prefers DOWNLOADED over SAF folder over Device Library and preserves favorites`() {
        val deviceSong = SongEntity(
            id = "ms_1",
            title = "Munbe Vaa",
            artist = "A.R. Rahman",
            album = "Sillunu Oru Kaadhal",
            durationMs = 310_000L,
            uri = "content://media/external/audio/media/1",
            artworkUri = null,
            trackNumber = 1,
            year = 2006,
            genre = null,
            dateAdded = 1000L,
            isFavorite = false,
            source = AudioSource.LOCAL.name,
            fileFormat = "MP3",
            folderName = "Device Library"
        )
        val safSong = deviceSong.copy(
            id = "saf_1",
            uri = "content://com.android.externalstorage.documents/tree/music/document/1",
            folderName = "My Music"
        )
        val downloadedSong = deviceSong.copy(
            id = "dl_1",
            uri = "file:///storage/emulated/0/Music/Songs/munbe_vaa.m4a",
            source = AudioSource.DOWNLOADED.name,
            fileFormat = "M4A",
            folderName = "Songs"
        )

        // When all three exist, DOWNLOADED wins and favorite from deviceSong is preserved
        val resultWithDownload = AudioScanner.deduplicateUnifiedSongs(
            candidates = listOf(deviceSong, safSong, downloadedSong),
            existingFavorites = mapOf("ms_1" to true)
        )
        assertEquals(1, resultWithDownload.size)
        assertEquals("dl_1", resultWithDownload.first().id)
        assertEquals(AudioSource.DOWNLOADED.name, resultWithDownload.first().source)
        assertTrue(resultWithDownload.first().isFavorite)

        // When only SAF and Device exist, SAF wins
        val resultWithSaf = AudioScanner.deduplicateUnifiedSongs(
            candidates = listOf(deviceSong, safSong),
            existingFavorites = emptyMap()
        )
        assertEquals(1, resultWithSaf.size)
        assertEquals("saf_1", resultWithSaf.first().id)
        assertEquals("My Music", resultWithSaf.first().folderName)
    }
}
