import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MovieSoundtrack, Track } from '../../api/types';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';
import { usePlayerStore } from '../../store/usePlayerStore';

interface MovieCardProps {
  movie: MovieSoundtrack;
  onPressMovie?: () => void;
  onTrackPress?: (track: Track) => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie, onPressMovie, onTrackPress }) => {
  const { playTrack } = usePlayerStore();

  const handlePlayAll = () => {
    if (movie.tracks.length > 0) {
      playTrack(movie.tracks[0], movie.tracks);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.headerRow} onPress={onPressMovie} activeOpacity={0.8}>
        <Image
          source={{ uri: movie.artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500' }}
          style={styles.cover}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.movieTitle} numberOfLines={1}>
            {movie.movieName}
          </Text>
          <Text style={styles.composer} numberOfLines={1}>
            {movie.composer} {movie.releaseYear ? `(${movie.releaseYear})` : ''}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.languageBadge}>{movie.language}</Text>
            <Text style={styles.tracksCount}>{movie.totalTracks} songs</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.playButton} onPress={handlePlayAll} activeOpacity={0.8}>
          <Text style={styles.playIcon}>▶</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Track Listing Preview */}
      <View style={styles.trackList}>
        {movie.tracks.slice(0, 3).map((track, idx) => (
          <TouchableOpacity
            key={track.id}
            style={styles.trackItem}
            onPress={() => (onTrackPress ? onTrackPress(track) : playTrack(track, movie.tracks))}
          >
            <Text style={styles.trackIndex}>{idx + 1}</Text>
            <Text style={styles.trackName} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={styles.trackDuration}>
              {Math.floor(track.durationMs / 60000)}:
              {Math.floor((track.durationMs % 60000) / 1000).toString().padStart(2, '0')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md
  },
  movieTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    fontSize: 15
  },
  composer: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  languageBadge: {
    ...Typography.monoSmall,
    color: Colors.accent,
    backgroundColor: Colors.accentMuted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.tag
  },
  tracksCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.control,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm
  },
  playIcon: {
    fontSize: 12,
    color: '#000000',
    marginLeft: 2
  },
  trackList: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    paddingTop: Spacing.sm
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  trackIndex: {
    ...Typography.monoSmall,
    color: Colors.textTertiary,
    width: 20
  },
  trackName: {
    ...Typography.body2,
    color: Colors.textSecondary,
    flex: 1
  },
  trackDuration: {
    ...Typography.monoSmall,
    color: Colors.textTertiary
  }
});
