import { UserDataResetService } from '../services/admin/userDataReset.service';

async function main() {
  console.log('=====================================================');
  console.log('  SyncWave User Data Deletion & Fresh Start Script   ');
  console.log('=====================================================');

  const initialSummary = UserDataResetService.getDataSummary();
  console.log('\n[Status Before Reset]');
  console.log(`- Total user records to remove: ${initialSummary.totalUserRecords}`);
  console.log(`- Users: ${initialSummary.userCounts.users}`);
  console.log(`- Playlists: ${initialSummary.userCounts.playlists}`);
  console.log(`- Favorites: ${initialSummary.userCounts.favorites}`);
  console.log(`- Schedules: ${initialSummary.userCounts.schedules}`);
  console.log(`- Play History: ${initialSummary.userCounts.playHistory}`);
  console.log(`- Listening Events: ${initialSummary.userCounts.listeningEvents}`);
  console.log(`- Shared catalogue songs (preserved): ${initialSummary.sharedSongsCount}`);

  console.log('\nStarting backup and deletion...');
  const report = await UserDataResetService.resetAllUserData();

  console.log('\n[Deletion Report]');
  console.log(`- Success: ${report.success}`);
  console.log(`- Timestamp: ${report.timestamp}`);
  console.log(`- Safety Backup saved to: ${report.backupFile || 'None'}`);
  console.log(`- Total user records deleted: ${report.totalRecordsDeleted}`);
  console.log(`- Preserved shared songs in catalogue: ${report.preserved.sharedSongsCount}`);
  console.log(`- Database schema preserved: ${report.preserved.schemaPreserved}`);
  console.log(`- Supabase tables cleared: ${report.supabaseCleared ? 'YES' : 'SKIPPED / UNCONFIGURED'}`);
  console.log(`\nMessage: ${report.message}`);
  console.log('\n=====================================================');
  console.log('  Application is now completely fresh for new users!  ');
  console.log('=====================================================');
}

main().catch((err) => {
  console.error('[UserDataReset] Fatal error executing reset:', err);
  process.exit(1);
});
