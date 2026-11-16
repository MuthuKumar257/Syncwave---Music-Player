package com.syncwave.music.data.repository

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.syncwave.music.data.local.dao.HistoryAndFavoritesDao
import com.syncwave.music.data.local.dao.SongDao
import com.syncwave.music.data.local.entity.FavoriteEntity
import com.syncwave.music.data.local.entity.SongEntity
import com.syncwave.music.data.mediastore.AudioScanner
import com.syncwave.music.data.remote.AutoQueueRequest
import com.syncwave.music.data.remote.PlayHistoryRequest
import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.data.remote.UnifiedTrackDto
import com.syncwave.music.domain.model.Album
import com.syncwave.music.domain.model.Artist
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.Song
import com.syncwave.music.domain.repository.DownloadStatus
import com.syncwave.music.domain.repository.DownloadTaskInfo
import com.syncwave.music.domain.repository.MusicRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MusicRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val songDao: SongDao,
    private val historyAndFavoritesDao: HistoryAndFavoritesDao,
    private val audioScanner: AudioScanner,
    private val apiService: SyncWaveApiService,
    private val preferencesRepository: PreferencesRepository
) : MusicRepository {

    private val _downloadTasks = MutableStateFlow<Map<String, DownloadTaskInfo>>(emptyMap())
    override val downloadTasks: StateFlow<Map<String, DownloadTaskInfo>> = _downloadTasks.asStateFlow()
    private val pausedTrackIds = ConcurrentHashMap.newKeySet<String>()
    private val cancelledTrackIds = ConcurrentHashMap.newKeySet<String>()
    private val trackMetadataCache = ConcurrentHashMap<String, UnifiedTrackDto>()

    override fun getAllSongs(): Flow<List<Song>> =
        songDao.getAllSongs().map { list -> list.map { it.toDomain() } }

    override fun getRecentlyAddedSongs(): Flow<List<Song>> =
        songDao.getRecentlyAddedSongs().map { list -> list.map { it.toDomain() } }

    override fun getFavoriteSongs(): Flow<List<Song>> =
        songDao.getFavoriteSongs().map { list -> list.map { it.toDomain() } }

    override fun getRecentlyPlayedSongs(limit: Int): Flow<List<Song>> = flow {
        // Play history is loaded strictly from Supabase via backend API (never read from local Room history)
        try {
            val res = apiService.getPlayHistory(limit)
            if (res.isSuccessful && res.body()?.success == true) {
                val mapped = (res.body()?.data ?: emptyList())
                    .distinctBy { it.songId }
                    .take(limit)
                    .map { dto ->
                        songDao.getSongById(dto.songId)?.toDomain() ?: Song(
                            id = dto.songId,
                            title = dto.songTitle,
                            artist = dto.artistName,
                            uri = "",
                            durationMs = dto.durationListenedMs,
                            source = AudioSource.ONLINE_STREAM
                        )
                    }
                emit(mapped)
                return@flow
            }
        } catch (_: Exception) {}
        emit(emptyList())
    }

    override fun searchSongs(query: String): Flow<List<Song>> =
        songDao.searchSongs(query).map { list -> list.map { it.toDomain() } }

    override fun getAllAlbums(): Flow<List<Album>> =
        songDao.getAllSongs().map { songs ->
            songs.groupBy { it.album }
                .map { (albumName, albumSongs) ->
                    val first = albumSongs.first()
                    Album(
                        id = albumName,
                        title = albumName,
                        artist = first.artist,
                        artworkUri = albumSongs.firstOrNull { it.artworkUri != null }?.artworkUri,
                        songCount = albumSongs.size,
                        year = first.year
                    )
                }
                .sortedBy { it.title }
        }

    override fun getAllArtists(): Flow<List<Artist>> =
        songDao.getAllSongs().map { songs ->
            songs.groupBy { it.artist }
                .map { (artistName, artistSongs) ->
                    Artist(
                        id = artistName,
                        name = artistName,
                        songCount = artistSongs.size,
                        albumCount = artistSongs.map { it.album }.distinct().size
                    )
                }
                .sortedBy { it.name }
        }

    override fun getSongsByAlbum(album: String): Flow<List<Song>> =
        songDao.getSongsByAlbum(album).map { list -> list.map { it.toDomain() } }

    override fun getSongsByArtist(artist: String): Flow<List<Song>> =
        songDao.getSongsByArtist(artist).map { list -> list.map { it.toDomain() } }

    override suspend fun getSongById(id: String): Song? =
        songDao.getSongById(id)?.toDomain()

    override suspend fun setFavorite(id: String, isFavorite: Boolean) {
        songDao.setFavorite(id, isFavorite)
        if (isFavorite) {
            historyAndFavoritesDao.addFavorite(FavoriteEntity(targetId = id, targetType = "SONG"))
        } else {
            historyAndFavoritesDao.removeFavorite(id, "SONG")
        }
    }

    override suspend fun recordPlayHistory(
        songId: String,
        songTitle: String,
        artistName: String,
        durationMs: Long,
        completed: Boolean
    ) {
        // Store play history strictly in Supabase via SyncWave backend (never in local Room DB)
        try {
            apiService.recordPlayHistory(
                PlayHistoryRequest(
                    songId = songId,
                    songTitle = songTitle,
                    artistName = artistName,
                    durationListenedMs = durationMs,
                    completed = completed,
                    clientPlatform = "ANDROID"
                )
            )
        } catch (_: Exception) {
            // Skip offline failure without caching history locally
        }
    }

    override suspend fun clearHistory() {
        try {
            apiService.clearHistory()
        } catch (_: Exception) {}
        historyAndFavoritesDao.clearHistory()
    }

    override suspend fun scanLocalMusic(): Result<Int> = audioScanner.scanLocalAudio()

    override suspend fun addMusicFolder(treeUri: Uri, makeDefault: Boolean): Result<Int> {
        try {
            val takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION
            context.contentResolver.takePersistableUriPermission(treeUri, takeFlags)
        } catch (_: SecurityException) {
            // Best-effort persistable grant; continue if temporary grant works for immediate scan
        }
        preferencesRepository.addMusicFolderUri(treeUri.toString(), makeDefault)
        return audioScanner.scanLocalAudio()
    }

    override suspend fun setDefaultMusicFolder(treeUri: String) {
        preferencesRepository.setDefaultMusicFolderUri(treeUri)
    }

    override suspend fun removeMusicFolder(treeUri: String): Result<Int> {
        preferencesRepository.removeMusicFolderUri(treeUri)
        return audioScanner.scanLocalAudio()
    }

    override fun getFolderDisplayName(treeUri: String): String {
        return audioScanner.resolveTreeDisplayName(Uri.parse(treeUri))
    }

    private fun upsertTask(task: DownloadTaskInfo) {
        _downloadTasks.update { current ->
            current + (task.trackId to task)
        }
    }

    private fun removeTask(trackId: String) {
        _downloadTasks.update { current ->
            current - trackId
        }
    }

    override suspend fun pauseDownload(trackId: String) {
        pausedTrackIds.add(trackId)
        _downloadTasks.update { current ->
            val existing = current[trackId] ?: return@update current
            current + (trackId to existing.copy(status = DownloadStatus.PAUSED))
        }
    }

    override suspend fun cancelDownload(trackId: String) {
        cancelledTrackIds.add(trackId)
        pausedTrackIds.remove(trackId)
        val existing = _downloadTasks.value[trackId]
        if (existing?.partFilePath?.isNotBlank() == true) {
            runCatching { File(existing.partFilePath).delete() }
        }
        trackMetadataCache.remove(trackId)
        removeTask(trackId)
    }

    override suspend fun resumeDownload(trackId: String): Result<Song> {
        val cachedTrack = trackMetadataCache[trackId]
            ?: return Result.failure(IllegalStateException("Original track metadata unavailable for resume."))
        return downloadTrackToSongsFolder(cachedTrack)
    }

    private fun parseContentRangeTotalBytes(header: String?): Long? {
        if (header.isNullOrBlank()) return null
        val match = Regex("bytes\\s+\\d+-\\d+/(\\d+|\\*)", RegexOption.IGNORE_CASE).find(header.trim())
            ?: return null
        val total = match.groupValues[1]
        return if (total == "*") null else total.toLongOrNull()
    }

    override suspend fun downloadTrackToSongsFolder(track: UnifiedTrackDto): Result<Song> = withContext(Dispatchers.IO) {
        pausedTrackIds.remove(track.id)
        cancelledTrackIds.remove(track.id)
        trackMetadataCache[track.id] = track

        val cleanTitle = track.title.replace(Regex("[<>:\"/\\\\|?*]+"), "").trim().ifBlank { "SyncWave_Track" }
        val cleanArtist = track.artist.replace(Regex("[<>:\"/\\\\|?*]+"), "").trim().ifBlank { "Artist" }

        var task = DownloadTaskInfo(
            trackId = track.id,
            title = track.title,
            artist = track.artist,
            artworkUrl = track.artworkUrl,
            status = DownloadStatus.CHECKING,
            expectedDurationMs = track.durationMs
        )
        upsertTask(task)

        try {
            // 1. Pre-check full-length download eligibility via backend (or safe offline fullAudioUrl)
            var resolvedUrl: String? = track.fullAudioUrl?.takeIf { !AudioScanner.isPreviewOrSampleUrl(it) }
            var expectedDurationMs = track.durationMs
            var detectedFormat = track.fileFormat?.lowercase(Locale.ROOT)
            var expectedTotalBytes: Long? = null
            var supportsRange = true

            val checkCandidateUrl = track.fullAudioUrl ?: track.previewUrl ?: track.sourceUrl
            val checkRes = runCatching {
                apiService.checkFullDownload(
                    url = checkCandidateUrl,
                    title = track.title,
                    artist = track.artist,
                    sourcePlatform = track.sourcePlatform,
                    expectedDurationMs = track.durationMs
                )
            }.getOrNull()

            if (checkRes != null && checkRes.isSuccessful) {
                val body = checkRes.body()
                if (body != null && !body.downloadable) {
                    val reason = body.reason ?: "Only a preview or stream-only source is available for \"${track.title}\"."
                    upsertTask(task.copy(status = DownloadStatus.FAILED, errorMessage = reason))
                    return@withContext Result.failure(IllegalStateException(reason))
                }
                if (body?.downloadable == true && !body.audioUrl.isNullOrBlank()) {
                    resolvedUrl = body.audioUrl
                    expectedDurationMs = body.expectedDurationMs ?: expectedDurationMs
                    detectedFormat = body.fileFormat?.lowercase(Locale.ROOT) ?: detectedFormat
                    expectedTotalBytes = body.contentLength
                    supportsRange = body.supportsRange ?: true
                }
            } else {
                // Backend check failed or rejected with 4xx error body
                if (track.downloadAvailability == "PREVIEW_ONLY" || track.downloadAvailability == "STREAM_ONLY" || track.downloadAvailability == "UNAVAILABLE") {
                    val reason = track.downloadReason ?: "Full-song download unavailable for \"${track.title}\" (${track.downloadAvailability})."
                    upsertTask(task.copy(status = DownloadStatus.FAILED, errorMessage = reason))
                    return@withContext Result.failure(IllegalStateException(reason))
                }
                if (resolvedUrl.isNullOrBlank()) {
                    val candidate = track.previewUrl
                    if (AudioScanner.isPreviewOrSampleUrl(candidate)) {
                        val reason = "\"${track.title}\" only provides a 30-second preview clip on ${track.sourcePlatform}. Full-song download is blocked."
                        upsertTask(task.copy(status = DownloadStatus.FAILED, errorMessage = reason))
                        return@withContext Result.failure(IllegalStateException(reason))
                    }
                    resolvedUrl = candidate
                }
            }

            val streamUrl = resolvedUrl
            if (streamUrl.isNullOrBlank() || AudioScanner.isPreviewOrSampleUrl(streamUrl)) {
                val reason = "No verified full-length audio source available for \"${track.title}\"."
                upsertTask(task.copy(status = DownloadStatus.FAILED, errorMessage = reason))
                return@withContext Result.failure(IllegalStateException(reason))
            }

            val ext = when {
                !detectedFormat.isNullOrBlank() && AudioScanner.isSupportedAudio("track.$detectedFormat") -> detectedFormat
                streamUrl.contains(".flac", ignoreCase = true) -> "flac"
                streamUrl.contains(".wav", ignoreCase = true) -> "wav"
                streamUrl.contains(".aac", ignoreCase = true) -> "aac"
                streamUrl.contains(".m4a", ignoreCase = true) -> "m4a"
                streamUrl.contains(".ogg", ignoreCase = true) -> "ogg"
                else -> "mp3"
            }

            val songsDir = AudioScanner.getSongsDirectory(context)
            val audioFile = File(songsDir, "$cleanTitle - $cleanArtist.$ext")
            val partFile = File(songsDir, "$cleanTitle - $cleanArtist.$ext.part")
            val artFile = File(songsDir, "$cleanTitle - $cleanArtist.jpg")

            var existingBytes = if (partFile.exists()) partFile.length() else 0L
            task = task.copy(
                status = DownloadStatus.DOWNLOADING,
                bytesDownloaded = existingBytes,
                totalBytes = expectedTotalBytes ?: 0L,
                expectedDurationMs = expectedDurationMs,
                fileFormat = ext.uppercase(Locale.ROOT),
                partFilePath = partFile.absolutePath,
                downloadUrl = streamUrl,
                supportsRange = supportsRange,
                errorMessage = null
            )
            upsertTask(task)

            // 2. Resumable HTTP Range transfer into staged .part file
            val conn = (URL(streamUrl).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000
                readTimeout = 30000
                instanceFollowRedirects = true
                if (existingBytes > 0L) {
                    setRequestProperty("Range", "bytes=$existingBytes-")
                }
            }

            var responseCode = conn.responseCode
            if (responseCode == 416 && existingBytes > 0L) {
                // If local .part already reached or exceeded range, validate directly or restart from byte 0
                conn.disconnect()
                val connFresh = (URL(streamUrl).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15000
                    readTimeout = 30000
                    instanceFollowRedirects = true
                }
                existingBytes = 0L
                responseCode = connFresh.responseCode
                downloadConnectionToPart(connFresh, responseCode, partFile, existingBytes, task) { updated ->
                    task = updated
                    upsertTask(updated)
                }
                connFresh.disconnect()
            } else {
                if (responseCode !in 200..299) {
                    val code = responseCode
                    conn.disconnect()
                    throw IllegalStateException("Download server returned HTTP $code")
                }
                val finalUrl = conn.url?.toString()
                if (AudioScanner.isPreviewOrSampleUrl(finalUrl)) {
                    conn.disconnect()
                    throw IllegalStateException("Redirected to a preview-only clip; blocked.")
                }
                val contentType = conn.contentType?.lowercase(Locale.ROOT).orEmpty()
                if (contentType.contains("text/html") || contentType.contains("application/json")) {
                    conn.disconnect()
                    throw IllegalStateException("Source returned a webpage/JSON instead of an audio file.")
                }
                downloadConnectionToPart(conn, responseCode, partFile, existingBytes, task) { updated ->
                    task = updated
                    upsertTask(updated)
                }
                conn.disconnect()
            }

            // If user paused or cancelled mid-stream, exit without promoting .part to library
            if (cancelledTrackIds.contains(track.id)) {
                partFile.delete()
                removeTask(track.id)
                return@withContext Result.failure(CancellationException("Download cancelled"))
            }
            if (pausedTrackIds.contains(track.id)) {
                upsertTask(task.copy(status = DownloadStatus.PAUSED, bytesDownloaded = partFile.length()))
                return@withContext Result.failure(CancellationException("Download paused"))
            }

            // 3. Integrity & actual audio duration validation BEFORE committing
            task = task.copy(status = DownloadStatus.VALIDATING, bytesDownloaded = partFile.length())
            upsertTask(task)

            val expectedContentLen = task.totalBytes.takeIf { it > 0L } ?: expectedTotalBytes
            val validation = AudioScanner.validatePartFileBeforeCommit(
                partFile = partFile,
                expectedDurationMs = expectedDurationMs,
                expectedContentLength = expectedContentLen
            )
            if (!validation.valid) {
                val reason = validation.errorMessage ?: "Downloaded audio failed full-length validation."
                partFile.delete()
                upsertTask(task.copy(status = DownloadStatus.FAILED, errorMessage = reason))
                return@withContext Result.failure(IllegalStateException(reason))
            }

            // 4. Cache cover artwork offline alongside verified audio file
            if (!track.artworkUrl.isNullOrBlank()) {
                runCatching {
                    val artConn = (URL(track.artworkUrl).openConnection() as HttpURLConnection).apply {
                        connectTimeout = 10000
                        readTimeout = 10000
                    }
                    artConn.inputStream.use { input ->
                        artFile.outputStream().use { output -> input.copyTo(output) }
                    }
                }.onFailure {
                    artFile.delete()
                }
            }

            // 5. Atomically promote .part -> final audio file and register in Room & scanner
            if (audioFile.exists()) audioFile.delete()
            if (!partFile.renameTo(audioFile)) {
                partFile.copyTo(audioFile, overwrite = true)
                partFile.delete()
            }

            val finalFormat = AudioScanner.extractFileFormat(audioFile.name)
            val downloadedEntity = SongEntity(
                id = "songs_${audioFile.absolutePath.hashCode()}",
                title = track.title,
                artist = track.artist,
                album = track.album ?: track.movieName ?: "Downloaded Songs",
                durationMs = validation.actualDurationMs,
                uri = Uri.fromFile(audioFile).toString(),
                artworkUri = if (artFile.exists() && artFile.length() > 0L) Uri.fromFile(artFile).toString() else track.artworkUrl,
                trackNumber = 0,
                year = track.releaseYear ?: 0,
                genre = track.language,
                dateAdded = System.currentTimeMillis(),
                isFavorite = false,
                source = AudioSource.DOWNLOADED.name,
                fileFormat = finalFormat,
                folderName = "Songs"
            )
            songDao.insertSong(downloadedEntity)
            audioScanner.scanLocalAudio()
            removeTask(track.id)
            Result.success(downloadedEntity.toDomain())
        } catch (e: CancellationException) {
            if (pausedTrackIds.contains(track.id)) {
                val partLen = runCatching { File(task.partFilePath).length() }.getOrDefault(task.bytesDownloaded)
                upsertTask(task.copy(status = DownloadStatus.PAUSED, bytesDownloaded = partLen))
            }
            Result.failure(e)
        } catch (e: Exception) {
            val partLen = runCatching {
                if (task.partFilePath.isNotBlank()) File(task.partFilePath).length() else 0L
            }.getOrDefault(0L)
            upsertTask(
                task.copy(
                    status = DownloadStatus.FAILED,
                    bytesDownloaded = partLen,
                    errorMessage = e.message ?: "Download failed for ${track.title}"
                )
            )
            Result.failure(e)
        }
    }

    private suspend fun downloadConnectionToPart(
        conn: HttpURLConnection,
        responseCode: Int,
        partFile: File,
        existingBytes: Long,
        initialTask: DownloadTaskInfo,
        onProgress: (DownloadTaskInfo) -> Unit
    ) {
        val append = responseCode == HttpURLConnection.HTTP_PARTIAL && existingBytes > 0L
        val totalFromRange = parseContentRangeTotalBytes(conn.getHeaderField("Content-Range"))
        val headerLen = conn.contentLengthLong.takeIf { it > 0L }
        val totalBytes = totalFromRange ?: if (append && headerLen != null) existingBytes + headerLen else (headerLen ?: initialTask.totalBytes)
        var downloaded = if (append) existingBytes else 0L
        if (!append && partFile.exists()) {
            partFile.delete()
        }

        val buffer = ByteArray(16 * 1024)
        var lastEmitAt = 0L

        conn.inputStream.use { input ->
            FileOutputStream(partFile, append).use { output ->
                while (true) {
                    currentCoroutineContext().ensureActive()
                    if (pausedTrackIds.contains(initialTask.trackId) || cancelledTrackIds.contains(initialTask.trackId)) {
                        output.flush()
                        break
                    }
                    val read = input.read(buffer)
                    if (read == -1) break
                    output.write(buffer, 0, read)
                    downloaded += read
                    val now = System.currentTimeMillis()
                    if (now - lastEmitAt >= 250L) {
                        lastEmitAt = now
                        onProgress(
                            initialTask.copy(
                                status = DownloadStatus.DOWNLOADING,
                                bytesDownloaded = downloaded,
                                totalBytes = totalBytes
                            )
                        )
                    }
                }
                output.flush()
            }
        }
        onProgress(
            initialTask.copy(
                status = DownloadStatus.DOWNLOADING,
                bytesDownloaded = downloaded,
                totalBytes = maxOf(totalBytes, downloaded)
            )
        )
    }

    override suspend fun getAutoQueueRecommendations(
        songId: String,
        songTitle: String?,
        artist: String?,
        director: String?,
        language: String?,
        genre: String?,
        mood: String?,
        excludeIds: List<String>,
        limit: Int
    ): List<Song> {
        val results = mutableListOf<Song>()
        val excludeSet = excludeIds.toMutableSet()

        // 1. Check local songs snapshot
        try {
            val allLocal = songDao.getAllSongsSnapshot()
            val localMatches = allLocal.filter { local ->
                !excludeSet.contains(local.id) &&
                ((!artist.isNullOrBlank() && local.artist.contains(artist, ignoreCase = true)) ||
                 (!director.isNullOrBlank() && local.artist.contains(director, ignoreCase = true)) ||
                 (!genre.isNullOrBlank() && local.genre?.contains(genre, ignoreCase = true) == true))
            }.map { it.toDomain() }
            results.addAll(localMatches.take(limit))
            excludeSet.addAll(results.map { it.id })
        } catch (_: Exception) {}

        // 2. Fetch from backend auto-queue
        try {
            val req = AutoQueueRequest(
                songId = songId,
                songTitle = songTitle,
                artist = artist,
                director = director,
                language = language,
                genre = genre,
                mood = mood,
                excludeIds = excludeSet.toList(),
                limit = limit
            )
            val response = apiService.getAutoQueue(req)
            if (response.isSuccessful) {
                val tracks = response.body()?.tracks ?: emptyList()
                val onlineSongs = tracks.map { track ->
                    val playUri = track.fullAudioUrl?.takeIf { it.isNotBlank() }
                        ?: track.previewUrl?.takeIf { it.isNotBlank() }
                        ?: track.sourceUrl
                    Song(
                        id = track.id,
                        title = track.title,
                        artist = track.artist,
                        album = track.album ?: track.movieName ?: "Unknown Album",
                        durationMs = track.durationMs,
                        uri = playUri,
                        artworkUri = track.artworkUrl,
                        year = track.releaseYear ?: 0,
                        genre = track.language,
                        source = AudioSource.ONLINE_STREAM
                    )
                }
                results.addAll(onlineSongs)
            }
        } catch (_: Exception) {}

        return results.distinctBy { it.id }.filterNot { excludeIds.contains(it.id) }
    }
}

