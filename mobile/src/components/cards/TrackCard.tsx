import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Track } from '../../api/types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { Responsive } from '../../utils/responsive';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SongMenuButton, SongMenuContext } from '../common/SongContextMenuModal';

interface TrackCardProps {
  track: Track;
  size?: 'compact' | 'standard' | 'row';
  context?: SongMenuContext;
  playlistId?: string;
  queueIndex?: number;
  onPress?: () => void;
  onPlayPress?: () => void;
  onTrackDeleted?: (trackId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  size = 'standard',
  context = 'default',
  playlistId,
  queueIndex,
  onPress,
  onPlayPress,
  onTrackDeleted
}) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentTrack, isPlaying, playTrack } = usePlayerStore();
  const { isFavorite, toggleFavorite } = useLibraryStore();
  const { isAuthenticated } = useAuthStore();
  const isCurrent = currentTrack?.id === track.id;
  const isFav = isFavorite(track.id);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      try {
        navigation.navigate('SongDetail', { songId: track.id, autoPlay: false });
      } catch {
        // Fallback if navigation context unavailable
      }
    }
  };

  const handlePlayPress = (e?: any) => {
    e?.stopPropagation?.();
    if (onPlayPress) {
      onPlayPress();
    } else {
      playTrack(track);
    }
  };

  const handleToggleHeart = async (e?: any) => {
    e?.stopPropagation?.();
    if (!isAuthenticated) {
      Alert.alert(
        'Sign in to Save Favorites',
        'Save your favorite songs and access them across all your devices by signing in to SyncWave.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign In',
            onPress: async () => {
              try {
                await AsyncStorage.setItem('@syncwave_pending_fav_track', JSON.stringify(track));
              } catch {}
              try {
                navigation.navigate('Login');
              } catch {}
            }
          }
        ]
      );
      return;
    }

    const isNowFav = await toggleFavorite(track);
    Alert.alert(
      isNowFav ? 'Added to Favorites' : 'Removed from Favorites',
      isNowFav
        ? `"${track.title}" has been saved to your favorite songs.`
        : `"${track.title}" has been removed from your favorites.`
    );
  };

  const minutes = Math.floor(track.durationMs / 60000);
  const seconds = Math.floor((track.durationMs % 60000) / 1000);
  const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  if (size === 'row') {
    return (
      <TouchableOpacity
        style={[styles.rowContainer, isCurrent && styles.activeBorder]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' }}
          style={styles.rowArtwork}
        />
        <View style={styles.rowDetails}>
          <Text style={[styles.rowTitle, isCurrent && styles.accentText]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {track.artist || 'Unknown Artist'}{track.composer ? ` • Dir: ${track.composer}` : ''}{track.movieName ? ` • ${track.movieName}` : ''}
          </Text>
          {track.recommendationReason ? (
            <Text style={styles.reasonText} numberOfLines={1}>
              {track.recommendationReason}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowRightArea}>
          <TouchableOpacity
            style={styles.rowPlayButton}
            onPress={handlePlayPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Play ${track.title}`}
          >
            <Text style={styles.rowPlayIcon}>{isCurrent && isPlaying ? '❚❚' : '▶'}</Text>
          </TouchableOpacity>
          <Text style={styles.durationText}>{durationStr}</Text>
          <TouchableOpacity
            style={styles.heartButton}
            onPress={handleToggleHeart}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Text style={[styles.heartIcon, isFav ? styles.heartActive : styles.heartInactive]}>
              {isFav ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>
          <SongMenuButton
            track={track}
            context={context}
            playlistId={playlistId}
            queueIndex={queueIndex}
            size="sm"
            onTrackDeleted={onTrackDeleted}
          />
        </View>
      </TouchableOpacity>
    );
  }

  const isCompact = size === 'compact';
  const width = isCompact ? Math.round(Responsive.cardWidth * 0.88) : Responsive.cardWidth;

  return (
    <TouchableOpacity
      style={[styles.cardContainer, { width }, isCurrent && styles.activeBorder]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: track.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500' }}
          style={styles.artwork}
        />
        {/* Dedicated Play Button on artwork */}
        <TouchableOpacity
          style={styles.cardPlayButton}
          onPress={handlePlayPress}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          accessibilityLabel={`Play ${track.title}`}
        >
          <Text style={styles.cardPlayIcon}>{isCurrent && isPlaying ? '❚❚' : '▶'}</Text>
        </TouchableOpacity>
        {isCurrent && isPlaying ? (
          <View style={styles.playingBadge}>
            <Text style={styles.playingBadgeText}>PLAYING</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardTitle, isCurrent && styles.accentText]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.cardArtist} numberOfLines={1}>
          {track.composer || track.artist}
        </Text>
        {track.recommendationReason ? (
          <Text style={styles.cardReason} numberOfLines={1}>
            {track.recommendationReason}
          </Text>
        ) : null}
        <View style={styles.tagRow}>
          <Text style={styles.durationSmall}>{durationStr}</Text>
          <View style={styles.tagActions}>
            <TouchableOpacity
              style={styles.heartButtonSmall}
              onPress={handleToggleHeart}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Text style={[styles.heartIconSmall, isFav ? styles.heartActive : styles.heartInactive]}>
                {isFav ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
            <SongMenuButton
              track={track}
              context={context}
              playlistId={playlistId}
              queueIndex={queueIndex}
              size="sm"
              onTrackDeleted={onTrackDeleted}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: 7,
    marginRight: 10
  },
  activeBorder: {
    borderColor: Colors.accent
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.control,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceRaised
  },
  artwork: {
    width: '100%',
    height: '100%'
  },
  playingBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.accent,
    borderRadius: Radius.tag,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  playingBadgeText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#000000'
  },
  cardPlayButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3
  },
  cardPlayIcon: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    marginLeft: 1
  },
  rowPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6
  },
  rowPlayIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    marginLeft: 1
  },
  cardInfo: {
    marginTop: 6
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  cardArtist: {
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 1
  },
  cardReason: {
    fontSize: 9,
    color: Colors.accent,
    marginTop: 1,
    fontFamily: 'monospace'
  },
  accentText: {
    color: Colors.accent
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  durationSmall: {
    ...Typography.monoSmall,
    color: Colors.textTertiary
  },

  // Row layout
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    marginBottom: Spacing.sm
  },
  rowArtwork: {
    width: 44,
    height: 44,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised
  },
  rowDetails: {
    flex: 1,
    marginLeft: Spacing.md
  },
  rowTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  rowSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  reasonText: {
    ...Typography.monoSmall,
    fontSize: 10,
    color: Colors.accent,
    marginTop: 2
  },
  rowRightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm
  },
  durationText: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    marginRight: 4
  },
  heartButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2
  },
  heartIcon: {
    fontSize: 18,
    lineHeight: 20
  },
  heartActive: {
    color: '#EF4444'
  },
  heartInactive: {
    color: Colors.textTertiary
  },
  tagActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  heartButtonSmall: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  heartIconSmall: {
    fontSize: 14,
    lineHeight: 16
  }
});
