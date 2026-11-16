package com.syncwave.music.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.remote.ArtistItemDto
import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.data.remote.UserPreferencesDto
import com.syncwave.music.data.repository.PreferencesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LanguageOption(
    val code: String,
    val name: String,
    val nativeName: String,
    val subtitle: String
)

data class OnboardingUiState(
    val step: Int = 1, // 1 = Languages, 2 = Combined Preferences (Directors & Singers on SAME screen)
    val selectedLanguages: Set<String> = setOf("Tamil", "Telugu", "Hindi"),
    val activeTab: String = "DIRECTORS", // "DIRECTORS" or "SINGERS"
    val searchQuery: String = "",
    val viewAllDirectors: Boolean = false,
    val viewAllSingers: Boolean = false,
    val selectedDirectors: Set<String> = setOf("A. R. Rahman", "Anirudh Ravichander", "Harris Jayaraj"),
    val selectedSingers: Set<String> = setOf("Sid Sriram", "S. P. Balasubrahmanyam", "Shreya Ghoshal"),
    val allArtists: List<ArtistItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val isComplete: Boolean = false
)

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val apiService: SyncWaveApiService,
    private val preferencesRepository: PreferencesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

    val availableLanguages = listOf(
        LanguageOption("Tamil", "Tamil", "தமிழ்", "Kollywood & Folk Melodies"),
        LanguageOption("Telugu", "Telugu", "తెలుగు", "Tollywood Hits & Beats"),
        LanguageOption("Malayalam", "Malayalam", "മലയാളം", "Mollywood Acoustic & Indie"),
        LanguageOption("Kannada", "Kannada", "ಕನ್ನಡ", "Sandalwood & Heavy Anthems"),
        LanguageOption("Hindi", "Hindi", "हिन्दी", "Bollywood & Sufi Ballads"),
        LanguageOption("English", "English", "English", "Pop, R&B & Global Soundtracks"),
        LanguageOption("Punjabi", "Punjabi", "ਪੰਜਾਬੀ", "Bhangra, Desi Hip-hop"),
        LanguageOption("Bengali", "Bengali", "বাংলা", "Rabindra Sangeet & Folk"),
        LanguageOption("Marathi", "Marathi", "मराठी", "Natya Sangeet & Modern Hits")
    )

    init {
        loadArtists()
    }

    fun loadArtists() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val langsParam = _uiState.value.selectedLanguages.joinToString(",")
                val response = apiService.getArtists(languages = langsParam)
                if (response.isSuccessful && response.body()?.artists != null) {
                    _uiState.value = _uiState.value.copy(
                        allArtists = response.body()!!.artists,
                        isLoading = false
                    )
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun toggleLanguage(code: String) {
        val current = _uiState.value.selectedLanguages.toMutableSet()
        if (current.contains(code)) {
            if (current.size > 1) current.remove(code)
        } else {
            current.add(code)
        }
        _uiState.value = _uiState.value.copy(selectedLanguages = current)
    }

    fun goToStep2() {
        _uiState.value = _uiState.value.copy(step = 2)
        loadArtists()
    }

    fun goToStep1() {
        _uiState.value = _uiState.value.copy(step = 1)
    }

    fun setActiveTab(tab: String) {
        _uiState.value = _uiState.value.copy(activeTab = tab, searchQuery = "")
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun toggleDirector(name: String) {
        val current = _uiState.value.selectedDirectors.toMutableSet()
        if (current.contains(name)) current.remove(name) else current.add(name)
        _uiState.value = _uiState.value.copy(selectedDirectors = current)
    }

    fun toggleSinger(name: String) {
        val current = _uiState.value.selectedSingers.toMutableSet()
        if (current.contains(name)) current.remove(name) else current.add(name)
        _uiState.value = _uiState.value.copy(selectedSingers = current)
    }

    fun selectAllInCurrentTab() {
        val state = _uiState.value
        if (state.activeTab == "DIRECTORS") {
            val directors = state.allArtists.filter { it.role == "DIRECTOR" }.map { it.name }
            _uiState.value = state.copy(selectedDirectors = state.selectedDirectors + directors)
        } else {
            val singers = state.allArtists.filter { it.role == "SINGER" }.map { it.name }
            _uiState.value = state.copy(selectedSingers = state.selectedSingers + singers)
        }
    }

    fun clearAllInCurrentTab() {
        val state = _uiState.value
        if (state.activeTab == "DIRECTORS") {
            _uiState.value = state.copy(selectedDirectors = emptySet())
        } else {
            _uiState.value = state.copy(selectedSingers = emptySet())
        }
    }

    fun toggleViewAllDirectors() {
        _uiState.value = _uiState.value.copy(viewAllDirectors = !_uiState.value.viewAllDirectors)
    }

    fun toggleViewAllSingers() {
        _uiState.value = _uiState.value.copy(viewAllSingers = !_uiState.value.viewAllSingers)
    }

    fun finishOnboarding() {
        viewModelScope.launch {
            val state = _uiState.value
            try {
                apiService.updateUserPreferences(
                    UserPreferencesDto(
                        preferredLanguages = state.selectedLanguages.toList(),
                        favouriteComposers = state.selectedDirectors.toList(),
                        favouriteSingers = state.selectedSingers.toList(),
                        favouriteArtists = (state.selectedDirectors + state.selectedSingers).toList()
                    )
                )
            } catch (_: Exception) {}

            preferencesRepository.setOnboardingCompleted(true)
            _uiState.value = _uiState.value.copy(isComplete = true)
        }
    }

    fun skipOnboarding() {
        viewModelScope.launch {
            preferencesRepository.setOnboardingCompleted(true)
            _uiState.value = _uiState.value.copy(isComplete = true)
        }
    }
}
