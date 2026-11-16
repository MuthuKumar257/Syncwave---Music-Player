package com.syncwave.music.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.syncwave.music.data.local.entity.MusicScheduleEntity
import com.syncwave.music.data.local.entity.ScheduleExecutionRecordEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ScheduleDao {
    @Query("SELECT * FROM music_schedules ORDER BY startTime ASC")
    fun getAllSchedules(): Flow<List<MusicScheduleEntity>>

    @Query("SELECT * FROM music_schedules WHERE isEnabled = 1 ORDER BY startTime ASC")
    fun getActiveSchedules(): Flow<List<MusicScheduleEntity>>

    @Query("SELECT * FROM music_schedules WHERE isEnabled = 1 ORDER BY startTime ASC")
    suspend fun getActiveSchedulesSync(): List<MusicScheduleEntity>

    @Query("SELECT * FROM music_schedules WHERE id = :id LIMIT 1")
    suspend fun getScheduleById(id: String): MusicScheduleEntity?

    @Query("SELECT * FROM music_schedules WHERE id = :id LIMIT 1")
    fun observeScheduleById(id: String): Flow<MusicScheduleEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSchedule(schedule: MusicScheduleEntity)

    @Update
    suspend fun updateSchedule(schedule: MusicScheduleEntity)

    @Query("UPDATE music_schedules SET isEnabled = :isEnabled WHERE id = :id")
    suspend fun setScheduleEnabled(id: String, isEnabled: Boolean)

    @Query("UPDATE music_schedules SET lastExecutedAt = :timestamp, nextOccurrenceEpochMs = :nextEpochMs WHERE id = :id")
    suspend fun updateExecutionTime(id: String, timestamp: Long, nextEpochMs: Long?)

    @Query("DELETE FROM music_schedules WHERE id = :id")
    suspend fun deleteScheduleById(id: String)

    // Schedule Execution History
    @Query("SELECT * FROM schedule_history ORDER BY executedAt DESC LIMIT :limit")
    fun getExecutionHistory(limit: Int = 50): Flow<List<ScheduleExecutionRecordEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExecutionRecord(record: ScheduleExecutionRecordEntity)

    @Query("DELETE FROM schedule_history WHERE id NOT IN (SELECT id FROM schedule_history ORDER BY executedAt DESC LIMIT 200)")
    suspend fun pruneOldHistory()
}

