package com.syncwave.music.ui.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.syncwave.music.data.remote.ArtistItemDto
import com.syncwave.music.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    viewModel: OnboardingViewModel,
    onComplete: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.isComplete) {
        if (uiState.isComplete) {
            onComplete()
        }
    }

    Scaffold(
        containerColor = Color(0xFF0F0F10),
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF141415))
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF19191B))
                                .border(1.dp, Color(0x14EDEDED), RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = if (uiState.step == 1) Icons.Default.Language else Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = Color(0xFFF59E0B),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(
                                    text = if (uiState.step == 1) "Music Languages" else "Music Preferences",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color(0xFFEDEDED)
                                )
                                Surface(
                                    color = Color(0xFF19191B),
                                    shape = RoundedCornerShape(12.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x14EDEDED))
                                ) {
                                    Text(
                                        text = "Step ${uiState.step} of 2",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Color(0xFFA1A1A6),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Text(
                                text = if (uiState.step == 1)
                                    "Select languages for personalized recommendations"
                                else
                                    "Select your favourite Artists (Music Directors & Singers)",
                                fontSize = 12.sp,
                                color = Color(0xFFA1A1A6)
                            )
                        }
                    }

                    TextButton(
                        onClick = { viewModel.skipOnboarding() }
                    ) {
                        Text(
                            text = "Skip",
                            fontSize = 12.sp,
                            color = Color(0xFF85858B)
                        )
                    }
                }
            }
        },
        bottomBar = {
            // Fixed Bottom Action Bar
            Surface(
                color = Color(0xFF141415),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x14EDEDED)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (uiState.step == 2) {
                        OutlinedButton(
                            onClick = { viewModel.goToStep1() },
                            shape = RoundedCornerShape(8.dp),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x14EDEDED))
                        ) {
                            Text("Back", color = Color(0xFFA1A1A6), fontSize = 13.sp)
                        }
                    } else {
                        TextButton(onClick = { viewModel.skipOnboarding() }) {
                            Text("Skip for now", color = Color(0xFF85858B), fontSize = 12.sp)
                        }
                    }

                    if (uiState.step == 1) {
                        Button(
                            onClick = { viewModel.goToStep2() },
                            enabled = uiState.selectedLanguages.isNotEmpty(),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFF59E0B),
                                contentColor = Color.Black,
                                disabledContainerColor = Color(0xFF333333)
                            )
                        ) {
                            Text("Continue to Artists", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.width(6.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                    } else {
                        Button(
                            onClick = { viewModel.finishOnboarding() },
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFF59E0B),
                                contentColor = Color.Black
                            )
                        ) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Start Listening", fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (uiState.step == 1) {
                // =========================================================
                // STEP 1: LANGUAGE SELECTION
                // =========================================================
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(viewModel.availableLanguages) { lang ->
                        val isSelected = uiState.selectedLanguages.contains(lang.code)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSelected) Color(0xFF19191B) else Color(0xFF141415))
                                .border(
                                    width = 1.dp,
                                    color = if (isSelected) Color(0xFFF59E0B) else Color(0x14EDEDED),
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable { viewModel.toggleLanguage(lang.code) }
                                .padding(14.dp)
                        ) {
                            Column(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = lang.name,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFFEDEDED)
                                    )
                                    if (isSelected) {
                                        Box(
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clip(CircleShape)
                                                .background(Color(0xFFF59E0B)),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(
                                                Icons.Default.Check,
                                                contentDescription = null,
                                                tint = Color.Black,
                                                modifier = Modifier.size(14.dp)
                                            )
                                        }
                                    } else {
                                        Box(
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clip(CircleShape)
                                                .border(1.dp, Color(0x33EDEDED), CircleShape)
                                        )
                                    }
                                }
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = lang.nativeName,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Color(0xFFF59E0B).copy(alpha = 0.9f)
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = lang.subtitle,
                                    fontSize = 11.sp,
                                    color = Color(0xFF85858B),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            } else {
                // =========================================================
                // STEP 2: COMBINED PREFERENCES (DIRECTORS & SINGERS ON SAME PAGE)
                // =========================================================
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp, vertical = 12.dp)
                ) {
                    // Controls: Tab selector for Directors & Singers on SAME screen
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(Color(0xFF19191B))
                            .border(1.dp, Color(0x14EDEDED), RoundedCornerShape(10.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        // Music Directors Tab
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (uiState.activeTab == "DIRECTORS") Color(0xFF232325) else Color.Transparent
                                )
                                .clickable { viewModel.setActiveTab("DIRECTORS") }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    Icons.Default.MusicNote,
                                    contentDescription = null,
                                    tint = Color(0xFFF59E0B),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "Directors",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (uiState.activeTab == "DIRECTORS") Color(0xFFEDEDED) else Color(0xFF85858B)
                                )
                                Surface(
                                    color = Color(0xFF141415),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text(
                                        text = "${uiState.selectedDirectors.size}",
                                        fontSize = 10.sp,
                                        color = Color(0xFFA1A1A6),
                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                    )
                                }
                            }
                        }

                        // Singers Tab
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(
                                    if (uiState.activeTab == "SINGERS") Color(0xFF232325) else Color.Transparent
                                )
                                .clickable { viewModel.setActiveTab("SINGERS") }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Icon(
                                    Icons.Default.Mic,
                                    contentDescription = null,
                                    tint = Color(0xFFF59E0B),
                                    modifier = Modifier.size(16.dp)
                                )
                                Text(
                                    text = "Singers",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = if (uiState.activeTab == "SINGERS") Color(0xFFEDEDED) else Color(0xFF85858B)
                                )
                                Surface(
                                    color = Color(0xFF141415),
                                    shape = RoundedCornerShape(10.dp)
                                ) {
                                    Text(
                                        text = "${uiState.selectedSingers.size}",
                                        fontSize = 10.sp,
                                        color = Color(0xFFA1A1A6),
                                        modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp)
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(8.dp))

                    // Search & Bulk Actions Bar
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = uiState.searchQuery,
                            onValueChange = { viewModel.setSearchQuery(it) },
                            placeholder = {
                                Text(
                                    "Search ${if (uiState.activeTab == "DIRECTORS") "directors" else "singers"}...",
                                    fontSize = 11.sp,
                                    color = Color(0xFF85858B)
                                )
                            },
                            leadingIcon = {
                                Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF85858B), modifier = Modifier.size(16.dp))
                            },
                            trailingIcon = {
                                if (uiState.searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { viewModel.setSearchQuery("") }) {
                                        Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFF85858B), modifier = Modifier.size(14.dp))
                                    }
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(46.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedContainerColor = Color(0xFF141415),
                                unfocusedContainerColor = Color(0xFF141415),
                                focusedBorderColor = Color(0xFFF59E0B),
                                unfocusedBorderColor = Color(0x14EDEDED),
                                focusedTextColor = Color(0xFFEDEDED),
                                unfocusedTextColor = Color(0xFFEDEDED)
                            ),
                            shape = RoundedCornerShape(8.dp),
                            singleLine = true
                        )

                        TextButton(
                            onClick = { viewModel.selectAllInCurrentTab() },
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Text("Select All", fontSize = 11.sp, color = Color(0xFFF59E0B))
                        }

                        TextButton(
                            onClick = { viewModel.clearAllInCurrentTab() },
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Text("Clear", fontSize = 11.sp, color = Color(0xFF85858B))
                        }
                    }

                    Spacer(Modifier.height(6.dp))

                    // Combined counter summary badge
                    Text(
                        text = "Selected: ${uiState.selectedDirectors.size} Directors • ${uiState.selectedSingers.size} Singers",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color(0xFFF59E0B),
                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                    )

                    Spacer(Modifier.height(6.dp))

                    // Filtered Artists Grid
                    val currentRole = if (uiState.activeTab == "DIRECTORS") "DIRECTOR" else "SINGER"
                    val filteredArtists = remember(uiState.allArtists, currentRole, uiState.searchQuery, uiState.viewAllDirectors, uiState.viewAllSingers) {
                        var list = uiState.allArtists.filter { it.role == currentRole }
                        if (uiState.searchQuery.isNotBlank()) {
                            val q = uiState.searchQuery.lowercase().trim()
                            list = list.filter {
                                it.name.lowercase().contains(q) ||
                                it.knownFor.any { k -> k.lowercase().contains(q) } ||
                                it.popularTracks.any { t -> t.lowercase().contains(q) }
                            }
                        }
                        val isExpanded = if (uiState.activeTab == "DIRECTORS") uiState.viewAllDirectors else uiState.viewAllSingers
                        if (!isExpanded && uiState.searchQuery.isBlank()) list.take(8) else list
                    }

                    if (uiState.isLoading) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(color = Color(0xFFF59E0B), modifier = Modifier.size(28.dp))
                        }
                    } else {
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(3),
                            modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(filteredArtists) { artist ->
                                val isSelected = if (artist.role == "DIRECTOR") {
                                    uiState.selectedDirectors.contains(artist.name)
                                } else {
                                    uiState.selectedSingers.contains(artist.name)
                                }

                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isSelected) Color(0xFF19191B) else Color(0xFF141415))
                                        .border(
                                            width = 1.dp,
                                            color = if (isSelected) Color(0xFFF59E0B) else Color(0x14EDEDED),
                                            shape = RoundedCornerShape(12.dp)
                                        )
                                        .clickable {
                                            if (artist.role == "DIRECTOR") {
                                                viewModel.toggleDirector(artist.name)
                                            } else {
                                                viewModel.toggleSinger(artist.name)
                                            }
                                        }
                                        .padding(8.dp)
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(56.dp)
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(Color(0xFF232325))
                                        ) {
                                            AsyncImage(
                                                model = artist.imageUrl,
                                                contentDescription = artist.name,
                                                modifier = Modifier.fillMaxSize(),
                                                contentScale = ContentScale.Crop
                                            )
                                            if (isSelected) {
                                                Box(
                                                    modifier = Modifier
                                                        .size(18.dp)
                                                        .align(Alignment.TopEnd)
                                                        .clip(CircleShape)
                                                        .background(Color(0xFFF59E0B)),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Icon(
                                                        Icons.Default.Check,
                                                        contentDescription = null,
                                                        tint = Color.Black,
                                                        modifier = Modifier.size(12.dp)
                                                    )
                                                }
                                            }
                                        }

                                        Spacer(Modifier.height(6.dp))

                                        Text(
                                            text = artist.name,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFFEDEDED),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            textAlign = TextAlign.Center
                                        )

                                        Text(
                                            text = artist.knownFor.take(2).joinToString(", "),
                                            fontSize = 9.sp,
                                            color = Color(0xFF85858B),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                        }

                        // View All Toggle
                        if (uiState.searchQuery.isBlank()) {
                            val totalRoleArtists = uiState.allArtists.count { it.role == currentRole }
                            if (totalRoleArtists > 8) {
                                val isExpanded = if (uiState.activeTab == "DIRECTORS") uiState.viewAllDirectors else uiState.viewAllSingers
                                TextButton(
                                    onClick = {
                                        if (uiState.activeTab == "DIRECTORS") {
                                            viewModel.toggleViewAllDirectors()
                                        } else {
                                            viewModel.toggleViewAllSingers()
                                        }
                                    },
                                    modifier = Modifier.align(Alignment.CenterHorizontally)
                                ) {
                                    Text(
                                        text = if (isExpanded) "Show Less" else "View All ($totalRoleArtists) ${if (uiState.activeTab == "DIRECTORS") "Directors" else "Singers"}",
                                        fontSize = 11.sp,
                                        color = Color(0xFFF59E0B)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
