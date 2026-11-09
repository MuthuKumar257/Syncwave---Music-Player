package com.syncwave.music.di

import com.syncwave.music.data.repository.MusicRepositoryImpl
import com.syncwave.music.data.repository.PlaylistRepositoryImpl
import com.syncwave.music.data.repository.ScheduleRepositoryImpl
import com.syncwave.music.domain.repository.MusicRepository
import com.syncwave.music.domain.repository.PlaylistRepository
import com.syncwave.music.domain.repository.ScheduleRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindMusicRepository(
        musicRepositoryImpl: MusicRepositoryImpl
    ): MusicRepository

    @Binds
    @Singleton
    abstract fun bindPlaylistRepository(
        playlistRepositoryImpl: PlaylistRepositoryImpl
    ): PlaylistRepository

    @Binds
    @Singleton
    abstract fun bindScheduleRepository(
        scheduleRepositoryImpl: ScheduleRepositoryImpl
    ): ScheduleRepository
}
