import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { LanguageSelectionScreen } from '../screens/onboarding/LanguageSelectionScreen';
import { MusicPreferencesScreen } from '../screens/onboarding/MusicPreferencesScreen';
import { FullPlayerScreen } from '../screens/player/FullPlayerScreen';
import { QueueScreen } from '../screens/player/QueueScreen';
import { MovieDetailScreen } from '../screens/details/MovieDetailScreen';
import { SongDetailScreen } from '../screens/details/SongDetailScreen';
import { PlaylistDetailScreen } from '../screens/details/PlaylistDetailScreen';
import { SchedulerScreen } from '../screens/scheduler/SchedulerScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { DownloadsScreen } from '../screens/downloads/DownloadsScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { useRecommendationStore } from '../store/useRecommendationStore';
import { useAuthStore } from '../store/useAuthStore';
import { usePlaybackSessionStore } from '../store/usePlaybackSessionStore';
import { DevicePickerModal } from '../components/player/DevicePickerModal';
import { Colors } from '../theme/colors';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { hasCompletedOnboarding, initialize } = useRecommendationStore();
  const { isAuthenticated, token, hydrate } = useAuthStore();
  const { startSessionSync, stopSessionSync } = usePlaybackSessionStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([initialize(), hydrate()]).finally(() => {
      if (isMounted) {
        setIsInitializing(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [initialize, hydrate]);

  useEffect(() => {
    if (isAuthenticated && token) {
      void startSessionSync(token);
    } else {
      void stopSessionSync();
    }
  }, [isAuthenticated, token, startSessionSync, stopSessionSync]);

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background }
        }}
      >
      <Stack.Screen name="LanguageSelection" component={LanguageSelectionScreen} />
      <Stack.Screen name="MusicPreferences" component={MusicPreferencesScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen
        name="FullPlayer"
        component={FullPlayerScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen
        name="Queue"
        component={QueueScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} />
      <Stack.Screen name="SongDetail" component={SongDetailScreen} />
      <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
      <Stack.Screen name="Scheduler" component={SchedulerScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
    </Stack.Navigator>
    <DevicePickerModal />
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
