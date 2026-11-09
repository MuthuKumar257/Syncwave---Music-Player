package com.syncwave.music.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.RepeatType
import com.syncwave.music.domain.model.SchedulePriority
import com.syncwave.music.ui.theme.AccentAmber
import com.syncwave.music.ui.theme.AccentCyan
import com.syncwave.music.ui.theme.ErrorRed
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SecondaryGreen
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import com.syncwave.music.ui.theme.TextTertiaryDark

@Composable
fun ScheduleCard(
    schedule: MusicSchedule,
    onToggleEnabled: (Boolean) -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceDark)
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(if (schedule.isEnabled) PrimaryPurple.copy(alpha = 0.2f) else TextTertiaryDark.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Alarm,
                        contentDescription = null,
                        tint = if (schedule.isEnabled) PrimaryPurple else TextTertiaryDark,
                        modifier = Modifier.size(22.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column {
                    Text(
                        text = schedule.name,
                        color = if (schedule.isEnabled) TextPrimaryDark else TextSecondaryDark,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = formatTimeDisplay(schedule.startTime),
                        color = if (schedule.isEnabled) SecondaryGreen else TextTertiaryDark,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp
                    )
                }
            }

            Switch(
                checked = schedule.isEnabled,
                onCheckedChange = onToggleEnabled,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = TextPrimaryDark,
                    checkedTrackColor = SecondaryGreen,
                    uncheckedThumbColor = TextSecondaryDark,
                    uncheckedTrackColor = SurfaceDark
                )
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.QueueMusic,
                contentDescription = null,
                tint = TextTertiaryDark,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = "${schedule.targetType.name}: ${schedule.targetName}",
                color = TextSecondaryDark,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )

            // Recurrence badge
            BadgeChip(
                text = when (schedule.repeatType) {
                    RepeatType.ONCE -> "Once"
                    RepeatType.DAILY -> "Daily"
                    RepeatType.WEEKDAYS -> "Weekdays"
                    RepeatType.CUSTOM_DAYS -> "Custom"
                },
                backgroundColor = AccentCyan.copy(alpha = 0.15f),
                textColor = AccentCyan
            )

            Spacer(modifier = Modifier.width(6.dp))

            // Priority badge
            val (badgeBg, badgeText) = when (schedule.priority) {
                SchedulePriority.LOW -> TextTertiaryDark.copy(alpha = 0.2f) to TextTertiaryDark
                SchedulePriority.NORMAL -> PrimaryPurple.copy(alpha = 0.2f) to PrimaryPurple
                SchedulePriority.HIGH -> AccentAmber.copy(alpha = 0.2f) to AccentAmber
                SchedulePriority.URGENT -> ErrorRed.copy(alpha = 0.2f) to ErrorRed
            }
            BadgeChip(
                text = schedule.priority.name,
                backgroundColor = badgeBg,
                textColor = badgeText
            )
        }
    }
}

@Composable
fun BadgeChip(
    text: String,
    backgroundColor: Color,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(backgroundColor)
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

fun formatTimeDisplay(timeStr: String): String {
    return try {
        val parts = timeStr.split(":")
        val hour = parts[0].toInt()
        val minute = parts[1].toInt()
        val amPm = if (hour >= 12) "PM" else "AM"
        val displayHour = when {
            hour == 0 -> 12
            hour > 12 -> hour - 12
            else -> hour
        }
        String.format("%02d:%02d %s", displayHour, minute, amPm)
    } catch (_: Exception) {
        timeStr
    }
}
