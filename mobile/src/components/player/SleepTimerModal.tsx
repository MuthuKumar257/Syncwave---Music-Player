import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback
} from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const formatSleepTime = (sec: number): string => {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const PRESETS = [
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '45 minutes', minutes: 45 },
  { label: '60 minutes', minutes: 60 },
  { label: 'End of current track', minutes: 0 } // special end of track or turn off
];

export const SleepTimerModal: React.FC = () => {
  const {
    isSleepTimerModalVisible,
    setSleepTimerModalVisible,
    sleepTimerMinutes,
    sleepTimerRemainingSec,
    setSleepTimer,
    clearSleepTimer,
    duration,
    position
  } = usePlayerStore();

  if (!isSleepTimerModalVisible) return null;

  const handleSelectPreset = (minutes: number) => {
    if (minutes === 0) {
      // Calculate remaining track seconds
      const trackRemainingSec = Math.max(30, Math.round(duration - position));
      const approxMin = Math.max(1, Math.ceil(trackRemainingSec / 60));
      setSleepTimer(approxMin);
    } else {
      setSleepTimer(minutes);
    }
    setSleepTimerModalVisible(false);
  };

  const handleTurnOff = () => {
    clearSleepTimer();
    setSleepTimerModalVisible(false);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={isSleepTimerModalVisible}
      onRequestClose={() => setSleepTimerModalVisible(false)}
    >
      <TouchableWithoutFeedback onPress={() => setSleepTimerModalVisible(false)}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.header}>
                <Text style={styles.title}>Sleep Timer</Text>
                {sleepTimerRemainingSec > 0 ? (
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>
                      Active: {formatSleepTime(sleepTimerRemainingSec)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.subtitle}>
                Playback will smoothly stop when the timer finishes.
              </Text>

              <View style={styles.optionsList}>
                {PRESETS.map((item) => {
                  const isSelected = sleepTimerMinutes === item.minutes && item.minutes > 0;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.optionItem, isSelected && styles.optionItemSelected]}
                      onPress={() => handleSelectPreset(item.minutes)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                        {item.label}
                      </Text>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })}

                {sleepTimerRemainingSec > 0 ? (
                  <TouchableOpacity
                    style={styles.turnOffButton}
                    onPress={handleTurnOff}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.turnOffText}>Turn Off Sleep Timer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSleepTimerModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    padding: Spacing.lg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs
  },
  title: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.textPrimary
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.md
  },
  activeBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.accent
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
    fontFamily: 'monospace'
  },
  optionsList: {
    gap: 6
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  optionItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceHover
  },
  optionLabel: {
    ...Typography.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary
  },
  optionLabelSelected: {
    color: Colors.accent,
    fontWeight: '600'
  },
  checkmark: {
    fontSize: 14,
    color: Colors.accent,
    fontWeight: '700'
  },
  turnOffButton: {
    marginTop: Spacing.xs,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.control,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)'
  },
  turnOffText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600'
  },
  closeButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  closeButtonText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600'
  }
});
