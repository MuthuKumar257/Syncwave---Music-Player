package com.syncwave.music.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

// Nested Radius Scale (outer - padding = inner)
val Shapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp), // Micro tags
    small = RoundedCornerShape(6.dp),      // Filter chips, badges
    medium = RoundedCornerShape(8.dp),     // Controls, buttons, inner artwork
    large = RoundedCornerShape(14.dp),     // Cards
    extraLarge = RoundedCornerShape(16.dp) // Modals, bottom sheets
)
