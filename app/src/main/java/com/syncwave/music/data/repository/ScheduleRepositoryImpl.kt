package com.syncwave.music.data.repository

import com.syncwave.music.data.local.dao.ScheduleDao
import com.syncwave.music.data.local.entity.MusicScheduleEntity
import com.syncwave.music.data.local.entity.ScheduleExecutionRecordEntity
import com.syncwave.music.domain.model.MusicSchedule
import com.syncwave.music.domain.model.ScheduleExecutionRecord
import com.syncwave.music.domain.repository.ScheduleRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ScheduleRepositoryImpl @Inject constructor(
    private val scheduleDao: ScheduleDao
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

    override fun getExecutionHistory(limit: Int): Flow<List<ScheduleExecutionRecord>> =
        scheduleDao.getExecutionHistory(limit).map { list -> list.map { it.toDomain() } }

    override suspend fun recordExecution(record: ScheduleExecutionRecord) {
        scheduleDao.insertExecutionRecord(ScheduleExecutionRecordEntity.fromDomain(record))
        scheduleDao.pruneOldHistory()
    }
}
