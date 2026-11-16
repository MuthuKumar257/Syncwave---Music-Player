package com.syncwave.music

import android.Manifest
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.navigation.compose.rememberNavController
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.playback.manager.PlaybackManager
import com.syncwave.music.ui.navigation.SyncWaveNavHost
import com.syncwave.music.ui.theme.SyncWaveTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var playbackManager: PlaybackManager

    @Inject
    lateinit var musicRepository: MusicRepository

    private var mediaStoreObserver: ContentObserver? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val storageGranted = permissions[Manifest.permission.READ_MEDIA_AUDIO] == true ||
                permissions[Manifest.permission.READ_EXTERNAL_STORAGE] == true

        if (storageGranted) {
            triggerMusicScan()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkAndRequestPermissions()
        registerAudioContentObserver()

        setContent {
            SyncWaveTheme {
                val navController = rememberNavController()
                SyncWaveNavHost(
                    navController = navController,
                    playbackManager = playbackManager
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        triggerMusicScan()
    }

    override fun onPause() {
        super.onPause()
        playbackManager.persistPlaybackSession(immediate = true)
    }

    override fun onStop() {
        super.onStop()
        playbackManager.persistPlaybackSession(immediate = true)
    }

    override fun onDestroy() {
        mediaStoreObserver?.let { contentResolver.unregisterContentObserver(it) }
        super.onDestroy()
    }

    private fun registerAudioContentObserver() {
        if (mediaStoreObserver != null) return
        val observer = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean) {
                triggerMusicScan()
            }
        }
        mediaStoreObserver = observer
        contentResolver.registerContentObserver(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            true,
            observer
        )
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_AUDIO)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        } else {
            triggerMusicScan()
        }
    }

    private fun triggerMusicScan() {
        CoroutineScope(Dispatchers.IO).launch {
            musicRepository.scanLocalMusic()
        }
    }
}

