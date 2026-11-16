package com.syncwave.music.data.mediastore

import android.content.ContentUris
import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.MediaStore
import com.syncwave.music.data.local.dao.SongDao
import com.syncwave.music.data.local.entity.SongEntity
import com.syncwave.music.data.repository.PreferencesRepository
import com.syncwave.music.domain.model.AudioSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioScanner @Inject constructor(
    @ApplicationContext private val context: Context,
    private val songDao: SongDao,
    private val preferencesRepository: PreferencesRepository
) {
    private val scanMutex = Mutex()

    companion object {
        private val SUPPORTED_EXTENSIONS = setOf(
            "mp3", "wav", "flac", "aac", "m4a", "ogg", "opus", "webm", "wma", "alac"
        )

        private val INCOMPLETE_SUFFIXES = listOf(".part", ".tmp", ".crdownload", ".download")
        const val MIN_VALID_AUDIO_BYTES = 16L * 1024L
        const val MIN_FULL_SONG_DURATION_MS = 45_000L

        data class AudioFileValidationResult(
            val valid: Boolean,
            val actualDurationMs: Long = 0L,
            val errorMessage: String? = null
        )

        fun getSongsDirectory(context: Context): File {
            val base = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: context.filesDir
            return File(base, "Songs").apply { mkdirs() }
        }

        fun getArtworkCacheDirectory(context: Context): File =
            File(context.filesDir, "artwork_cache").apply { mkdirs() }

        fun isSupportedAudio(fileName: String, mimeType: String? = null): Boolean {
            val lower = fileName.lowercase(Locale.ROOT)
            if (INCOMPLETE_SUFFIXES.any { lower.endsWith(it) }) return false
            if (mimeType?.startsWith("audio/", ignoreCase = true) == true) return true
            val ext = fileName.substringAfterLast('.', "").lowercase(Locale.ROOT)
            return ext in SUPPORTED_EXTENSIONS
        }

        fun isPreviewOrSampleUrl(url: String?): Boolean {
            if (url.isNullOrBlank()) return false
            val u = url.lowercase(Locale.ROOT)
            return listOf(
                "audio-ssl.itunes.apple.com",
                "mzstatic.com",
                "p.scdn.co/mp3-preview",
                "/mp3-preview/",
                "preview",
                "snippet",
                "sample"
            ).any { it in u }
        }

        fun validateDownloadDuration(actualDurationMs: Long, expectedDurationMs: Long): String? {
            if (actualDurationMs <= 0L) {
                return "Unable to verify downloaded audio duration."
            }
            if (expectedDurationMs >= 60_000L && actualDurationMs < MIN_FULL_SONG_DURATION_MS) {
                val actualSec = kotlin.math.round(actualDurationMs / 1000.0).toInt()
                val expectedSec = kotlin.math.round(expectedDurationMs / 1000.0).toInt()
                return "Source delivered a ${actualSec}s preview instead of the full ${expectedSec}s song."
            }
            if (expectedDurationMs <= 0L && actualDurationMs < MIN_FULL_SONG_DURATION_MS) {
                val actualSec = kotlin.math.round(actualDurationMs / 1000.0).toInt()
                return "Audio duration (${actualSec}s) is too short for a full-length song."
            }
            if (expectedDurationMs > 0L) {
                val ratio = actualDurationMs.toDouble() / expectedDurationMs.toDouble()
                val deficitMs = expectedDurationMs - actualDurationMs
                if (ratio < 0.85 && deficitMs > 5_000L) {
                    val actualSec = kotlin.math.round(actualDurationMs / 1000.0).toInt()
                    val expectedSec = kotlin.math.round(expectedDurationMs / 1000.0).toInt()
                    return "Downloaded audio appears truncated (${actualSec}s of ${expectedSec}s)."
                }
            }
            return null
        }

        fun validateAudioFileHeader(header: ByteArray, totalSizeBytes: Long): String? {
            if (totalSizeBytes < MIN_VALID_AUDIO_BYTES) {
                return "Downloaded file is too small ($totalSizeBytes bytes) to be a complete song."
            }
            if (header.size < 12) {
                return "Audio file header is incomplete."
            }
            val headText = header.take(128).toByteArray().toString(Charsets.UTF_8).trimStart().lowercase(Locale.ROOT)
            if (headText.startsWith("<!doctype") || headText.startsWith("<html") || headText.startsWith("{")) {
                return "Server returned an HTML or JSON response instead of audio data."
            }
            val b0 = header[0].toInt() and 0xFF
            val b1 = header[1].toInt() and 0xFF
            val ascii4 = String(header.sliceArray(0..3), Charsets.US_ASCII)
            val ftyp = if (header.size >= 8) String(header.sliceArray(4..7), Charsets.US_ASCII) else ""

            val validMagic =
                ascii4.startsWith("ID3") || // MP3 ID3v2
                (b0 == 0xFF && (b1 and 0xE0) == 0xE0) || // MP3 / ADTS AAC frame sync
                ascii4 == "fLaC" || // FLAC
                ascii4 == "RIFF" || // WAV
                ascii4 == "OggS" || // OGG / Opus
                ftyp == "ftyp" || // M4A / MP4 / ALAC
                (b0 == 0x1A && b1 == 0x45) // WebM / Matroska

            if (!validMagic) {
                return "Unrecognized or corrupted audio container format."
            }
            return null
        }

        fun validatePartFileBeforeCommit(
            partFile: File,
            expectedDurationMs: Long,
            expectedContentLength: Long?
        ): AudioFileValidationResult {
            if (!partFile.exists()) {
                return AudioFileValidationResult(false, 0L, "Staged download file not found.")
            }
            val actualBytes = partFile.length()
            if (expectedContentLength != null && expectedContentLength > 0L && actualBytes < expectedContentLength) {
                return AudioFileValidationResult(
                    false,
                    0L,
                    "Download is incomplete ($actualBytes of $expectedContentLength bytes)."
                )
            }
            val header = ByteArray(128)
            val bytesRead = partFile.inputStream().use { it.read(header) }
            val headerError = validateAudioFileHeader(
                if (bytesRead > 0) header.copyOf(bytesRead) else ByteArray(0),
                actualBytes
            )
            if (headerError != null) {
                return AudioFileValidationResult(false, 0L, headerError)
            }

            val retriever = MediaMetadataRetriever()
            val actualDurationMs = try {
                retriever.setDataSource(partFile.absolutePath)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            } catch (_: Exception) {
                0L
            } finally {
                try {
                    retriever.release()
                } catch (_: Exception) {
                }
            }

            val durationError = validateDownloadDuration(actualDurationMs, expectedDurationMs)
            if (durationError != null) {
                return AudioFileValidationResult(false, actualDurationMs, durationError)
            }
            return AudioFileValidationResult(true, actualDurationMs, null)
        }

        fun extractFileFormat(fileName: String, mimeType: String? = null): String {
            val ext = fileName.substringAfterLast('.', "").trim()
            if (ext.isNotEmpty() && ext.length <= 5 && ext != fileName) {
                return ext.uppercase(Locale.ROOT)
            }
            val mime = mimeType?.lowercase(Locale.ROOT).orEmpty()
            return when {
                "mpeg" in mime || "mp3" in mime -> "MP3"
                "mp4" in mime || "m4a" in mime -> "M4A"
                "aac" in mime -> "AAC"
                "flac" in mime -> "FLAC"
                "wav" in mime -> "WAV"
                "ogg" in mime -> "OGG"
                "opus" in mime -> "OPUS"
                else -> "AUDIO"
            }
        }

        fun parseFilenameFallback(fileName: String): Pair<String, String> {
            val base = fileName.substringBeforeLast('.').replace('_', ' ').trim()
            return if (" - " in base) {
                val artist = base.substringBefore(" - ").trim().ifEmpty { "Unknown Artist" }
                val title = base.substringAfter(" - ").trim().ifEmpty { base }
                title to artist
            } else {
                base.ifEmpty { "Unknown Track" } to "Unknown Artist"
            }
        }

        fun deduplicateUnifiedSongs(
            candidates: List<SongEntity>,
            existingFavorites: Map<String, Boolean>
        ): List<SongEntity> {
            val bestByKey = linkedMapOf<String, SongEntity>()

            fun sourcePriority(song: SongEntity): Int = when {
                song.source == AudioSource.DOWNLOADED.name -> 3
                !song.folderName.isNullOrBlank() && song.folderName != "Device Library" -> 2
                else -> 1
            }

            fun dedupeKey(song: SongEntity): String {
                val normTitle = song.title.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), " ").trim()
                val normArtist = song.artist.lowercase(Locale.ROOT).replace(Regex("[^a-z0-9]+"), " ").trim()
                val durBucket = song.durationMs / 3000L
                return if (normTitle.isNotEmpty() && normArtist.isNotEmpty() && normArtist != "unknown artist") {
                    "meta:$normTitle|$normArtist|$durBucket"
                } else {
                    "title:$normTitle|$durBucket"
                }
            }

            for (song in candidates) {
                val key = dedupeKey(song)
                val existing = bestByKey[key]
                val restoredFav = existingFavorites[song.id] ?: false
                val normalized = if (restoredFav) song.copy(isFavorite = true) else song

                if (existing == null) {
                    bestByKey[key] = normalized
                    continue
                }

                val replace = sourcePriority(normalized) > sourcePriority(existing)
                val primary = if (replace) normalized else existing
                val secondary = if (replace) existing else normalized
                bestByKey[key] = primary.copy(
                    artworkUri = primary.artworkUri ?: secondary.artworkUri,
                    durationMs = if (primary.durationMs > 0L) primary.durationMs else secondary.durationMs,
                    fileFormat = primary.fileFormat.ifBlank { secondary.fileFormat },
                    isFavorite = primary.isFavorite || secondary.isFavorite
                )
            }

            return bestByKey.values.sortedBy { it.title.lowercase(Locale.ROOT) }
        }
    }

    suspend fun scanLocalAudio(): Result<Int> = scanMutex.withLock {
        withContext(Dispatchers.IO) {
            try {
                val existingFavorites = songDao.getAllSongsSnapshot().associate { it.id to it.isFavorite }
                val collected = mutableListOf<SongEntity>()

                // 1. App-designated `Songs` folder (downloaded offline songs)
                collected += scanAppSongsDirectory()

                // 2. User-selected SAF local music folders (recursive)
                collected += scanPersistedSafFolders()

                // 3. Device-local MediaStore music library (when permission granted)
                collected += scanMediaStoreLibrary()

                val unified = deduplicateUnifiedSongs(collected, existingFavorites)

                if (unified.isNotEmpty()) {
                    songDao.insertSongs(unified)
                    songDao.deleteMissingSongs(unified.map { it.id })
                } else {
                    songDao.deleteAllSongs()
                }

                Result.success(unified.size)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    private fun scanAppSongsDirectory(): List<SongEntity> {
        val dir = getSongsDirectory(context)
        val result = mutableListOf<SongEntity>()
        dir.walkTopDown()
            .filter { it.isFile && isSupportedAudio(it.name) }
            .forEach { file ->
                result += buildSongFromFile(file)
            }
        return result
    }

    private fun buildSongFromFile(file: File): SongEntity {
        val (fallbackTitle, fallbackArtist) = parseFilenameFallback(file.name)
        var title = fallbackTitle
        var artist = fallbackArtist
        var album = "Downloaded Songs"
        var durationMs = 0L
        var artworkUri: String? = findCachedSidecarArtwork(file)

        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(file.absolutePath)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() }?.let { title = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() }?.let { artist = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.takeIf { it.isNotBlank() }?.let { album = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.let { durationMs = it }
            if (artworkUri == null) {
                retriever.embeddedPicture?.let { bytes ->
                    artworkUri = cacheArtworkBytes(file.absolutePath.hashCode().toString(), bytes)
                }
            }
        } catch (_: Exception) {
            // Keep filename fallback
        } finally {
            try { retriever.release() } catch (_: Exception) {}
        }

        return SongEntity(
            id = "songs_${file.absolutePath.hashCode()}",
            title = title,
            artist = artist,
            album = album,
            durationMs = durationMs,
            uri = Uri.fromFile(file).toString(),
            artworkUri = artworkUri,
            trackNumber = 0,
            year = 0,
            genre = null,
            dateAdded = file.lastModified().takeIf { it > 0L } ?: System.currentTimeMillis(),
            isFavorite = false,
            source = AudioSource.DOWNLOADED.name,
            fileFormat = extractFileFormat(file.name),
            folderName = "Songs"
        )
    }

    private fun findCachedSidecarArtwork(audioFile: File): String? {
        val base = audioFile.nameWithoutExtension
        val jpg = File(audioFile.parentFile, "$base.jpg")
        return if (jpg.exists() && jpg.length() > 0L) Uri.fromFile(jpg).toString() else null
    }

    private suspend fun scanPersistedSafFolders(): List<SongEntity> {
        val folderUris = preferencesRepository.musicFolderUris.first()
        if (folderUris.isEmpty()) return emptyList()

        val persisted = context.contentResolver.persistedUriPermissions
            .filter { it.isReadPermission }
            .map { it.uri.toString() }
            .toSet()

        val result = mutableListOf<SongEntity>()
        for (uriString in folderUris) {
            if (uriString !in persisted) continue
            try {
                val treeUri = Uri.parse(uriString)
                val folderName = resolveTreeDisplayName(treeUri)
                result += walkSafTreeRecursive(treeUri, folderName)
            } catch (_: Exception) {
                // Skip inaccessible folder safely
            }
        }
        return result
    }

    fun resolveTreeDisplayName(treeUri: Uri): String {
        return try {
            val docId = DocumentsContract.getTreeDocumentId(treeUri)
            val docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)
            context.contentResolver.query(
                docUri,
                arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else null
            } ?: docId.substringAfterLast(':').ifBlank { "Music Folder" }
        } catch (_: Exception) {
            treeUri.lastPathSegment?.substringAfterLast(':') ?: "Music Folder"
        }
    }

    private fun walkSafTreeRecursive(treeUri: Uri, folderName: String): List<SongEntity> {
        val rootDocId = DocumentsContract.getTreeDocumentId(treeUri)
        val queue = ArrayDeque<String>()
        queue.add(rootDocId)

        val collected = mutableListOf<SongEntity>()
        val projection = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED
        )

        while (queue.isNotEmpty()) {
            val currentDocId = queue.removeFirst()
            val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, currentDocId)
            context.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
                val idCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                val nameCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                val mimeCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE)
                val modCol = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)

                while (cursor.moveToNext()) {
                    val docId = if (idCol >= 0) cursor.getString(idCol) else continue
                    val name = if (nameCol >= 0) cursor.getString(nameCol) ?: "" else ""
                    val mime = if (mimeCol >= 0) cursor.getString(mimeCol) ?: "" else ""
                    val lastMod = if (modCol >= 0) cursor.getLong(modCol) else 0L

                    if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
                        queue.add(docId)
                    } else if (isSupportedAudio(name, mime)) {
                        val docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId)
                        collected += buildSongFromSafDocument(docUri, docId, name, mime, lastMod, folderName)
                    }
                }
            }
        }
        return collected
    }

    private fun buildSongFromSafDocument(
        docUri: Uri,
        docId: String,
        displayName: String,
        mimeType: String,
        lastModified: Long,
        folderName: String
    ): SongEntity {
        val (fallbackTitle, fallbackArtist) = parseFilenameFallback(displayName)
        var title = fallbackTitle
        var artist = fallbackArtist
        var album = folderName
        var durationMs = 0L
        var artworkUri: String? = null

        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(context, docUri)
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE)?.takeIf { it.isNotBlank() }?.let { title = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST)?.takeIf { it.isNotBlank() }?.let { artist = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM)?.takeIf { it.isNotBlank() }?.let { album = it }
            retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull()?.let { durationMs = it }
            retriever.embeddedPicture?.let { bytes ->
                artworkUri = cacheArtworkBytes(docId.hashCode().toString(), bytes)
            }
        } catch (_: Exception) {
            // Keep filename fallback
        } finally {
            try { retriever.release() } catch (_: Exception) {}
        }

        return SongEntity(
            id = "saf_${docUri.toString().hashCode()}",
            title = title,
            artist = artist,
            album = album,
            durationMs = durationMs,
            uri = docUri.toString(),
            artworkUri = artworkUri,
            trackNumber = 0,
            year = 0,
            genre = null,
            dateAdded = if (lastModified > 0L) lastModified else System.currentTimeMillis(),
            isFavorite = false,
            source = AudioSource.LOCAL.name,
            fileFormat = extractFileFormat(displayName, mimeType),
            folderName = folderName
        )
    }

    private fun scanMediaStoreLibrary(): List<SongEntity> {
        val songs = mutableListOf<SongEntity>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.MIME_TYPE,
            MediaStore.Audio.Media.TRACK,
            MediaStore.Audio.Media.YEAR,
            MediaStore.Audio.Media.DATE_ADDED
        )

        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND ${MediaStore.Audio.Media.DURATION} >= 10000"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"
        val uri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        }

        try {
            context.contentResolver.query(uri, projection, selection, null, sortOrder)?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val albumCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val albumIdCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                val durationCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
                val dispCol = cursor.getColumnIndex(MediaStore.Audio.Media.DISPLAY_NAME)
                val mimeCol = cursor.getColumnIndex(MediaStore.Audio.Media.MIME_TYPE)
                val trackCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TRACK)
                val yearCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.YEAR)
                val dateAddedCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)

                while (cursor.moveToNext()) {
                    val mediaId = cursor.getLong(idCol)
                    val title = cursor.getString(titleCol) ?: "Unknown Title"
                    val artist = cursor.getString(artistCol)?.takeIf { it != "<unknown>" } ?: "Unknown Artist"
                    val album = cursor.getString(albumCol)?.takeIf { it != "<unknown>" } ?: "Unknown Album"
                    val albumId = cursor.getLong(albumIdCol)
                    val duration = cursor.getLong(durationCol)
                    val data = cursor.getString(dataCol) ?: ""
                    val displayName = if (dispCol >= 0) cursor.getString(dispCol) ?: "" else ""
                    val mimeType = if (mimeCol >= 0) cursor.getString(mimeCol) else null
                    val track = cursor.getInt(trackCol)
                    val year = cursor.getInt(yearCol)
                    val dateAdded = cursor.getLong(dateAddedCol) * 1000L

                    if (data.isNotEmpty() && !File(data).exists()) {
                        continue
                    }

                    val contentUri = ContentUris.withAppendedId(
                        MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                        mediaId
                    ).toString()

                    val albumArtUri = ContentUris.withAppendedId(
                        Uri.parse("content://media/external/audio/albumart"),
                        albumId
                    ).toString()

                    val format = extractFileFormat(
                        displayName.ifEmpty { data },
                        mimeType
                    )

                    songs.add(
                        SongEntity(
                            id = mediaId.toString(),
                            title = title,
                            artist = artist,
                            album = album,
                            durationMs = duration,
                            uri = contentUri,
                            artworkUri = albumArtUri,
                            trackNumber = track,
                            year = year,
                            genre = null,
                            dateAdded = if (dateAdded > 0) dateAdded else System.currentTimeMillis(),
                            isFavorite = false,
                            source = AudioSource.LOCAL.name,
                            fileFormat = format,
                            folderName = "Device Library"
                        )
                    )
                }
            }
        } catch (_: SecurityException) {
            // Permission not granted yet; still return Songs + SAF folder results
        }
        return songs
    }

    private fun cacheArtworkBytes(key: String, bytes: ByteArray): String? {
        if (bytes.isEmpty() || bytes.size > 2 * 1024 * 1024) return null
        return try {
            val outFile = File(getArtworkCacheDirectory(context), "art_${key}.jpg")
            if (!outFile.exists()) {
                outFile.writeBytes(bytes)
            }
            Uri.fromFile(outFile).toString()
        } catch (_: Exception) {
            null
        }
    }
}
