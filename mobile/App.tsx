import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/api/queryClient';
import { navigationRef } from './src/navigation/navigationService';
import { RootNavigator } from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { audioManager } from './src/audio/audioManager';
import { useDownloadStore } from './src/store/useDownloadStore';
import { usePlayerStore } from './src/store/usePlayerStore';
import { Colors } from './src/theme/colors';

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Setup Audio Manager for background lockscreen playback
    audioManager.setupPlayer().catch(() => {});

    // Initialize offline downloads store
    useDownloadStore.getState().initialize().catch(() => {});

    // Restore persistent playback session & queue
    usePlayerStore.getState().restorePlaybackSession().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.background}
          translucent={false}
        />
        <NavigationContainer ref={navigationRef} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
