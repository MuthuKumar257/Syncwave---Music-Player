import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { audioManager } from './src/audio/audioManager';
import { useDownloadStore } from './src/store/useDownloadStore';
import { usePlayerStore } from './src/store/usePlayerStore';
import { Colors } from './src/theme/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2
    }
  }
});

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
        <NavigationContainer linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
