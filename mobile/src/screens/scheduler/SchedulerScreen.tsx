import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/useAuthStore';
import { useSchedulerStore } from '../../store/useSchedulerStore';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const SchedulerScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated, user } = useAuthStore();
  const { schedules, initialize, toggleSchedule } = useSchedulerStore();

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      void initialize(user.id);
    }
  }, [isAuthenticated, user?.id, initialize]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Music Scheduler</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isAuthenticated ? (
          /* =========================================
             GUEST MODE: SHOW LOGIN PROMPT
             ========================================= */
          <View style={styles.guestPromptCard}>
            <View style={styles.guestPromptIconCircle}>
              <Text style={styles.guestPromptIconText}>⏰</Text>
            </View>
            <Text style={styles.guestPromptTitle}>Sign in for Smart Scheduler</Text>
            <Text style={styles.guestPromptSubtitle}>
              Sign in to configure automated music routines, daily alarms, and time-based playback schedules tailored to your routine.
            </Text>
            <View style={styles.guestPromptActions}>
              <TouchableOpacity
                style={styles.guestPromptPrimaryBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Text style={styles.guestPromptPrimaryBtnText}>Sign In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.guestPromptSecondaryBtn}
                onPress={() => navigation.navigate('SignUp')}
                activeOpacity={0.8}
              >
                <Text style={styles.guestPromptSecondaryBtnText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* =========================================
             AUTHENTICATED SCHEDULER VIEW
             ========================================= */
          <View>
            <View style={styles.schedulerActiveCard}>
              <Text style={styles.schedulerSectionTitle}>Active Music Routines</Text>
              <Text style={styles.schedulerSectionSubtitle}>
                Your configured smart transitions will automatically trigger music at exact schedule times.
              </Text>
              {schedules.map((routine) => (
                <View key={routine.id} style={styles.routineItem}>
                  <Text style={styles.routineTime}>{routine.startTime}</Text>
                  <View style={styles.routineMeta}>
                    <Text style={styles.routineTitle}>{routine.name}</Text>
                    <Text style={styles.routineDays}>
                      {routine.repeatType} &bull; {routine.targetName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => void toggleSchedule(routine.id)}
                    style={[styles.activeTag, !routine.isEnabled && styles.inactiveTag]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.activeTagText, !routine.isEnabled && styles.inactiveTagText]}>
                      {routine.isEnabled ? 'Active' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
              {schedules.length === 0 && (
                <View style={{ paddingVertical: Spacing.lg, alignItems: 'center' }}>
                  <Text style={{ color: Colors.textTertiary, fontSize: 13 }}>No active routines configured.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Persistent Mini Player */}
      <MiniPlayer onPress={() => navigation.navigate('FullPlayer')} />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  backButton: {
    ...Typography.bodyMedium,
    color: Colors.accent,
    fontWeight: '600'
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  headerSpacer: {
    width: 48
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80
  },
  guestPromptCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg
  },
  guestPromptIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  guestPromptIconText: {
    fontSize: 28
  },
  guestPromptTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs
  },
  guestPromptSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md
  },
  guestPromptActions: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  guestPromptPrimaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestPromptPrimaryBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  guestPromptSecondaryBtn: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestPromptSecondaryBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  schedulerActiveCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    marginBottom: Spacing.md
  },
  schedulerSectionTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    marginBottom: 4
  },
  schedulerSectionSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginBottom: Spacing.md
  },
  routineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.control,
    padding: Spacing.md,
    marginBottom: Spacing.sm
  },
  routineTime: {
    ...Typography.monoSmall,
    color: Colors.accent,
    fontWeight: '700',
    width: 80
  },
  routineMeta: {
    flex: 1
  },
  routineTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  routineDays: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  activeTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.tag
  },
  activeTagText: {
    ...Typography.monoSmall,
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '700'
  },
  inactiveTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  inactiveTagText: {
    color: Colors.textTertiary
  },
  footerSpacing: {
    height: 60
  }
});
