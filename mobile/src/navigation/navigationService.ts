import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Resets the root navigation stack directly back to the MainTabs (Guest Home screen).
 * Used when a user logs out so they are immediately returned to public browsing.
 */
export const resetToGuestHome = (): void => {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }]
    });
  }
};
