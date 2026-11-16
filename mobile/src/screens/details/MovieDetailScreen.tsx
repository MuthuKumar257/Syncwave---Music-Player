import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { usePlayerStore } from '../../store/usePlayerStore';
import { TrackCard } from '../../components/cards/TrackCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

type MovieDetailRouteProp = RouteProp<RootStackParamList, 'MovieDetail'>;

export const MovieDetailScreen: React.FC = () => {
  const route = useRoute<MovieDetailRouteProp>();
  const navigation = useNavigation();
  const { movie } = route.params;
  const { playTrack } = usePlayerStore();

  const handlePlayAll = () => {
    if (movie.tracks.length > 0) {
      playTrack(movie.tracks[0], movie.tracks);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {movie.movieName}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Album Artwork & Metadata Header */}
        <View style={styles.heroSection}>
          <Image
            source={{ uri: movie.artworkUrl || 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600' }}
            style={styles.artwork}
          />
          <View style={styles.heroDetails}>
            <Text style={styles.movieName}>{movie.movieName}</Text>
            <Text style={styles.composer}>Composed by {movie.composer}</Text>
            <View style={styles.tagRow}>
              <Text style={styles.tag}>{movie.language}</Text>
              {movie.releaseYear ? <Text style={styles.tag}>{movie.releaseYear}</Text> : null}
              <Text style={styles.tag}>{movie.totalTracks} Tracks</Text>
            </View>

            <TouchableOpacity style={styles.playAllButton} onPress={handlePlayAll} activeOpacity={0.8}>
              <Text style={styles.playAllText}>▶ Play All Soundtrack</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tracks List */}
        <View style={styles.tracksSection}>
          <Text style={styles.sectionTitle}>Soundtrack Tracks</Text>
          {movie.tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              size="row"
              onPress={() => playTrack(track, movie.tracks)}
            />
          ))}
        </View>

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Persistent Mini Player */}
      <MiniPlayer onPress={() => (navigation as any).navigate('FullPlayer')} />
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
    color: Colors.textPrimary,
    maxWidth: 220
  },
  headerSpacer: {
    width: 40
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl
  },
  artwork: {
    width: 120,
    height: 120,
    borderRadius: Radius.card,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  heroDetails: {
    flex: 1,
    marginLeft: Spacing.lg
  },
  movieName: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  composer: {
    ...Typography.body2,
    color: Colors.textTertiary,
    marginTop: 4
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.sm
  },
  tag: {
    ...Typography.monoSmall,
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.tag,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: Spacing.xs,
    marginBottom: 4
  },
  playAllButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    alignSelf: 'flex-start',
    marginTop: Spacing.md
  },
  playAllText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  tracksSection: {},
  sectionTitle: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  footerSpacing: {
    height: 60
  }
});
