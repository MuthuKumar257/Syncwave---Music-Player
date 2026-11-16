package com.syncwave.music.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.CompassCalibration
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String? = null, val icon: ImageVector? = null) {
    object Home : Screen("home", "Home", Icons.Default.Home)
    object Discover : Screen("discover", "Discover", Icons.Default.CompassCalibration)
    object Library : Screen("library", "Library", Icons.Default.LibraryMusic)
    object Scheduler : Screen("scheduler", "Scheduler", Icons.Default.Alarm)
    object Settings : Screen("settings", "Profile", Icons.Default.Person)

    object NowPlaying : Screen("now_playing")
    object Onboarding : Screen("onboarding")
    object Login : Screen("login")
    object SignUp : Screen("signup")
    object CreateSchedule : Screen("create_schedule")
    object EditSchedule : Screen("edit_schedule/{scheduleId}") {
        fun createRoute(scheduleId: String) = "edit_schedule/$scheduleId"
    }
    object PlaylistDetail : Screen("playlist/{playlistId}") {
        fun createRoute(playlistId: String) = "playlist/$playlistId"
    }

    companion object {
        val bottomNavDestinations = listOf(Home, Discover, Library, Scheduler, Settings)
    }
}

