package com.syncwave.music.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.syncwave.music.data.local.dao.HistoryAndFavoritesDao
import com.syncwave.music.data.local.dao.PlaylistDao
import com.syncwave.music.data.local.dao.ScheduleDao
import com.syncwave.music.data.local.dao.SongDao
import com.syncwave.music.data.local.entity.DownloadTaskEntity
import com.syncwave.music.data.local.entity.FavoriteEntity
import com.syncwave.music.data.local.entity.MusicScheduleEntity
import com.syncwave.music.data.local.entity.PlayHistoryEntity
import com.syncwave.music.data.local.entity.PlaylistEntity
import com.syncwave.music.data.local.entity.PlaylistSongCrossRef
import com.syncwave.music.data.local.entity.ScheduleExecutionRecordEntity
import com.syncwave.music.data.local.entity.SongEntity

@Database(
    entities = [
        SongEntity::class,
        PlaylistEntity::class,
        PlaylistSongCrossRef::class,
        MusicScheduleEntity::class,
        ScheduleExecutionRecordEntity::class,
        FavoriteEntity::class,
        PlayHistoryEntity::class,
        DownloadTaskEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class SyncWaveDatabase : RoomDatabase() {
    abstract fun songDao(): SongDao
    abstract fun playlistDao(): PlaylistDao
    abstract fun scheduleDao(): ScheduleDao
    abstract fun historyAndFavoritesDao(): HistoryAndFavoritesDao

    companion object {
        const val DATABASE_NAME = "syncwave_database.db"
    }
}

