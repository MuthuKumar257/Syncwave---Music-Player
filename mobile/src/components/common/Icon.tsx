import React from 'react';
import { View, StyleSheet, Text } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Clean vector line icons for SyncWave Mobile.
 * Replaces all emoji slop with consistent 16-18px monochrome line glyphs.
 */
export const HomeIcon: React.FC<IconProps> = ({ size = 18, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Roof Chevron */}
      <View
        style={{
          width: size * 0.65,
          height: size * 0.65,
          borderTopWidth: strokeWidth,
          borderLeftWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          position: 'absolute',
          top: size * 0.12
        }}
      />
      {/* House Body */}
      <View
        style={{
          width: size * 0.6,
          height: size * 0.45,
          borderBottomWidth: strokeWidth,
          borderLeftWidth: strokeWidth,
          borderRightWidth: strokeWidth,
          borderColor: color,
          position: 'absolute',
          bottom: size * 0.15,
          borderBottomLeftRadius: 1,
          borderBottomRightRadius: 1
        }}
      />
    </View>
  );
};

export const DiscoverIcon: React.FC<IconProps> = ({ size = 18, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Outer Compass Circle */}
      <View
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size,
          borderWidth: strokeWidth,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Needle Diamond */}
        <View
          style={{
            width: size * 0.35,
            height: size * 0.35,
            borderTopWidth: strokeWidth + 0.5,
            borderRightWidth: strokeWidth + 0.5,
            borderColor: color,
            transform: [{ rotate: '45deg' }]
          }}
        />
      </View>
    </View>
  );
};

export const LibraryIcon: React.FC<IconProps> = ({ size = 18, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Playlist Lines */}
      <View style={{ width: size * 0.75, height: size * 0.65, justifyContent: 'space-between' }}>
        <View style={{ height: strokeWidth, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ height: strokeWidth, backgroundColor: color, width: '85%', borderRadius: 1 }} />
        <View style={{ height: strokeWidth, backgroundColor: color, width: '65%', borderRadius: 1 }} />
      </View>
    </View>
  );
};

export const SchedulerIcon: React.FC<IconProps> = ({ size = 18, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Clock Face */}
      <View
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size,
          borderWidth: strokeWidth,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Clock Hands (3:00 / Right-Angle) */}
        <View
          style={{
            width: size * 0.28,
            height: strokeWidth,
            backgroundColor: color,
            position: 'absolute',
            left: '50%'
          }}
        />
        <View
          style={{
            width: strokeWidth,
            height: size * 0.28,
            backgroundColor: color,
            position: 'absolute',
            bottom: '50%'
          }}
        />
      </View>
    </View>
  );
};

export const ProfileIcon: React.FC<IconProps> = ({ size = 18, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Head */}
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size,
          borderWidth: strokeWidth,
          borderColor: color,
          position: 'absolute',
          top: size * 0.1
        }}
      />
      {/* Shoulders */}
      <View
        style={{
          width: size * 0.8,
          height: size * 0.35,
          borderTopWidth: strokeWidth,
          borderLeftWidth: strokeWidth,
          borderRightWidth: strokeWidth,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          borderColor: color,
          position: 'absolute',
          bottom: size * 0.12
        }}
      />
    </View>
  );
};

export const MoonIcon: React.FC<IconProps> = ({ size = 16, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.75,
          height: size * 0.75,
          borderRadius: size,
          borderLeftWidth: strokeWidth + 0.5,
          borderBottomWidth: strokeWidth + 0.5,
          borderColor: color,
          transform: [{ rotate: '-35deg' }]
        }}
      />
    </View>
  );
};

export const QueueIcon: React.FC<IconProps> = ({ size = 16, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View style={{ width: size * 0.75, height: size * 0.6, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ height: strokeWidth, backgroundColor: color, flex: 1, borderRadius: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ height: strokeWidth, backgroundColor: color, flex: 1, borderRadius: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
          <View style={{ height: strokeWidth, backgroundColor: color, flex: 1, borderRadius: 1 }} />
        </View>
      </View>
    </View>
  );
};

export const DeviceIcon: React.FC<IconProps> = ({ size = 16, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Screen Frame */}
      <View
        style={{
          width: size * 0.8,
          height: size * 0.55,
          borderWidth: strokeWidth,
          borderColor: color,
          borderRadius: 2,
          position: 'absolute',
          top: size * 0.15
        }}
      />
      {/* Base Stand */}
      <View
        style={{
          width: size * 0.4,
          height: strokeWidth,
          backgroundColor: color,
          position: 'absolute',
          bottom: size * 0.15
        }}
      />
    </View>
  );
};

export const DownloadIcon: React.FC<IconProps> = ({ size = 16, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      {/* Arrow Shaft */}
      <View
        style={{
          width: strokeWidth,
          height: size * 0.45,
          backgroundColor: color,
          position: 'absolute',
          top: size * 0.15
        }}
      />
      {/* Arrow Point */}
      <View
        style={{
          width: size * 0.35,
          height: size * 0.35,
          borderBottomWidth: strokeWidth,
          borderRightWidth: strokeWidth,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          position: 'absolute',
          top: size * 0.28
        }}
      />
      {/* Bottom Tray */}
      <View
        style={{
          width: size * 0.75,
          height: strokeWidth,
          backgroundColor: color,
          position: 'absolute',
          bottom: size * 0.15,
          borderRadius: 1
        }}
      />
    </View>
  );
};

export const SearchIcon: React.FC<IconProps> = ({ size = 16, color = '#A1A1A6', strokeWidth = 1.5 }) => {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size,
          borderWidth: strokeWidth,
          borderColor: color,
          position: 'absolute',
          top: size * 0.1,
          left: size * 0.1
        }}
      />
      <View
        style={{
          width: size * 0.35,
          height: strokeWidth,
          backgroundColor: color,
          position: 'absolute',
          bottom: size * 0.2,
          right: size * 0.1,
          transform: [{ rotate: '45deg' }]
        }}
      />
    </View>
  );
};

export const SoundWaveIcon: React.FC<IconProps> = ({ size = 20, color = '#F59E0B' }) => {
  return (
    <View style={[styles.center, { width: size, height: size, flexDirection: 'row', gap: 2 }]}>
      <View style={{ width: 2.5, height: size * 0.4, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 2.5, height: size * 0.85, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 2.5, height: size * 0.6, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: 2.5, height: size * 0.3, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  }
});
