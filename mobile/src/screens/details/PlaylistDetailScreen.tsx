import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Share
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Track } from '../../api/types';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLocalMusicStore } from '../../store/useLocalMusicStore';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { searchApi } from '../../api/searchApi';
import { TrackCard } from '../../components/cards/TrackCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { sharePlaylist } from '../../utils/shareUtils';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

type PlaylistDetailRouteProp = RouteProp<RootStackParamList, 'PlaylistDetail'>;

const ARTWORK_PRESETS = [
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500',
  'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500'
];

type CatalogueCategory = 'ALL' | 'FAVORITES' | 'DEVICE' | 'RECOMMENDED';

export const PlaylistDetailScreen: React.FC = () => {
  const route = useRoute<PlaylistDetailRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { playlistId } = route.params;

  const {
    playlists,
    updatePlaylist,
    removeTrackFromPlaylist,
    reorderPlaylistTracks,
    addTrackToPlaylist,
    addTracksToPlaylist,
    deletePlaylist,
    fetchPlaylistDetails,
    favoriteTracks
  } = useLibraryStore();

  const { playTrack, addTracksToQueue } = usePlayerStore();
  const { localTracks } = useLocalMusicStore();
  const { feed } = useRecommendationStore();

  const playlist = playlists.find((p) => p.id === playlistId);
  const [isLoading, setIsLoading] = useState(!playlist);

  // Fetch playlist details on mount
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        await fetchPlaylistDetails(playlistId);
      } catch (err) {
        console.warn('[PlaylistDetailScreen] fetch details error:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, [playlistId, fetchPlaylistDetails]);

  // Modals state
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(playlist?.name || '');
  const [editDescription, setEditDescription] = useState(playlist?.description || '');
  const [selectedArtwork, setSelectedArtwork] = useState(playlist?.artworkUrl || ARTWORK_PRESETS[0]);
  const [customArtworkUrl, setCustomArtworkUrl] = useState('');

  // Add Songs Modal state
  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogueCategory>('ALL');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize edit inputs when playlist changes
  useEffect(() => {
    if (playlist) {
      setEditName(playlist.name);
      setEditDescription(playlist.description || '');
      setSelectedArtwork(playlist.artworkUrl || ARTWORK_PRESETS[0]);
    }
  }, [playlist?.id, playlist?.name, playlist?.description, playlist?.artworkUrl]);

  // Total Duration Calculation
  const totalDurationStr = useMemo(() => {
    if (!playlist || playlist.tracks.length === 0) return '0 min';
    const totalMs = playlist.tracks.reduce((acc, t) => acc + (t.durationMs || 0), 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    if (totalMinutes >= 60) {
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hrs} hr ${mins} min${mins === 1 ? '' : 's'}`;
    }
    return `${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
  }, [playlist]);

  // Aggregate candidate tracks from favorites, device, and recommendations
  const allAvailableCatalogue = useMemo(() => {
    const feedTracks: Track[] = [];
    if (feed) {
      if (Array.isArray(feed.recommendedForYou)) feedTracks.push(...feed.recommendedForYou);
      if (Array.isArray(feed.recentlyPlayed)) feedTracks.push(...feed.recentlyPlayed);
      if (Array.isArray(feed.trendingInLanguages)) feedTracks.push(...feed.trendingInLanguages);
      if (Array.isArray(feed.newReleases)) feedTracks.push(...feed.newReleases);
      if (Array.isArray(feed.discoverNewMusic)) feedTracks.push(...feed.discoverNewMusic);
    }

    const map = new Map<string, Track>();
    for (const t of favoriteTracks) map.set(t.id, t);
    for (const t of localTracks) if (!map.has(t.id)) map.set(t.id, t);
    for (const t of feedTracks) if (!map.has(t.id)) map.set(t.id, t);
    for (const t of onlineResults) if (!map.has(t.id)) map.set(t.id, t);

    return Array.from(map.values());
  }, [favoriteTracks, localTracks, feed, onlineResults]);

  // Debounced search when query changes
  useEffect(() => {
    const q = songSearchQuery.trim();
    if (!isAddSongsModalOpen || q.length < 2) {
      setOnlineResults([]);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setIsSearchingOnline(true);
        const res = await searchApi.searchUniversal(q);
        const tracks = Array.isArray(res?.songs) ? res.songs : [];
        setOnlineResults(tracks);
      } catch {
        // Fallback to local filter
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [songSearchQuery, isAddSongsModalOpen]);

  // Filter candidate tracks based on category & search query
  const filteredCatalogue = useMemo(() => {
    let list: Track[] = [];

    switch (selectedCategory) {
      case 'FAVORITES':
        list = [...favoriteTracks];
        break;
      case 'DEVICE':
        list = [...localTracks];
        break;
      case 'RECOMMENDED': {
        const feedTracks: Track[] = [];
        if (feed) {
          if (Array.isArray(feed.recommendedForYou)) feedTracks.push(...feed.recommendedForYou);
          if (Array.isArray(feed.recentlyPlayed)) feedTracks.push(...feed.recentlyPlayed);
          if (Array.isArray(feed.trendingInLanguages)) feedTracks.push(...feed.trendingInLanguages);
          if (Array.isArray(feed.newReleases)) feedTracks.push(...feed.newReleases);
          if (Array.isArray(feed.discoverNewMusic)) feedTracks.push(...feed.discoverNewMusic);
        }
        list = feedTracks;
        break;
      }
      case 'ALL':
      default:
        list = allAvailableCatalogue;
        break;
    }

    // Deduplicate
    const uniqueMap = new Map<string, Track>();
    for (const t of list) {
      uniqueMap.set(t.id, t);
    }
    const deduplicated = Array.from(uniqueMap.values());

    const q = songSearchQuery.toLowerCase().trim();
    if (!q) return deduplicated;

    return deduplicated.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.composer && t.composer.toLowerCase().includes(q)) ||
        (t.movieName && t.movieName.toLowerCase().includes(q)) ||
        (t.language && t.language.toLowerCase().includes(q))
    );
  }, [selectedCategory, favoriteTracks, localTracks, feed, allAvailableCatalogue, songSearchQuery]);

  // Set of song IDs already present in this playlist
  const existingSongIdsSet = useMemo(() => {
    return new Set(playlist?.trackIds || []);
  }, [playlist?.trackIds]);

  // Play Entire Playlist
  const handlePlayAll = () => {
    if (!playlist || playlist.tracks.length === 0) return;
    void playTrack(playlist.tracks[0], playlist.tracks);
  };

  // Shuffle Playlist
  const handleShufflePlay = () => {
    if (!playlist || playlist.tracks.length === 0) return;
    const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
    void playTrack(shuffled[0], shuffled);
  };

  // Add All to Queue
  const handleAddAllToQueue = () => {
    if (!playlist || playlist.tracks.length === 0) return;
    addTracksToQueue(playlist.tracks);
    Alert.alert('Queue Updated', `Added ${playlist.tracks.length} song${playlist.tracks.length === 1 ? '' : 's'} to queue.`);
  };

  // Save Edit Changes
  const handleSaveEdit = async () => {
    if (!playlist) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Playlist name cannot be empty.');
      return;
    }
    const finalArtwork = customArtworkUrl.trim() || selectedArtwork;
    await updatePlaylist(playlist.id, {
      name: trimmed,
      description: editDescription.trim(),
      artworkUrl: finalArtwork
    });
    setIsEditModalOpen(false);
  };

  // Delete Playlist
  const handleDelete = () => {
    if (!playlist) return;
    setIsOptionsMenuOpen(false);
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(playlist.id);
            navigation.goBack();
          }
        }
      ]
    );
  };

  // Share Playlist
  const handleSharePlaylist = async () => {
    if (!playlist) return;
    setIsOptionsMenuOpen(false);
    try {
      await sharePlaylist({ id: playlist.id, name: playlist.name });
    } catch (err) {
      console.warn('[PlaylistDetailScreen] Share error:', err);
    }
  };

  // Toggle selection in Add Songs modal
  const handleToggleSelectSong = (trackId: string) => {
    if (existingSongIdsSet.has(trackId)) return; // Prevent duplicate
    setSelectedSongIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  // Add all selected songs
  const handleAddSelectedSongs = async () => {
    if (!playlist || selectedSongIds.length === 0) return;
    const tracksToAdd = filteredCatalogue.filter((t) => selectedSongIds.includes(t.id));
    if (tracksToAdd.length === 0) return;

    const count = await addTracksToPlaylist(playlist.id, tracksToAdd);
    setSelectedSongIds([]);
    setIsAddSongsModalOpen(false);
    Alert.alert('Songs Added', `Added ${count} song${count === 1 ? '' : 's'} to "${playlist.name}".`);
  };

  // Quick single song add
  const handleQuickAddSong = async (track: Track) => {
    if (!playlist) return;
    const success = await addTrackToPlaylist(playlist.id, track);
    if (success) {
      Alert.alert('Song Added', `"${track.title}" added to "${playlist.name}".`);
    } else {
      Alert.alert('Already Added', `"${track.title}" is already in this playlist.`);
    }
  };

  // Loading state
  if (isLoading && !playlist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading playlist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not found state
  if (!playlist) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Playlist Not Found</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Playlist Removed</Text>
          <Text style={styles.emptySubtitle}>This playlist no longer exists in your library.</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.actionBtnText}>Back to Library</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Go Back"
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {playlist.name}
        </Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => {
              setEditName(playlist.name);
              setEditDescription(playlist.description || '');
              setSelectedArtwork(playlist.artworkUrl || ARTWORK_PRESETS[0]);
              setCustomArtworkUrl('');
              setIsEditModalOpen(true);
            }}
            style={styles.editBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsOptionsMenuOpen(true)}
            style={styles.moreOptionsBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.moreOptionsText}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Playlist Hero Banner */}
        <View style={styles.heroSection}>
          <Image
            source={{
              uri:
                playlist.artworkUrl ||
                playlist.tracks[0]?.artworkUrl ||
                'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'
            }}
            style={styles.heroArtwork}
          />
          <View style={styles.heroDetails}>
            <Text style={styles.playlistTitle}>{playlist.name}</Text>
            {playlist.description ? (
              <Text style={styles.playlistDescription}>{playlist.description}</Text>
            ) : (
              <Text style={styles.playlistDescriptionPlaceholder}>No description added.</Text>
            )}
            <Text style={styles.playlistMeta}>
              {playlist.tracks.length} song{playlist.tracks.length === 1 ? '' : 's'} • {totalDurationStr}
            </Text>
          </View>
        </View>

        {/* Action Controls Bar */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryPlayBtn, playlist.tracks.length === 0 && styles.disabledBtn]}
            onPress={handlePlayAll}
            disabled={playlist.tracks.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.playIcon}>▶</Text>
            <Text style={styles.primaryPlayText}>Play All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, playlist.tracks.length === 0 && styles.disabledBtn]}
            onPress={handleShufflePlay}
            disabled={playlist.tracks.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryActionIcon}>🔀</Text>
            <Text style={styles.secondaryActionText}>Shuffle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, playlist.tracks.length === 0 && styles.disabledBtn]}
            onPress={handleAddAllToQueue}
            disabled={playlist.tracks.length === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryActionIcon}>＋</Text>
            <Text style={styles.secondaryActionText}>Queue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addSongsPillBtn}
            onPress={() => {
              setSelectedSongIds([]);
              setIsAddSongsModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.addSongsPillText}>＋ Add Songs</Text>
          </TouchableOpacity>
        </View>

        {/* Song List Header */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>
            Playlist Songs ({playlist.tracks.length})
          </Text>
          {playlist.tracks.length > 0 && (
            <Text style={styles.listHeaderSub}>Use ▲ ▼ to reorder</Text>
          )}
        </View>

        {/* Tracks List with Reorder Controls */}
        {playlist.tracks.map((track, index) => (
          <View key={`${track.id}_${index}`} style={styles.trackRowWrapper}>
            <View style={styles.trackCardContainer}>
              <TrackCard
                track={track}
                size="row"
                context="playlist"
                playlistId={playlist.id}
                onPress={() => playTrack(track, playlist.tracks)}
              />
            </View>

            {/* Reorder and Delete controls */}
            <View style={styles.reorderControls}>
              <TouchableOpacity
                onPress={() => void reorderPlaylistTracks(playlist.id, index, index - 1)}
                disabled={index === 0}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}
                accessibilityLabel="Move song up"
              >
                <Text style={styles.reorderArrow}>▲</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void reorderPlaylistTracks(playlist.id, index, index + 1)}
                disabled={index === playlist.tracks.length - 1}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={[
                  styles.reorderBtn,
                  index === playlist.tracks.length - 1 && styles.reorderBtnDisabled
                ]}
                accessibilityLabel="Move song down"
              >
                <Text style={styles.reorderArrow}>▼</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void removeTrackFromPlaylist(playlist.id, track.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.removeBtn}
                accessibilityLabel="Remove song from playlist"
              >
                <Text style={styles.removeIcon}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Empty State */}
        {playlist.tracks.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎵</Text>
            <Text style={styles.emptyTitle}>This Playlist is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Add songs from your favorites, device storage, or online catalogue to build your custom mix.
            </Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setSelectedSongIds([]);
                setIsAddSongsModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>＋ Add Songs Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delete Playlist Link */}
        <TouchableOpacity style={styles.deleteLink} onPress={handleDelete}>
          <Text style={styles.deleteLinkText}>Delete this playlist</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Playlist Options Action Modal */}
      <Modal visible={isOptionsMenuOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.dismissOverlay}
            activeOpacity={1}
            onPress={() => setIsOptionsMenuOpen(false)}
          />
          <View style={styles.optionsCard}>
            <View style={styles.optionsHeader}>
              <Text style={styles.optionsTitle}>{playlist.name}</Text>
              <Text style={styles.optionsSub}>{playlist.tracks.length} songs • {totalDurationStr}</Text>
            </View>

            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setIsOptionsMenuOpen(false);
                setIsEditModalOpen(true);
              }}
            >
              <Text style={styles.optionIcon}>✏️</Text>
              <Text style={styles.optionLabel}>Edit Playlist Details</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={handleSharePlaylist}>
              <Text style={styles.optionIcon}>↗️</Text>
              <Text style={styles.optionLabel}>Share Playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionRow} onPress={handleDelete}>
              <Text style={[styles.optionIcon, { color: Colors.error }]}>🗑️</Text>
              <Text style={[styles.optionLabel, { color: Colors.error }]}>Delete Playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionsCancelBtn}
              onPress={() => setIsOptionsMenuOpen(false)}
            >
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Playlist Modal */}
      <Modal visible={isEditModalOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Playlist</Text>

            <Text style={styles.fieldLabel}>Playlist Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Playlist name..."
              placeholderTextColor={Colors.textTertiary}
            />

            <Text style={styles.fieldLabel}>Description (Optional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="What's the vibe of this playlist?"
              placeholderTextColor={Colors.textTertiary}
              multiline
            />

            <Text style={styles.fieldLabel}>Choose Artwork Preset</Text>
            <View style={styles.artworkPresetsRow}>
              {ARTWORK_PRESETS.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => {
                    setSelectedArtwork(url);
                    setCustomArtworkUrl('');
                  }}
                  style={[
                    styles.presetThumbWrapper,
                    selectedArtwork === url && !customArtworkUrl && styles.presetThumbSelected
                  ]}
                >
                  <Image source={{ uri: url }} style={styles.presetThumb} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Or Custom Artwork URL</Text>
            <TextInput
              style={styles.modalInput}
              value={customArtworkUrl}
              onChangeText={setCustomArtworkUrl}
              placeholder="https://example.com/artwork.jpg"
              placeholderTextColor={Colors.textTertiary}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Songs Modal with Catalogue Search & Multi-Select */}
      <Modal visible={isAddSongsModalOpen} transparent animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.addSongsHeader}>
            <View>
              <Text style={styles.modalTitle}>Add Songs to Playlist</Text>
              <Text style={styles.modalSub}>{playlist.name}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsAddSongsModalOpen(false)}
              style={styles.closeModalBtn}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by title, singer, director, language..."
              placeholderTextColor={Colors.textTertiary}
              value={songSearchQuery}
              onChangeText={setSongSearchQuery}
              autoFocus
            />
            {isSearchingOnline && (
              <ActivityIndicator
                size="small"
                color={Colors.accent}
                style={styles.searchIndicator}
              />
            )}
          </View>

          {/* Category Filter Chips */}
          <View style={styles.categoriesRow}>
            {(
              [
                { key: 'ALL', label: 'All Songs' },
                { key: 'FAVORITES', label: 'Favorites' },
                { key: 'DEVICE', label: 'Device Storage' },
                { key: 'RECOMMENDED', label: 'Recommended' }
              ] as const
            ).map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.key && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat.key && styles.categoryChipTextActive
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quick Selection Helpers */}
          <View style={styles.selectionHelpersRow}>
            <Text style={styles.selectionCountText}>
              {selectedSongIds.length} song{selectedSongIds.length === 1 ? '' : 's'} selected
            </Text>
            {selectedSongIds.length > 0 && (
              <TouchableOpacity onPress={() => setSelectedSongIds([])}>
                <Text style={styles.clearSelectionText}>Clear selection</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Candidate Songs ScrollView */}
          <ScrollView contentContainerStyle={styles.addSongsList} showsVerticalScrollIndicator={false}>
            {filteredCatalogue.map((track) => {
              const alreadyInPlaylist = existingSongIdsSet.has(track.id);
              const isSelected = selectedSongIds.includes(track.id);

              return (
                <TouchableOpacity
                  key={track.id}
                  style={[
                    styles.candidateRow,
                    isSelected && styles.candidateRowSelected,
                    alreadyInPlaylist && styles.candidateRowDisabled
                  ]}
                  onPress={() => handleToggleSelectSong(track.id)}
                  activeOpacity={alreadyInPlaylist ? 1 : 0.7}
                >
                  {/* Selection Checkbox */}
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxActive,
                      alreadyInPlaylist && styles.checkboxDisabled
                    ]}
                  >
                    <Text style={styles.checkboxText}>
                      {alreadyInPlaylist ? '✓' : isSelected ? '✓' : ''}
                    </Text>
                  </View>

                  <Image
                    source={{
                      uri:
                        track.artworkUrl ||
                        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'
                    }}
                    style={styles.candidateArtwork}
                  />

                  <View style={styles.candidateMeta}>
                    <Text style={styles.candidateTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.candidateArtist} numberOfLines={1}>
                      {track.composer || track.artist} {track.movieName ? `• ${track.movieName}` : ''}
                    </Text>
                  </View>

                  {alreadyInPlaylist ? (
                    <View style={styles.addedBadge}>
                      <Text style={styles.addedBadgeText}>In Playlist</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.quickAddBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        void handleQuickAddSong(track);
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.quickAddText}>＋</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}

            {filteredCatalogue.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptySubtitle}>
                  {songSearchQuery.trim()
                    ? `No songs found matching "${songSearchQuery}".`
                    : 'No songs available in this section.'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Action Bar for Multi-select */}
          {selectedSongIds.length > 0 && (
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={styles.addSelectedBtn}
                onPress={handleAddSelectedSongs}
                activeOpacity={0.8}
              >
                <Text style={styles.addSelectedBtnText}>
                  Add {selectedSongIds.length} Song{selectedSongIds.length === 1 ? '' : 's'} to Playlist
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  editBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600'
  },
  moreOptionsBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  moreOptionsText: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700'
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 110
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  heroArtwork: {
    width: 90,
    height: 90,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised
  },
  heroDetails: {
    flex: 1
  },
  playlistTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4
  },
  playlistDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    lineHeight: 16
  },
  playlistDescriptionPlaceholder: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginBottom: 6
  },
  playlistMeta: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.lg
  },
  primaryPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.full,
    gap: 6
  },
  playIcon: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700'
  },
  primaryPlayText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700'
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.full,
    gap: 6
  },
  secondaryActionIcon: {
    fontSize: 13,
    color: Colors.textPrimary
  },
  secondaryActionText: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  addSongsPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent
  },
  addSongsPillText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700'
  },
  disabledBtn: {
    opacity: 0.5
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5
  },
  listHeaderSub: {
    fontSize: 11,
    color: Colors.textTertiary
  },
  trackRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  trackCardContainer: {
    flex: 1
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 6
  },
  reorderBtn: {
    padding: 6,
    borderRadius: Radius.control,
    backgroundColor: Colors.surface
  },
  reorderBtnDisabled: {
    opacity: 0.2
  },
  reorderArrow: {
    fontSize: 10,
    color: Colors.textSecondary
  },
  removeBtn: {
    padding: 6,
    borderRadius: Radius.control,
    backgroundColor: Colors.surface
  },
  removeIcon: {
    fontSize: 11,
    color: Colors.error
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.md
  },
  actionBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full
  },
  actionBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13
  },
  deleteLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md
  },
  deleteLinkText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  optionsCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  optionsHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  optionsSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    gap: 12
  },
  optionIcon: {
    fontSize: 16
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  optionsCancelBtn: {
    marginTop: Spacing.md,
    paddingVertical: 10,
    alignItems: 'center'
  },
  optionsCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600'
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 8
  },
  modalInput: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14
  },
  artworkPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: Spacing.sm
  },
  presetThumbWrapper: {
    width: 48,
    height: 48,
    borderRadius: Radius.control,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  presetThumbSelected: {
    borderColor: Colors.accent
  },
  presetThumb: {
    width: '100%',
    height: '100%'
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: Spacing.md
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 14
  },
  modalSaveBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.full
  },
  modalSaveText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background
  },
  addSongsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  closeModalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  closeModalText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 12
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  searchIndicator: {
    position: 'absolute',
    right: 26
  },
  categoriesRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 8,
    marginBottom: Spacing.sm
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  categoryChipActive: {
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.accent
  },
  categoryChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500'
  },
  categoryChipTextActive: {
    color: Colors.accent,
    fontWeight: '700'
  },
  selectionHelpersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  selectionCountText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '500'
  },
  clearSelectionText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600'
  },
  addSongsList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 90
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  candidateRowSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)'
  },
  candidateRowDisabled: {
    opacity: 0.6
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  checkboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  checkboxDisabled: {
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.hairline
  },
  checkboxText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000'
  },
  candidateArtwork: {
    width: 44,
    height: 44,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised,
    marginRight: 10
  },
  candidateMeta: {
    flex: 1
  },
  candidateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  candidateArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2
  },
  addedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised
  },
  addedBadgeText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontWeight: '600'
  },
  quickAddBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickAddText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline
  },
  addSelectedBtn: {
    backgroundColor: Colors.accent,
    paddingVertical: 12,
    borderRadius: Radius.full,
    alignItems: 'center'
  },
  addSelectedBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700'
  }
});
