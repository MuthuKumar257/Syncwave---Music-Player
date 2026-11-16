import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Track } from '../../api/types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SongMenuButton, SongMenuContext } from '../common/SongContextMenuModal';

interface TrackCardProps {
  track: Track;
  size?: 'compact' | 'standard' | 'row';
  context?: SongMenuContext;
  playlistId?: string;
  queueIndex?: number;
  onPress?: () => void;
  onTrackDeleted?: (trackId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  size = 'standard',
  context = 'default',
  playlistId,
  queueIndex,
  onPress,
  onTrackDeleted
}) => {
  const { currentTrack, isPlaying, playTrack } = usePlayerStore();
  const isCurrent = currentTrack?.id === track.id;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      playTrack(track);
    }
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
            {track.composer || track.artist} {track.movieName ? `• ${track.movieName}` : ''}
          </Text>
          {track.recommendationReason ? (
            <Text style={styles.reasonText} numberOfLines={1}>
              {track.recommendationReason}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowRightArea}>
          <Text style={styles.durationText}>{durationStr}</Text>
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
  const width = isCompact ? 130 : 154;

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
        <View style={styles.tagRow}>
          <Text style={styles.durationSmall}>{durationStr}</Text>
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    marginRight: Spacing.md
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
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: Colors.accent,
    borderRadius: Radius.tag,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  playingBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000000'
  },
  cardInfo: {
    marginTop: Spacing.sm
  },
  cardTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  cardArtist: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
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
  }
});
