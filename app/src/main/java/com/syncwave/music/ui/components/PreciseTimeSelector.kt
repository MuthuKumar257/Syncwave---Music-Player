package com.syncwave.music.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.syncwave.music.domain.utils.TimeSelectionUtils
import com.syncwave.music.ui.theme.CardBackgroundDark
import com.syncwave.music.ui.theme.PrimaryPurple
import com.syncwave.music.ui.theme.SurfaceDark
import com.syncwave.music.ui.theme.TextPrimaryDark
import com.syncwave.music.ui.theme.TextSecondaryDark
import java.util.Locale

@Composable
fun PreciseTimeSelector(
    hour24: Int,
    minute: Int,
    onTimeChanged: (newHour24: Int, newMinute: Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val (hour12, clampedMinute, isPm) = TimeSelectionUtils.from24Hour(hour24, minute)
    var hourMenuExpanded by remember { mutableStateOf(false) }
    var minuteMenuExpanded by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceDark)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "1-minute precision (00–59)",
                color = TextSecondaryDark,
                fontSize = 12.sp
            )
            Text(
                text = TimeSelectionUtils.formatTo12Hour(hour24, clampedMinute),
                color = PrimaryPurple,
                fontSize = 14.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            // Hour selector (01-12)
            Box(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(CardBackgroundDark)
                        .clickable { hourMenuExpanded = true }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = String.format(Locale.US, "%02d", hour12),
                        color = TextPrimaryDark,
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                DropdownMenu(
                    expanded = hourMenuExpanded,
                    onDismissRequest = { hourMenuExpanded = false },
                    modifier = Modifier
                        .background(CardBackgroundDark)
                        .heightIn(max = 260.dp)
                ) {
                    TimeSelectionUtils.ALL_HOURS_12.forEach { h ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = String.format(Locale.US, "%02d", h),
                                    color = if (h == hour12) PrimaryPurple else TextPrimaryDark,
                                    fontFamily = FontFamily.Monospace
                                )
                            },
                            onClick = {
                                val (newH24, newM) = TimeSelectionUtils.to24Hour(h, clampedMinute, isPm)
                                onTimeChanged(newH24, newM)
                                hourMenuExpanded = false
                            }
                        )
                    }
                }
            }

            Text(
                text = ":",
                color = TextSecondaryDark,
                fontSize = 16.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )

            // -1 minute stepper
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(CardBackgroundDark)
                    .clickable {
                        val nextMin = (clampedMinute + 59) % 60
                        val (newH24, newM) = TimeSelectionUtils.to24Hour(hour12, nextMin, isPm)
                        onTimeChanged(newH24, newM)
                    }
                    .padding(horizontal = 10.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "-1m",
                    color = TextSecondaryDark,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium
                )
            }

            // Minute selector (all 60 minutes 00-59)
            Box(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(CardBackgroundDark)
                        .clickable { minuteMenuExpanded = true }
                        .padding(vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = String.format(Locale.US, "%02d", clampedMinute),
                        color = TextPrimaryDark,
                        fontSize = 15.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                DropdownMenu(
                    expanded = minuteMenuExpanded,
                    onDismissRequest = { minuteMenuExpanded = false },
                    modifier = Modifier
                        .background(CardBackgroundDark)
                        .heightIn(max = 300.dp)
                ) {
                    TimeSelectionUtils.ALL_MINUTES.forEach { m ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = String.format(Locale.US, "%02d", m),
                                    color = if (m == clampedMinute) PrimaryPurple else TextPrimaryDark,
                                    fontFamily = FontFamily.Monospace
                                )
                            },
                            onClick = {
                                val (newH24, newM) = TimeSelectionUtils.to24Hour(hour12, m, isPm)
                                onTimeChanged(newH24, newM)
                                minuteMenuExpanded = false
                            }
                        )
                    }
                }
            }

            // +1 minute stepper
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(CardBackgroundDark)
                    .clickable {
                        val nextMin = (clampedMinute + 1) % 60
                        val (newH24, newM) = TimeSelectionUtils.to24Hour(hour12, nextMin, isPm)
                        onTimeChanged(newH24, newM)
                    }
                    .padding(horizontal = 10.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "+1m",
                    color = TextSecondaryDark,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium
                )
            }

            Spacer(modifier = Modifier.width(2.dp))

            // AM / PM Toggle
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(CardBackgroundDark)
                    .padding(2.dp)
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (!isPm) PrimaryPurple else CardBackgroundDark)
                        .clickable {
                            val (newH24, newM) = TimeSelectionUtils.to24Hour(hour12, clampedMinute, false)
                            onTimeChanged(newH24, newM)
                        }
                        .padding(horizontal = 8.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "AM",
                        color = TextPrimaryDark,
                        fontSize = 11.sp,
                        fontWeight = if (!isPm) FontWeight.Bold else FontWeight.Normal
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(if (isPm) PrimaryPurple else CardBackgroundDark)
                        .clickable {
                            val (newH24, newM) = TimeSelectionUtils.to24Hour(hour12, clampedMinute, true)
                            onTimeChanged(newH24, newM)
                        }
                        .padding(horizontal = 8.dp, vertical = 8.dp)
                ) {
                    Text(
                        text = "PM",
                        color = TextPrimaryDark,
                        fontSize = 11.sp,
                        fontWeight = if (isPm) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }
    }
}
