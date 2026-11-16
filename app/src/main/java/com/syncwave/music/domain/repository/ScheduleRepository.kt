package com.syncwave.music.domain.repository

import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import kotlinx.coroutines.flow.Flow

interface ScheduleRepository {
    fun getAllSchedules(): Flow<List<MusicSchedule>>
    fun getActiveSchedules(): Flow<List<MusicSchedule>>
    suspend fun getActiveSchedulesSync(): List<MusicSchedule>
    fun observeScheduleById(id: String): Flow<MusicSchedule?>
    suspend fun getScheduleById(id: String): MusicSchedule?
    suspend fun saveSchedule(schedule: MusicSchedule)
    suspend fun setScheduleEnabled(id: String, isEnabled: Boolean)
    suspend fun deleteSchedule(id: String)
    suspend fun updateExecutionTime(id: String, timestamp: Long, nextEpochMs: Long?)
    fun getExecutionHistory(limit: Int = 50): Flow<List<ScheduleExecutionRecord>>
    suspend fun recordExecution(record: ScheduleExecutionRecord)
}

