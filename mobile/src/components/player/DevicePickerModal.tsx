import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { Colors } from '../../theme/colors';
import { Radius, Spacing } from '../../theme/spacing';

export const DevicePickerModal: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuthStore();
  const {
    myDeviceId,
    devices,
    activeDeviceId,
    isRemoteMode,
    isDevicePickerVisible,
    transferError,
    setDevicePickerVisible,
    transferPlayback,
  } = usePlaybackSessionStore();

  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId);

  return (
    <Modal
      visible={isDevicePickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setDevicePickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => setDevicePickerVisible(false)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <SafeAreaView>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Connect to a device</Text>
                <Text style={styles.subtitle}>
                  Music plays on one device while others act as remotes
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDevicePickerVisible(false)}
                style={styles.closeBtn}
              >
                <Text style={styles.closeText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.list}>
              {!isAuthenticated ? (
                <View style={styles.authCard}>
                  <Text style={styles.authDesc}>
                    Sign in with the same SyncWave account across your devices to select an active
                    player and control it from anywhere.
                  </Text>
                  <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={() => {
                      setDevicePickerVisible(false);
                      navigation.navigate('Login');
                    }}
                  >
                    <Text style={styles.ctaText}>Sign in to connect devices</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.statusBanner}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusLabel}>
                        {isRemoteMode ? 'ACTING AS REMOTE' : 'PLAYING ON THIS DEVICE'}
                      </Text>
                      <Text style={styles.statusDevice}>
                        {activeDevice?.deviceName || 'SyncWave Mobile'}
                      </Text>
                    </View>
                    {isRemoteMode ? (
                      <TouchableOpacity
                        style={styles.playHereBtn}
                        onPress={() => void transferPlayback(myDeviceId)}
                      >
                        <Text style={styles.playHereText}>Play here</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {transferError ? (
                    <Text style={styles.errorText}>{transferError}</Text>
                  ) : null}

                  <Text style={styles.sectionLabel}>ONLINE DEVICES ({devices.length})</Text>

                  {devices.map((device) => {
                    const isSelf = device.deviceId === myDeviceId;
                    const isActive = device.deviceId === activeDeviceId;
                    return (
                      <TouchableOpacity
                        key={device.deviceId}
                        style={[styles.deviceRow, isActive && styles.deviceRowActive]}
                        onPress={() => {
                          if (!isActive) {
                            void transferPlayback(device.deviceId);
                          }
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.deviceTitleRow}>
                            <Text style={styles.deviceName}>{device.deviceName}</Text>
                            {isSelf ? (
                              <View style={styles.selfBadge}>
                                <Text style={styles.selfBadgeText}>This device</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.deviceSub}>
                            {isActive
                              ? 'Active audio output'
                              : `${device.platform} • Remote controller`}
                          </Text>
                        </View>
                        <Text style={isActive ? styles.activeTag : styles.switchTag}>
                          {isActive ? 'Playing' : 'Switch'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    borderTopWidth: 1,
    borderColor: Colors.hairlineLight,
    maxHeight: '72%',
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  subtitle: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  closeBtn: { paddingLeft: 12, paddingVertical: 4 },
  closeText: { color: Colors.accent, fontSize: 13, fontWeight: '600' },
  list: { padding: Spacing.md },
  authCard: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.md,
    gap: 12,
  },
  authDesc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  ctaButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ctaText: { color: '#000', fontSize: 13, fontWeight: '700' },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 12,
    marginBottom: Spacing.md,
  },
  statusLabel: { color: Colors.textTertiary, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  statusDevice: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', marginTop: 2 },
  playHereBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.tag,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  playHereText: { color: '#000', fontSize: 11, fontWeight: '700' },
  errorText: { color: Colors.error, fontSize: 12, marginBottom: 8 },
  sectionLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 12,
    marginBottom: 8,
  },
  deviceRowActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deviceName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  selfBadge: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.tag,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  selfBadgeText: { color: Colors.textSecondary, fontSize: 10 },
  deviceSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  activeTag: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  switchTag: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
});
