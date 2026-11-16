import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { useSearchStore } from '../../store/useSearchStore';
import { clearAllUserData } from '../../utils/userDataCleanup';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { preferences, selectedLanguages, selectedDirectors, selectedSingers } = useRecommendationStore();

  const [crossfadeSec, setCrossfadeSec] = useState(3);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearSearchHistory = async () => {
    await useSearchStore.getState().clearAllSearchHistory();
    Alert.alert('Search History Cleared', 'Your recent search history has been completely removed.');
  };

  const handleResetAllUserData = () => {
    Alert.alert(
      'Reset All User Data?',
      'This will permanently delete all playlists, favorites, listening history, search history, scheduled alarms, and personalized recommendations. Public songs will remain available.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearAllUserData({ notifyBackend: true });
              Alert.alert('Reset Complete', 'All personal user data has been wiped. Welcome to a fresh SyncWave experience.');
            } catch (err: any) {
              Alert.alert('Reset Finished', 'Local user data has been wiped.');
            } finally {
              setIsClearing(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Onboarding Preferences Shortcuts */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Onboarding & Taste Profile</Text>

          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => navigation.navigate('LanguageSelection')}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Preferred Music Languages</Text>
              <Text style={styles.settingSubtitle}>
                {selectedLanguages.join(', ')} ({selectedLanguages.length} active)
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => navigation.navigate('MusicPreferences')}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Artists Preferences</Text>
              <Text style={styles.settingSubtitle}>
                {selectedDirectors.length + selectedSingers.length} Artists configured (Directors & Singers)
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Audio Engine Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Audio Engine & Playback</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Seamless Crossfade</Text>
              <Text style={styles.settingSubtitle}>Transition smoothly between tracks</Text>
            </View>
            <View style={styles.crossfadeControls}>
              {[0, 3, 5, 8].map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[styles.crossfadePill, crossfadeSec === sec && styles.activeCrossfadePill]}
                  onPress={() => setCrossfadeSec(sec)}
                >
                  <Text style={[styles.crossfadePillText, crossfadeSec === sec && styles.activeCrossfadeText]}>
                    {sec === 0 ? 'Off' : `${sec}s`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Smart Recommendations Engine Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Behavioral Recommendation Learning</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Dynamic Personalization</Text>
              <Text style={styles.settingSubtitle}>Adapt scores based on plays, replays & skips</Text>
            </View>
            <Switch
              value={personalizationEnabled}
              onValueChange={setPersonalizationEnabled}
              trackColor={{ false: Colors.surfaceRaised, true: Colors.accent }}
              thumbColor={personalizationEnabled ? '#000000' : Colors.textTertiary}
            />
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Listening History Tracking</Text>
              <Text style={styles.settingSubtitle}>Record plays to continuous feedback model</Text>
            </View>
            <Switch
              value={historyEnabled}
              onValueChange={setHistoryEnabled}
              trackColor={{ false: Colors.surfaceRaised, true: Colors.accent }}
              thumbColor={historyEnabled ? '#000000' : Colors.textTertiary}
            />
          </View>
        </View>

        {/* Data & Storage Management */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Data & Privacy Management</Text>

          <TouchableOpacity
            style={styles.settingCard}
            onPress={handleClearSearchHistory}
            activeOpacity={0.7}
          >
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Clear Search History</Text>
              <Text style={styles.settingSubtitle}>Remove all recent search queries and cached suggestions</Text>
            </View>
            <Text style={[styles.actionText, { color: Colors.accent }]}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingCard, { borderColor: Colors.error }]}
            onPress={handleResetAllUserData}
            activeOpacity={0.7}
            disabled={isClearing}
          >
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: Colors.error }]}>Reset All User Data & Fresh Start</Text>
              <Text style={styles.settingSubtitle}>
                Permanently purge all playlists, favorites, history, schedules, and start fresh
              </Text>
            </View>
            {isClearing ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <Text style={[styles.actionText, { color: Colors.error }]}>Reset</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* About Card */}
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>SyncWave Music Player</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0 • React Native & TypeScript</Text>
          <Text style={styles.aboutDesc}>
            Cross-platform smart music ecosystem with React Native Track Player, unified movie & song search engine, and dynamic behavioral recommendations.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  backButton: {
    ...Typography.body2,
    color: Colors.accent
  },
  headerTitle: {
    ...Typography.title,
    color: Colors.textPrimary
  },
  headerSpacer: {
    width: 40
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl
  },
  section: {
    marginBottom: Spacing.xl
  },
  sectionHeader: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm
  },
  settingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  settingTextContainer: {
    flex: 1,
    marginRight: Spacing.md
  },
  settingTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  settingSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  chevron: {
    fontSize: 16,
    color: Colors.textTertiary
  },
  actionText: {
    ...Typography.caption,
    fontWeight: '700',
    fontSize: 13
  },
  crossfadeControls: {
    flexDirection: 'row'
  },
  crossfadePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.tag,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginLeft: 4
  },
  activeCrossfadePill: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  crossfadePillText: {
    ...Typography.caption,
    color: Colors.textTertiary
  },
  activeCrossfadeText: {
    color: '#000000',
    fontWeight: '700'
  },
  aboutCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginTop: Spacing.md
  },
  aboutTitle: {
    ...Typography.title,
    color: Colors.textPrimary
  },
  aboutVersion: {
    ...Typography.monoSmall,
    color: Colors.accent,
    marginTop: 2
  },
  aboutDesc: {
    ...Typography.body2,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    lineHeight: 18
  }
});
