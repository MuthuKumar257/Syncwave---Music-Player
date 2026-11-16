import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { usePlaybackSessionStore } from '../../store/usePlaybackSessionStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

interface MiniPlayerProps {
  onPress: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onPress }) => {
  const { currentTrack, isPlaying, togglePlayPause, playNext, isMiniPlayerVisible } = usePlayerStore();
  const { isRemoteMode, devices, activeDeviceId, setDevicePickerVisible } =
    usePlaybackSessionStore();

  const activeDevice = devices.find((d) => d.deviceId === activeDeviceId);

  if ((!isMiniPlayerVisible || !currentTrack) && !isRemoteMode) return null;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: currentTrack?.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' }}
        style={styles.artwork}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {currentTrack?.title || 'Remote Session'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {isRemoteMode
            ? `Remote • ${activeDevice?.deviceName || 'Active Device'}`
            : currentTrack?.composer || currentTrack?.artist || ''}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.controlButton}
        onPress={(e) => {
          e.stopPropagation();
          setDevicePickerVisible(true);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.controlIcon, isRemoteMode && { color: Colors.accent }]}>📺</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.controlButton}
        onPress={(e) => {
          e.stopPropagation();
          togglePlayPause();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.controlIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.controlButton}
        onPress={(e) => {
          e.stopPropagation();
          playNext();
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.controlIcon}>⏭</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: Spacing.md,
    right: Spacing.md,
    height: 56,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairlineLight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 999
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceHover
  },
  info: {
    flex: 1,
    marginLeft: Spacing.sm,
    justifyContent: 'center'
  },
  title: {
    ...Typography.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary
  },
  artist: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  controlButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.xs
  },
  controlIcon: {
    fontSize: 14,
    color: Colors.textPrimary
  }
});
