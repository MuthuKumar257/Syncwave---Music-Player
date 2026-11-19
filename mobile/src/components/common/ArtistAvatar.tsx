import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  ImageStyle
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Radius } from '../../theme/spacing';

export interface ArtistAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  isSelected?: boolean;
  showBadge?: boolean;
}

const AVATAR_PALETTE = [
  '#FF6D00', // SyncWave Accent Orange
  '#D81B60', // Vibrant Pink
  '#8E24AA', // Purple
  '#5E35B1', // Deep Purple
  '#3949AB', // Indigo
  '#1E88E5', // Blue
  '#00ACC1', // Cyan
  '#00897B', // Teal
  '#43A047', // Green
  '#FB8C00', // Amber Orange
  '#F4511E', // Deep Orange
  '#E53935'  // Red
];

/**
 * Deterministically generates a consistent vibrant background color from the artist name
 */
export function getArtistAvatarColor(name: string): string {
  if (!name) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

/**
 * Extracts clean, punchy artist initials (e.g. "A. R. Rahman" -> "ARR", "Ilaiyaraaja" -> "IR")
 */
export function getArtistInitials(name: string): string {
  if (!name || typeof name !== 'string') return '?';
  const cleaned = name
    .replace(/^(dir_|singer_|composer_|artist_|dr\.|mr\.|mrs\.|ms\.)/i, '')
    .trim();
  const parts = cleaned.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length >= 3) {
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const ArtistAvatar: React.FC<ArtistAvatarProps> = ({
  name,
  imageUrl,
  size = 60,
  borderRadius,
  style,
  imageStyle,
  isSelected = false,
  showBadge = true
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(imageUrl));

  const radius = borderRadius !== undefined ? borderRadius : size / 2;
  const initials = getArtistInitials(name);
  const bgColor = getArtistAvatarColor(name);
  const fontSize = Math.max(10, Math.floor(size * 0.36));

  const shouldRenderImage = Boolean(imageUrl) && !hasError;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bgColor
        },
        style
      ]}
    >
      {/* Fallback Initials Avatar always rendered as base */}
      <View style={[styles.initialsContainer, { borderRadius: radius }]}>
        <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
      </View>

      {/* Network Image Overlay */}
      {shouldRenderImage ? (
        <Image
          source={{ uri: imageUrl!, cache: 'force-cache' }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: radius
            },
            imageStyle
          ]}
          resizeMode="cover"
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            setHasError(true);
            setIsLoading(false);
          }}
        />
      ) : null}

      {/* Loading Indicator */}
      {isLoading && shouldRenderImage ? (
        <View style={[styles.loadingOverlay, { borderRadius: radius }]}>
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}

      {/* Selection Check Badge */}
      {isSelected && showBadge ? (
        <View style={styles.checkBadge}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible'
  },
  initialsContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center'
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5
  },
  image: {
    ...StyleSheet.absoluteFillObject
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: Radius.circle,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  checkText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000'
  }
});
