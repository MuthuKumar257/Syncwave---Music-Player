package com.syncwave.music.playback.sync

import android.os.Build
import com.google.gson.Gson
import com.syncwave.music.data.remote.HeartbeatDeviceRequest
import com.syncwave.music.data.remote.PendingCommandDto
import com.syncwave.music.data.remote.PlaybackSessionSnapshotDto
import com.syncwave.music.data.remote.PublishPlaybackStateRequest
import com.syncwave.music.data.remote.RegisterDeviceRequest
import com.syncwave.music.data.remote.RemoteCommandRequest
import com.syncwave.music.data.remote.SessionDeviceDto
import com.syncwave.music.data.remote.SessionPlaybackDto
import com.syncwave.music.data.remote.SessionTrackDto
import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.data.remote.TransferDeviceRequest
import com.syncwave.music.data.remote.UnregisterDeviceRequest
import com.syncwave.music.data.repository.PreferencesRepository
import com.syncwave.music.domain.model.AudioSource
import com.syncwave.music.domain.model.PlaybackState
import com.syncwave.music.domain.model.RepeatMode
import com.syncwave.music.domain.model.Song
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

data class DeviceSessionUiState(
    val isConnected: Boolean = false,
    val myDeviceId: String = "",
    val myDeviceName: String = "Android (${Build.MODEL})",
    val activeDeviceId: String? = null,
    val isRemoteMode: Boolean = false,
    val devices: List<SessionDeviceDto> = emptyList(),
    val remotePlayback: SessionPlaybackDto? = null,
    val errorMessage: String? = null
) {
    val activeDeviceName: String?
        get() = devices.firstOrNull { it.deviceId == activeDeviceId }?.deviceName
}

interface PlaybackSessionCommandReceiver {
    fun onHaltLocalAudioForRemoteHandoff(activeDeviceName: String?)
    fun onMirrorRemotePlayback(playback: SessionPlaybackDto, activeDeviceName: String?)
    fun onExecuteRemoteCommand(cmd: PendingCommandDto)
}

