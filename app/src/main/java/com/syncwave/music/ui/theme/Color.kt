package com.syncwave.music.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// SyncWave Premium Color Palette (Dark-first design)
val BackgroundDark = Color(0xFF101014)
val SurfaceDark = Color(0xFF1B1B23)
val SurfaceVariantDark = Color(0xFF252530)
val CardBackgroundDark = Color(0xFF1E1E28)

val PrimaryPurple = Color(0xFF8B5CF6)
val PrimaryPurpleVariant = Color(0xFF7C3AED)
val SecondaryGreen = Color(0xFF22C55E)
val SecondaryGreenVariant = Color(0xFF16A34A)

val AccentCyan = Color(0xFF06B6D4)
val AccentPink = Color(0xFFEC4899)
val AccentAmber = Color(0xFFF59E0B)
val ErrorRed = Color(0xFFEF4444)

val TextPrimaryDark = Color(0xFFFFFFFF)
val TextSecondaryDark = Color(0xFFA1A1AA)
val TextTertiaryDark = Color(0xFF71717A)
val DividerDark = Color(0xFF2E2E3A)

// Gradients
val PrimaryGradient = Brush.horizontalGradient(
    colors = listOf(PrimaryPurple, AccentPink)
)
val ActiveScheduleGradient = Brush.horizontalGradient(
    colors = listOf(PrimaryPurple, SecondaryGreen)
)
val CardGradient = Brush.verticalGradient(
    colors = listOf(Color(0xFF242432), Color(0xFF1B1B23))
)
