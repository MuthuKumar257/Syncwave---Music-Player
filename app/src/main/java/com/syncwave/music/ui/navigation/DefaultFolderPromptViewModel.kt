package com.syncwave.music.ui.navigation

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.syncwave.music.data.repository.PreferencesRepository
import com.syncwave.music.domain.repository.MusicRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class DefaultFolderPromptViewModel @Inject constructor(
    private val preferencesRepository: PreferencesRepository,
    private val musicRepository: MusicRepository
) : ViewModel() {

    val shouldShowPrompt: StateFlow<Boolean> = combine(
        preferencesRepository.hasPromptedDefaultFolder,
        preferencesRepository.defaultMusicFolderUri
    ) { prompted, defaultUri ->
        !prompted && defaultUri == null
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = false
    )

    fun onFolderSelected(treeUri: Uri) {
        viewModelScope.launch {
            preferencesRepository.setDefaultFolderPrompted(true)
            musicRepository.addMusicFolder(treeUri, makeDefault = true)
        }
    }

    fun dismissPrompt() {
        viewModelScope.launch {
            preferencesRepository.setDefaultFolderPrompted(true)
        }
    }
}