@Singleton
class PlaybackSessionCoordinator @Inject constructor(
    private val apiService: SyncWaveApiService,
    private val preferencesRepository: PreferencesRepository
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val gson = Gson()

    private val _sessionState = MutableStateFlow(DeviceSessionUiState())
    val sessionState: StateFlow<DeviceSessionUiState> = _sessionState.asStateFlow()

    private var commandReceiver: PlaybackSessionCommandReceiver? = null
    private var syncJob: Job? = null
    private var heartbeatJob: Job? = null
    private var currentToken: String? = null
    private var currentRevision: Int = 0
    private var highestAckSeq: Int = 0
    private val processedSeqs = HashSet<Int>()

    init {
        scope.launch {
            preferencesRepository.authToken
                .distinctUntilChanged()
                .collect { token ->
                    if (!token.isNullOrBlank()) {
                        startSync(token)
                    } else {
                        stopSync()
                    }
                }
        }
    }

    fun attachReceiver(receiver: PlaybackSessionCommandReceiver) {
        commandReceiver = receiver
    }

    private suspend fun startSync(token: String) {
        stopSync()
        currentToken = token
        val deviceId = preferencesRepository.getOrCreateDeviceId()
        val deviceName = "Android (${Build.MODEL ?: "Phone"})"
        _sessionState.update { it.copy(myDeviceId = deviceId, myDeviceName = deviceName, errorMessage = null) }

        val bearer = "Bearer $token"
        try {
            val reg = apiService.registerPlaybackDevice(
                bearer = bearer,
                req = RegisterDeviceRequest(deviceId = deviceId, deviceName = deviceName, platform = "ANDROID")
            )
            reg.body()?.session?.let { applySnapshot(it) }
        } catch (_: Exception) {
            return
        }

        syncJob = scope.launch {
            while (isActive && currentToken == token) {
                try {
                    val res = apiService.pollPlaybackSession(
                        bearer = bearer,
                        deviceId = deviceId,
                        sinceRevision = currentRevision,
                        timeoutMs = 15000,
                        ackSeq = highestAckSeq
                    )
                    if (res.code() == 401) break
                    res.body()?.session?.let { applySnapshot(it) }
                } catch (_: Exception) {
                    delay(2500L)
                }
            }
        }

        heartbeatJob = scope.launch {
            while (isActive && currentToken == token) {
                delay(20000L)
                try {
                    val hb = apiService.playbackDeviceHeartbeat(
                        bearer = bearer,
                        req = HeartbeatDeviceRequest(deviceId = deviceId, ackSeq = highestAckSeq)
                    )
                    hb.body()?.session?.let { applySnapshot(it) }
                } catch (_: Exception) {}
            }
        }
    }

    private fun stopSync() {
        val prevToken = currentToken
        val prevDeviceId = _sessionState.value.myDeviceId
        val wasConnected = _sessionState.value.isConnected

        currentToken = null
        syncJob?.cancel()
        heartbeatJob?.cancel()
        syncJob = null
        heartbeatJob = null
        currentRevision = 0
        highestAckSeq = 0
        processedSeqs.clear()

        _sessionState.update {
            it.copy(
                isConnected = false,
                activeDeviceId = null,
                isRemoteMode = false,
                devices = emptyList(),
                remotePlayback = null
            )
        }

        if (!prevToken.isNullOrBlank() && wasConnected && prevDeviceId.isNotBlank()) {
            scope.launch {
                try {
                    apiService.unregisterPlaybackDevice("Bearer $prevToken", UnregisterDeviceRequest(prevDeviceId))
                } catch (_: Exception) {}
            }
        }
    }

    private fun applySnapshot(snapshot: PlaybackSessionSnapshotDto) {
        val myDeviceId = _sessionState.value.myDeviceId
        val isRemote = !snapshot.activeDeviceId.isNullOrBlank() && snapshot.activeDeviceId != myDeviceId
        val activeName = snapshot.devices.firstOrNull { it.deviceId == snapshot.activeDeviceId }?.deviceName

        currentRevision = snapshot.revision

        if (isRemote) {
            commandReceiver?.onHaltLocalAudioForRemoteHandoff(activeName)
            commandReceiver?.onMirrorRemotePlayback(snapshot.playback, activeName)
        }

        for (cmd in snapshot.commands) {
            if (cmd.seq > highestAckSeq) highestAckSeq = cmd.seq
            if (!processedSeqs.add(cmd.seq)) continue
            if (cmd.type == "STOP_LOCAL") {
                commandReceiver?.onHaltLocalAudioForRemoteHandoff(activeName)
            } else if (!isRemote || cmd.type == "SYNC_TAKEOVER") {
                commandReceiver?.onExecuteRemoteCommand(cmd)
            }
        }

        _sessionState.update {
            it.copy(
                isConnected = true,
                activeDeviceId = snapshot.activeDeviceId,
                isRemoteMode = isRemote,
                devices = snapshot.devices,
                remotePlayback = snapshot.playback,
                errorMessage = null
            )
        }
    }

    fun transferToDevice(targetDeviceId: String) {
        val token = currentToken ?: return
        val deviceId = _sessionState.value.myDeviceId
        if (deviceId.isBlank()) return

        scope.launch {
            try {
                val res = apiService.transferPlaybackDevice(
                    bearer = "Bearer $token",
                    req = TransferDeviceRequest(deviceId = deviceId, targetDeviceId = targetDeviceId)
                )
                val body = res.body()
                if (res.isSuccessful && body?.success == true && body.session != null) {
                    applySnapshot(body.session)
                } else {
                    _sessionState.update { it.copy(errorMessage = body?.message ?: "Could not switch playing device.") }
                }
            } catch (_: Exception) {
                _sessionState.update { it.copy(errorMessage = "Network error transferring playback.") }
            }
        }
    }

    fun sendRemoteCommand(type: String, payload: Map<String, Any>? = null) {
        val token = currentToken ?: return
        val deviceId = _sessionState.value.myDeviceId
        if (deviceId.isBlank()) return

        scope.launch {
            try {
                val res = apiService.sendRemotePlaybackCommand(
                    bearer = "Bearer $token",
                    req = RemoteCommandRequest(deviceId = deviceId, type = type, payload = payload)
                )
                res.body()?.session?.let { applySnapshot(it) }
            } catch (_: Exception) {}
        }
    }

    fun publishActiveState(state: PlaybackState) {
        val token = currentToken ?: return
        val session = _sessionState.value
        if (!session.isConnected || session.isRemoteMode || session.myDeviceId.isBlank()) return

        scope.launch {
            try {
                val res = apiService.publishPlaybackState(
                    bearer = "Bearer $token",
                    req = PublishPlaybackStateRequest(
                        deviceId = session.myDeviceId,
                        track = state.currentSong?.toSessionTrackDto(),
                        isPlaying = state.isPlaying,
                        positionSec = state.currentPositionMs / 1000.0,
                        durationSec = state.durationMs / 1000.0,
                        queue = state.queue.take(50).map { it.toSessionTrackDto() },
                        queueIndex = state.queueIndex,
                        volume = state.volume,
                        isShuffle = state.isShuffleEnabled,
                        repeatMode = state.repeatMode.name
                    )
                )
                if (res.code() == 409) {
                    val activeName = _sessionState.value.activeDeviceName
                    commandReceiver?.onHaltLocalAudioForRemoteHandoff(activeName)
                    _sessionState.update { it.copy(isRemoteMode = true) }
                }
            } catch (_: Exception) {}
        }
    }

    fun parseTrack(json: com.google.gson.JsonElement?): SessionTrackDto? {
        if (json == null || !json.isJsonObject) return null
        return try {
            gson.fromJson(json, SessionTrackDto::class.java)
        } catch (_: Exception) {
            null
        }
    }

    fun parseQueue(json: com.google.gson.JsonElement?): List<SessionTrackDto> {
        if (json == null || !json.isJsonArray) return emptyList()
        return try {
            json.asJsonArray.mapNotNull { gson.fromJson(it, SessionTrackDto::class.java) }
        } catch (_: Exception) {
            emptyList()
        }
    }
}

fun Song.toSessionTrackDto(): SessionTrackDto = SessionTrackDto(
    id = id,
    title = title,
    artist = artist,
    album = album,
    durationMs = durationMs,
    artworkUrl = artworkUri,
    externalUrl = uri,
    source = when (source) {
        AudioSource.LOCAL -> "LOCAL"
        AudioSource.DOWNLOADED -> "DOWNLOADED"
        AudioSource.ONLINE_STREAM -> "YOUTUBE"
    }
)

fun SessionTrackDto.toDomainSong(): Song = Song(
    id = id,
    title = title,
    artist = artist,
    album = album ?: "Single",
    durationMs = durationMs ?: 240000L,
    uri = externalUrl ?: if (!videoId.isNullOrBlank()) "https://youtube.com/watch?v=$videoId" else "",
    artworkUri = artworkUrl,
    source = when (source) {
        "LOCAL" -> AudioSource.LOCAL
        "DOWNLOADED" -> AudioSource.DOWNLOADED
        else -> AudioSource.ONLINE_STREAM
    }
)

fun parseRepeatMode(raw: String?): RepeatMode = when (raw) {
    "ALL" -> RepeatMode.ALL
    "ONE" -> RepeatMode.ONE
    else -> RepeatMode.OFF
}
