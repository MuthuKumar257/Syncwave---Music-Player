package com.syncwave.music.data.mediastore

import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FullDownloadValidationTest {

    @Test
    fun `isSupportedAudio ignores staging and incomplete download files`() {
        assertFalse(AudioScanner.isSupportedAudio("Song - Artist.mp3.part"))
        assertFalse(AudioScanner.isSupportedAudio("Song - Artist.mp3.part", "audio/mpeg"))
        assertFalse(AudioScanner.isSupportedAudio("download.tmp"))
        assertFalse(AudioScanner.isSupportedAudio("track.crdownload", "audio/flac"))
        assertFalse(AudioScanner.isSupportedAudio("temp.download"))
        assertTrue(AudioScanner.isSupportedAudio("Song - Artist.mp3"))
    }

    @Test
    fun `isPreviewOrSampleUrl identifies 30s previews and allows full open audio URLs`() {
        assertTrue(AudioScanner.isPreviewOrSampleUrl("https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/sample.m4a"))
        assertTrue(AudioScanner.isPreviewOrSampleUrl("https://p.scdn.co/mp3-preview/abc123"))
        assertTrue(AudioScanner.isPreviewOrSampleUrl("https://example.com/snippet-15s.mp3"))
        assertFalse(AudioScanner.isPreviewOrSampleUrl("https://archive.org/download/item1/full-song.flac"))
    }

    @Test
    fun `validateDownloadDuration rejects previews and truncated files while accepting full songs`() {
        val previewReject = AudioScanner.validateDownloadDuration(
            actualDurationMs = 29_800L,
            expectedDurationMs = 240_000L
        )
        assertNotNull(previewReject)
        assertTrue(previewReject!!.contains("preview", ignoreCase = true))

        val unknownShortReject = AudioScanner.validateDownloadDuration(
            actualDurationMs = 15_000L,
            expectedDurationMs = 0L
        )
        assertNotNull(unknownShortReject)

        val truncatedReject = AudioScanner.validateDownloadDuration(
            actualDurationMs = 120_000L,
            expectedDurationMs = 240_000L
        )
        assertNotNull(truncatedReject)
        assertTrue(truncatedReject!!.contains("truncated", ignoreCase = true))

        assertNull(
            AudioScanner.validateDownloadDuration(
                actualDurationMs = 238_500L,
                expectedDurationMs = 240_000L
            )
        )
    }

    @Test
    fun `validateAudioFileHeader rejects tiny files HTML JSON and invalid headers while accepting MP3 and FLAC`() {
        val tinyError = AudioScanner.validateAudioFileHeader(byteArrayOf(0x49, 0x44, 0x33), 512L)
        assertNotNull(tinyError)

        val htmlHeader = "<!DOCTYPE html><html><body>Error</body></html>".toByteArray()
        assertNotNull(AudioScanner.validateAudioFileHeader(htmlHeader, 32_768L))

        val jsonHeader = """{"error":"not found"}""".toByteArray()
        assertNotNull(AudioScanner.validateAudioFileHeader(jsonHeader, 32_768L))

        val id3Header = ByteArray(16) { 0 }
        id3Header[0] = 'I'.code.toByte()
        id3Header[1] = 'D'.code.toByte()
        id3Header[2] = '3'.code.toByte()
        assertNull(AudioScanner.validateAudioFileHeader(id3Header, 64_000L))

        val flacHeader = ByteArray(16) { 0 }
        flacHeader[0] = 'f'.code.toByte()
        flacHeader[1] = 'L'.code.toByte()
        flacHeader[2] = 'a'.code.toByte()
        flacHeader[3] = 'C'.code.toByte()
        assertNull(AudioScanner.validateAudioFileHeader(flacHeader, 64_000L))
    }
}
