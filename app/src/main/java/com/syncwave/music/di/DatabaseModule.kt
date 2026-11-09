package com.syncwave.music.di

import android.content.Context
import androidx.room.Room
import com.syncwave.music.data.local.SyncWaveDatabase
import com.syncwave.music.data.local.dao.HistoryAndFavoritesDao
import com.syncwave.music.data.local.dao.PlaylistDao
import com.syncwave.music.data.local.dao.ScheduleDao
import com.syncwave.music.data.local.dao.SongDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideSyncWaveDatabase(
        @ApplicationContext context: Context
    ): SyncWaveDatabase {
        return Room.databaseBuilder(
            context,
            SyncWaveDatabase::class.java,
            SyncWaveDatabase.DATABASE_NAME
        )
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideSongDao(database: SyncWaveDatabase): SongDao = database.songDao()

    @Provides
    fun providePlaylistDao(database: SyncWaveDatabase): PlaylistDao = database.playlistDao()

    @Provides
    fun provideScheduleDao(database: SyncWaveDatabase): ScheduleDao = database.scheduleDao()

    @Provides
    fun provideHistoryAndFavoritesDao(database: SyncWaveDatabase): HistoryAndFavoritesDao =
        database.historyAndFavoritesDao()
}
