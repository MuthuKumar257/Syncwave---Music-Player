package com.syncwave.music.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import com.syncwave.music.playback.manager.PlaybackManager
import com.syncwave.music.ui.components.MiniPlayer
import com.syncwave.music.ui.discover.DiscoverScreen
import com.syncwave.music.ui.home.HomeScreen
import com.syncwave.music.ui.library.LibraryScreen
import com.syncwave.music.ui.library.PlaylistDetailScreen
import com.syncwave.music.ui.player.NowPlayingScreen
import com.syncwave.music.ui.scheduler.ScheduleCreateEditScreen
import com.syncwave.music.ui.scheduler.SchedulerDashboardScreen
import com.syncwave.music.ui.settings.SettingsScreen
import com.syncwave.music.ui.theme.BackgroundDark

@Composable
fun SyncWaveNavHost(
    navController: NavHostController,
    playbackManager: PlaybackManager
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val playbackState by playbackManager.playbackState.collectAsStateWithLifecycle()

    val showBottomBar = currentRoute in listOf(
        Screen.Home.route,
        Screen.Discover.route,
        Screen.Library.route,
        Screen.Scheduler.route,
        Screen.Settings.route
    )

    val showMiniPlayer = playbackState.currentSong != null && currentRoute != Screen.NowPlaying.route

    Scaffold(
        containerColor = BackgroundDark,
        bottomBar = {
            if (showBottomBar) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    if (showMiniPlayer) {
                        MiniPlayer(
                            playbackState = playbackState,
                            onPlayPauseClick = { playbackManager.togglePlayPause() },
                            onSkipNextClick = { playbackManager.skipToNext() },
                            onClick = { navController.navigate(Screen.NowPlaying.route) }
                        )
                    }
                    SyncWaveBottomBar(navController = navController)
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            NavHost(
                navController = navController,
                startDestination = Screen.Home.route,
                modifier = Modifier.fillMaxSize()
            ) {
                composable(Screen.Home.route) {
                    HomeScreen(
                        onNavigateToScheduler = { navController.navigate(Screen.Scheduler.route) },
                        onNavigateToPlaylist = { plId -> navController.navigate(Screen.PlaylistDetail.createRoute(plId)) }
                    )
                }

                composable(Screen.Discover.route) {
                    DiscoverScreen()
                }

                composable(Screen.Library.route) {
                    LibraryScreen(
                        onNavigateToPlaylist = { plId -> navController.navigate(Screen.PlaylistDetail.createRoute(plId)) }
                    )
                }

                composable(Screen.Scheduler.route) {
                    SchedulerDashboardScreen(
                        onNavigateToCreate = { navController.navigate(Screen.CreateSchedule.route) },
                        onNavigateToEdit = { sId -> navController.navigate(Screen.EditSchedule.createRoute(sId)) }
                    )
                }

                composable(Screen.Settings.route) {
                    SettingsScreen()
                }

                composable(Screen.NowPlaying.route) {
                    NowPlayingScreen(
                        onDismiss = { navController.popBackStack() }
                    )
                }

                composable(Screen.CreateSchedule.route) {
                    ScheduleCreateEditScreen(
                        scheduleId = null,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

                composable(
                    route = Screen.EditSchedule.route,
                    arguments = listOf(navArgument("scheduleId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val scheduleId = backStackEntry.arguments?.getString("scheduleId")
                    ScheduleCreateEditScreen(
                        scheduleId = scheduleId,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

                composable(
                    route = Screen.PlaylistDetail.route,
                    arguments = listOf(navArgument("playlistId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val playlistId = backStackEntry.arguments?.getString("playlistId") ?: ""
                    PlaylistDetailScreen(
                        playlistId = playlistId,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}
