package com.syncwave.music.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// Unslop Graphite Ramp (Craft & Restraint)
val BackgroundDark = Color(0xFF141415)
val SurfaceDeepest = Color(0xFF0F0F10)
val SurfaceDark = Color(0xFF19191B)
val SurfaceRaisedDark = Color(0xFF232325)
val SurfaceVariantDark = Color(0xFF232325)
val CardBackgroundDark = Color(0xFF19191B)

// Hairline at 8% opacity
val HairlineDark = Color(0x14EDEDED)
val HairlineLight = Color(0x20EDEDED)

// World Accent: Studio Hardware Amber / Warm Indicator
val AccentAmber = Color(0xFFF59E0B)
val AccentAmberHover = Color(0xFFD97706)
val AccentAmberMuted = Color(0x26F59E0B)

// Primary Off-White & Semantic Colors
val PrimaryStudio = Color(0xFFEDEDED)
val PrimaryPurple = Color(0xFFEDEDED) // Aliased to off-white for craft restraint
val PrimaryPurpleVariant = Color(0xFF232325)
val SecondaryGreen = Color(0xFFF59E0B) // Aliased to warm amber
val SecondaryGreenVariant = Color(0xFFD97706)

val AccentCyan = Color(0xFFEDEDED)
val AccentPink = Color(0xFFEDEDED)
val ErrorRed = Color(0xFFE5484D)
val SuccessGreen = Color(0xFF4CC38A)

// Text Roles from Graphite Ramp
val TextPrimaryDark = Color(0xFFEDEDED)
val TextSecondaryDark = Color(0xFFA1A1A6)
val TextTertiaryDark = Color(0xFF85858B)
val DividerDark = HairlineDark

// Single-Neutral Tone Shifts (No Hue Gradients)
val PrimaryGradient = Brush.horizontalGradient(
    colors = listOf(Color(0xFF232325), Color(0xFF19191B))
)
val ActiveScheduleGradient = Brush.horizontalGradient(
    colors = listOf(Color(0xFF232325), Color(0xFF1F1F21))
)
val CardGradient = Brush.verticalGradient(
    colors = listOf(Color(0xFF232325), Color(0xFF19191B))
)
