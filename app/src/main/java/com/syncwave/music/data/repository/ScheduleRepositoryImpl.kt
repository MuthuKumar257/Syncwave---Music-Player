package com.syncwave.music.data.repository

import com.syncwave.music.data.local.dao.ScheduleDao
import com.syncwave.music.data.local.entity.MusicScheduleEntity
import com.syncwave.music.data.remote.ExecutionLogRequest
import com.syncwave.music.data.remote.SyncWaveApiService
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import com.syncwave.music.domain.repository.ScheduleRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ScheduleRepositoryImpl @Inject constructor(
    private val scheduleDao: ScheduleDao,
    private val apiService: SyncWaveApiService
) : ScheduleRepository {

    override fun getAllSchedules(): Flow<List<MusicSchedule>> =
        scheduleDao.getAllSchedules().map { list -> list.map { it.toDomain() } }

    override fun getActiveSchedules(): Flow<List<MusicSchedule>> =
        scheduleDao.getActiveSchedules().map { list -> list.map { it.toDomain() } }

    override suspend fun getActiveSchedulesSync(): List<MusicSchedule> =
        scheduleDao.getActiveSchedulesSync().map { it.toDomain() }

    override fun observeScheduleById(id: String): Flow<MusicSchedule?> =
        scheduleDao.observeScheduleById(id).map { it?.toDomain() }

    override suspend fun getScheduleById(id: String): MusicSchedule? =
        scheduleDao.getScheduleById(id)?.toDomain()

    override suspend fun saveSchedule(schedule: MusicSchedule) {
        scheduleDao.insertSchedule(MusicScheduleEntity.fromDomain(schedule))
    }

    override suspend fun setScheduleEnabled(id: String, isEnabled: Boolean) {
        scheduleDao.setScheduleEnabled(id, isEnabled)
    }

    override suspend fun deleteSchedule(id: String) {
        scheduleDao.deleteScheduleById(id)
    }

    override suspend fun updateExecutionTime(id: String, timestamp: Long, nextEpochMs: Long?) {
        scheduleDao.updateExecutionTime(id, timestamp, nextEpochMs)
    }

    override fun getExecutionHistory(limit: Int): Flow<List<ScheduleExecutionRecord>> = flow {
        // History is fetched strictly from Supabase via backend API (never stored locally)
        try {
            val res = apiService.getScheduleHistory()
            if (res.isSuccessful && res.body()?.success == true) {
                val mapped = (res.body()?.data ?: emptyList())
                    .take(limit)
                    .map { dto ->
                        val epoch = try {
                            Instant.parse(dto.executedAt).toEpochMilli()
                        } catch (_: Exception) {
                            System.currentTimeMillis()
                        }
                        ScheduleExecutionRecord(
                            id = dto.id,
                            scheduleId = dto.scheduleId ?: "",
                            scheduleName = dto.scheduleName,
                            executedAt = epoch,
                            targetName = dto.targetName,
                            success = dto.success,
                            statusMessage = dto.statusMessage
                        )
                    }
                emit(mapped)
                return@flow
            }
        } catch (_: Exception) {}
        emit(emptyList())
    }

    override suspend fun recordExecution(record: ScheduleExecutionRecord) {
        // Persist execution history ONLY to Supabase via backend (never insert into local Room table)
        try {
            apiService.logExecutionPublic(
                scheduleId = record.scheduleId.ifBlank { "routine" },
                log = ExecutionLogRequest(
                    success = record.success,
                    statusMessage = record.statusMessage,
                    clientPlatform = "ANDROID",
                    scheduleName = record.scheduleName,
                    targetName = record.targetName
                )
            )
        } catch (_: Exception) {
            // Do not cache history locally on network error
        }
    }
}
