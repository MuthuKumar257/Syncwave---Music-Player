import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Track } from '../../api/types';
import { recommendationApi } from '../../api/recommendationApi';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { SongMenuButton } from '../../components/common/SongContextMenuModal';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { shareSong } from '../../utils/shareUtils';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

type SongDetailRouteProp = RouteProp<RootStackParamList, 'SongDetail'>;

export const SongDetailScreen: React.FC = () => {
  const route = useRoute<SongDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { songId, autoPlay } = route.params;

  const [track, setTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    addToQueue,
    startSongMix
  } = usePlayerStore();
  const { isFavorite, toggleFavorite } = useLibraryStore();
  const { isDownloaded, downloadTrack } = useDownloadStore();

  const isCurrentSong = currentTrack?.id === track?.id;
  const isFav = track ? isFavorite(track.id) : false;
  const isDown = track ? isDownloaded(track.id) : false;

  const loadTrack = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // 1. Check if currently playing track matches
    if (currentTrack && currentTrack.id === songId) {
      setTrack(currentTrack);
      setIsLoading(false);
      return;
    }

    // 2. Fetch from backend API
    try {
      const fetched = await recommendationApi.getSongById(songId);
      if (fetched) {
        setTrack(fetched);
      } else {
        setError('The requested song could not be found or is unavailable.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load song details');
    } finally {
      setIsLoading(false);
    }
  }, [songId, autoPlay, currentTrack, playTrack]);

  useEffect(() => {
    void loadTrack();
  }, [loadTrack]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs');
    }
  };

  const handlePlayAction = () => {
    if (!track) return;
    if (isCurrentSong) {
      togglePlayPause();
    } else {
      void playTrack(track);
    }
  };

  const { isAuthenticated } = useAuthStore();

  const handleToggleFavorite = async () => {
    if (!track) return;
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

  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading Track...</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Fetching shared song details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !track) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Song Unavailable</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>🎵</Text>
          <Text style={styles.errorTitle}>Song Not Found</Text>
          <Text style={styles.errorSubtitle}>
            {error || 'This song link is invalid or may have been removed.'}
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => navigation.replace('MainTabs')}
            activeOpacity={0.8}
          >
            <Text style={styles.exploreBtnText}>Browse Trending Music</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityLabel="Go Back">
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerBadge}>SHARED TRACK</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {track.title}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => void shareSong(track)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerActionBtn}
            accessibilityLabel="Share Song"
          >
            <Text style={styles.actionIcon}>↗</Text>
          </TouchableOpacity>
          <SongMenuButton track={track} context="default" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Large Artwork Showcase */}
        <View style={styles.artworkWrapper}>
          <Image
            source={{
              uri:
                track.artworkUrl ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800'
            }}
            style={styles.artwork}
            resizeMode="cover"
          />
        </View>

        {/* Metadata Details */}
        <View style={styles.metaContainer}>
          <Text style={styles.songTitle}>{track.title}</Text>
          <Text style={styles.artistName}>{track.composer || track.artist}</Text>
          {track.movieName || track.album ? (
            <Text style={styles.albumName}>
              {track.movieName ? `Soundtrack: ${track.movieName}` : `Album: ${track.album}`}
            </Text>
          ) : null}

          {/* Tags Row */}
          <View style={styles.tagsRow}>
            {track.language ? (
              <View style={styles.tagBadge}>
                <Text style={styles.tagText}>{track.language}</Text>
              </View>
            ) : null}
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>{formatDuration(track.durationMs)}</Text>
            </View>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>High Fidelity</Text>
            </View>
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryPlayBtn, isCurrentSong && isPlaying && styles.playingBtn]}
            onPress={handlePlayAction}
            activeOpacity={0.8}
          >
            <Text style={styles.playIcon}>{isCurrentSong && isPlaying ? '❚❚' : '▶'}</Text>
            <Text style={styles.playBtnText}>
              {isCurrentSong && isPlaying ? 'Pause Song' : 'Play Now'}
            </Text>
          </TouchableOpacity>

          <View style={styles.actionGrid}>
            {/* 1. Share */}
            <TouchableOpacity
              style={styles.gridBtn}
              onPress={() => void shareSong(track)}
              activeOpacity={0.7}
            >
              <Text style={styles.gridIcon}>↗</Text>
              <Text style={styles.gridLabel}>Share</Text>
            </TouchableOpacity>

            {/* 2. Add to Queue */}
            <TouchableOpacity
              style={styles.gridBtn}
              onPress={() => addToQueue(track)}
              activeOpacity={0.7}
            >
              <Text style={styles.gridIcon}>＋</Text>
              <Text style={styles.gridLabel}>Queue</Text>
            </TouchableOpacity>

            {/* 3. Favorite */}
            <TouchableOpacity
              style={styles.gridBtn}
              onPress={handleToggleFavorite}
              activeOpacity={0.7}
            >
              <Text style={[styles.gridIcon, isFav && styles.activeHeart]}>
                {isFav ? '♥' : '♡'}
              </Text>
              <Text style={[styles.gridLabel, isFav && styles.activeHeartText]}>
                {isFav ? 'Liked' : 'Favorite'}
              </Text>
            </TouchableOpacity>

            {/* 4. Download */}
            <TouchableOpacity
              style={styles.gridBtn}
              onPress={() => void downloadTrack(track)}
              activeOpacity={0.7}
            >
              <Text style={[styles.gridIcon, isDown && styles.activeDownload]}>
                {isDown ? '✓' : '⬇'}
              </Text>
              <Text style={[styles.gridLabel, isDown && styles.activeDownloadText]}>
                {isDown ? 'Offline' : 'Download'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Start Mix Button */}
          <TouchableOpacity
            style={styles.mixBtn}
            onPress={() => {
              void startSongMix(track);
              navigation.navigate('FullPlayer');
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.mixIcon}>✨</Text>
            <Text style={styles.mixText}>Start Song Mix with Similar Tracks</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mini Player */}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  backText: {
    color: Colors.textPrimary,
    fontSize: 32,
    lineHeight: 34
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm
  },
  headerBadge: {
    fontSize: 10,
    color: Colors.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 2
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerActionBtn: {
    marginRight: 8,
    padding: 6
  },
  actionIcon: {
    fontSize: 18,
    color: Colors.textSecondary
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 110
  },
  artworkWrapper: {
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    marginVertical: Spacing.md
  },
  artwork: {
    width: '100%',
    height: '100%'
  },
  metaContainer: {
    alignItems: 'center',
    marginVertical: Spacing.sm
  },
  songTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4
  },
  artistName: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4
  },
  albumName: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.sm
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6
  },
  tagBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  tagText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  actionsContainer: {
    marginTop: Spacing.md
  },
  primaryPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: Radius.full,
    gap: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  playingBtn: {
    backgroundColor: '#E11D48'
  },
  playIcon: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700'
  },
  playBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700'
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  gridBtn: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10
  },
  gridIcon: {
    fontSize: 20,
    color: Colors.textPrimary,
    marginBottom: 4
  },
  gridLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500'
  },
  activeHeart: {
    color: '#EF4444'
  },
  activeHeartText: {
    color: '#EF4444'
  },
  activeDownload: {
    color: '#10B981'
  },
  activeDownloadText: {
    color: '#10B981'
  },
  mixBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginTop: Spacing.md,
    gap: 8
  },
  mixIcon: {
    fontSize: 16
  },
  mixText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: 14
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: Spacing.md
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6
  },
  errorSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.lg
  },
  exploreBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.full
  },
  exploreBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14
  }
});
