package com.syncwave.music.ui.navigation

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
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
import com.syncwave.music.ui.onboarding.OnboardingScreen
import com.syncwave.music.ui.onboarding.OnboardingViewModel
import com.syncwave.music.ui.player.NowPlayingScreen
import com.syncwave.music.ui.scheduler.ScheduleCreateEditScreen
import com.syncwave.music.ui.scheduler.SchedulerDashboardScreen
import com.syncwave.music.ui.settings.SettingsScreen
import com.syncwave.music.ui.theme.BackgroundDark
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark

@Composable
fun SyncWaveNavHost(
    navController: NavHostController,
    playbackManager: PlaybackManager,
    defaultFolderPromptViewModel: DefaultFolderPromptViewModel = hiltViewModel()
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val playbackState by playbackManager.playbackState.collectAsStateWithLifecycle()
    val shouldShowFolderPrompt by defaultFolderPromptViewModel.shouldShowPrompt.collectAsStateWithLifecycle()
    val playbackSnackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(playbackState.errorMessage) {
        val msg = playbackState.errorMessage
        if (!msg.isNullOrBlank()) {
            playbackSnackbarHostState.showSnackbar(msg)
            playbackManager.clearError()
        }
    }

    val defaultFolderPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree()
    ) { treeUri ->
        if (treeUri != null) {
            defaultFolderPromptViewModel.onFolderSelected(treeUri)
        }
    }

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
        snackbarHost = { SnackbarHost(hostState = playbackSnackbarHostState) },
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
                        onNavigateToPlaylist = { plId -> navController.navigate(Screen.PlaylistDetail.createRoute(plId)) },
                        onNavigateToOnboarding = { navController.navigate(Screen.Onboarding.route) }
                    )
                }

                composable(Screen.Onboarding.route) {
                    val onboardingViewModel: OnboardingViewModel = hiltViewModel()
                    OnboardingScreen(
                        viewModel = onboardingViewModel,
                        onComplete = { navController.popBackStack() }
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
                    SettingsScreen(
                        onNavigateToOnboarding = { navController.navigate(Screen.Onboarding.route) },
                        onNavigateToLogin = { navController.navigate(Screen.Login.route) },
                        onNavigateToSignUp = { navController.navigate(Screen.SignUp.route) }
                    )
                }
                composable(Screen.Login.route) {
                    com.syncwave.music.ui.auth.LoginScreen(
                        onBack = { navController.popBackStack() },
                        onNavigateToSignUp = {
                            navController.navigate(Screen.SignUp.route) {
                                popUpTo(Screen.Login.route) { inclusive = true }
                            }
                        },
                        onAuthSuccess = { navController.popBackStack() }
                    )
                }
                composable(Screen.SignUp.route) {
                    com.syncwave.music.ui.auth.SignUpScreen(
                        onBack = { navController.popBackStack() },
                        onNavigateToLogin = {
                            navController.navigate(Screen.Login.route) {
                                popUpTo(Screen.SignUp.route) { inclusive = true }
                            }
                        },
                        onAuthSuccess = { navController.popBackStack() }
                    )
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

    if (shouldShowFolderPrompt) {
        AlertDialog(
            onDismissRequest = { defaultFolderPromptViewModel.dismissPrompt() },
            containerColor = SurfaceDark,
            title = {
                Text(
                    text = "Select Default Music Folder",
                    color = TextPrimaryDark,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Text(
                    text = "Choose your preferred local music folder to scan automatically offline on every launch. You can change it or add more folders anytime in Profile -> Settings.",
                    color = TextSecondaryDark
                )
            },
            confirmButton = {
                Button(
                    onClick = { defaultFolderPicker.launch(null) },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple)
                ) {
                    Text("Select Folder")
                }
            },
            dismissButton = {
                TextButton(onClick = { defaultFolderPromptViewModel.dismissPrompt() }) {
                    Text("Skip", color = TextSecondaryDark)
                }
            }
        )
    }
}

