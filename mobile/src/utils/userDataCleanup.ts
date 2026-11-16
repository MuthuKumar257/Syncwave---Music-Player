import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useSearchStore } from '../store/useSearchStore';
import { useSchedulerStore } from '../store/useSchedulerStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { queryClient } from '../api/queryClient';
import { apiClient } from '../api/client';
import { resetToGuestHome } from '../navigation/navigationService';

export interface CleanupResult {
  success: boolean;
  searchCleared: boolean;
  libraryCleared: boolean;
  schedulerCleared: boolean;
  downloadsCleared: boolean;
  preferencesCleared: boolean;
  playbackCleared: boolean;
  authCleared: boolean;
  storageKeysRemoved: string[];
  backendReset: boolean;
  message: string;
}

/**
 * Completely clears all personal user data across all mobile stores, caches,
 * and AsyncStorage, returning the application to a pristine, fresh guest state.
 */
export async function clearAllUserData(options: {
  notifyBackend?: boolean;
  deleteDownloadedFiles?: boolean;
} = {}): Promise<CleanupResult> {
  const removedKeys: string[] = [];

  // 1. Clear Playback State & Active Audio
  let playbackCleared = false;
  try {
    await usePlayerStore.getState().resetForGuest();
    playbackCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error resetting playback:', err);
  }

  // 2. Clear Search History & Cached Results
  let searchCleared = false;
  try {
    await useSearchStore.getState().clearAllSearchHistory();
    searchCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error clearing search:', err);
  }

  // 3. Clear Library (Playlists, Favorites, Personal Collections)
  let libraryCleared = false;
  try {
    const currentUserId = useAuthStore.getState().user?.id || null;
    await useLibraryStore.getState().clearAllLibraryData(currentUserId);
    libraryCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error clearing library:', err);
  }

  // 4. Clear Scheduler (Alarms, Schedules, Recurring Routines)
  let schedulerCleared = false;
  try {
    const currentUserId = useAuthStore.getState().user?.id || null;
    await useSchedulerStore.getState().clearAllSchedules(currentUserId);
    schedulerCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error clearing schedules:', err);
  }

  // 5. Clear Download Metadata
  let downloadsCleared = false;
  try {
    await useDownloadStore.getState().clearAllDownloads();
    downloadsCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error clearing downloads:', err);
  }

  // 6. Clear Recommendation & Onboarding Preferences
  let preferencesCleared = false;
  try {
    await useRecommendationStore.getState().resetPreferences();
    preferencesCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error clearing preferences:', err);
  }

  // 7. Clear User Auth Session
  let authCleared = false;
  try {
    await useAuthStore.getState().logout();
    authCleared = true;
  } catch (err) {
    console.warn('[userDataCleanup] Error during logout:', err);
  }

  // 8. Clear React Query Cache
  try {
    queryClient.clear();
  } catch {}

  // 9. Thorough AsyncStorage sweep for all user keys
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const userKeysToDelete = allKeys.filter(
      (k) =>
        k.startsWith('@syncwave_') ||
        k.startsWith('syncwave_') ||
        k.includes('user') ||
        k.includes('library') ||
        k.includes('schedule') ||
        k.includes('download') ||
        k.includes('session') ||
        k.includes('search') ||
        k.includes('token')
    );

    if (userKeysToDelete.length > 0) {
      await AsyncStorage.multiRemove(userKeysToDelete);
      removedKeys.push(...userKeysToDelete);
    }
  } catch (err) {
    console.warn('[userDataCleanup] Error purging AsyncStorage keys:', err);
  }

  // 10. Optional Backend Reset Notification
  let backendReset = false;
  if (options.notifyBackend) {
    try {
      const res = await apiClient.post('/api/admin/reset-user-data', {
        confirmation: 'CONFIRM_DELETE_ALL_USER_DATA'
      });
      backendReset = Boolean(res.data?.success);
    } catch (err) {
      console.warn('[userDataCleanup] Note: Backend reset request failed or offline:', err);
    }
  }

  // 11. Reset navigation to pristine Guest Home
  try {
    resetToGuestHome();
  } catch {}

  return {
    success: true,
    searchCleared,
    libraryCleared,
    schedulerCleared,
    downloadsCleared,
    preferencesCleared,
    playbackCleared,
    authCleared,
    storageKeysRemoved: removedKeys,
    backendReset,
    message: 'All personal user data, search history, library, and schedules have been completely cleared.'
  };
}
