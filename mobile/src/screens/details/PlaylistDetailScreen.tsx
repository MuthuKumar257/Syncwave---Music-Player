import React, { useState, useMemo } from 'react';
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
  Alert
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { Track } from '../../api/types';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLocalMusicStore } from '../../store/useLocalMusicStore';
import { TrackCard } from '../../components/cards/TrackCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
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
    deletePlaylist,
    favoriteTracks
  } = useLibraryStore();

  const { playTrack, setQueue, addTracksToQueue } = usePlayerStore();
  const { localTracks } = useLocalMusicStore();

  const playlist = playlists.find((p) => p.id === playlistId);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(playlist?.name || '');
  const [editDescription, setEditDescription] = useState(playlist?.description || '');
  const [selectedArtwork, setSelectedArtwork] = useState(playlist?.artworkUrl || ARTWORK_PRESETS[0]);

  const [isAddSongsModalOpen, setIsAddSongsModalOpen] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');

  // Total Duration Calculation
  const totalDurationStr = useMemo(() => {
    if (!playlist || playlist.tracks.length === 0) return '0 mins';
    const totalMs = playlist.tracks.reduce((acc, t) => acc + (t.durationMs || 0), 0);
    const totalMinutes = Math.floor(totalMs / 60000);
    if (totalMinutes >= 60) {
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hrs} hr ${mins} min${mins === 1 ? '' : 's'}`;
    }
    return `${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
  }, [playlist]);

  // Candidate tracks for adding to this playlist (from favorites and local library)
  const candidateTracks = useMemo(() => {
    const combined = [...favoriteTracks, ...localTracks];
    const existingIds = new Set(playlist?.trackIds || []);
    const available = combined.filter((t, idx, self) =>
      !existingIds.has(t.id) && self.findIndex((item) => item.id === t.id) === idx
    );

    if (!songSearchQuery.trim()) return available.slice(0, 30);
    const q = songSearchQuery.toLowerCase().trim();
    return available.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.composer && t.composer.toLowerCase().includes(q))
    );
  }, [favoriteTracks, localTracks, playlist?.trackIds, songSearchQuery]);

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

  // Play Entire Playlist
  const handlePlayAll = () => {
    if (playlist.tracks.length === 0) return;
    void playTrack(playlist.tracks[0], playlist.tracks);
  };

  // Shuffle Playlist
  const handleShufflePlay = () => {
    if (playlist.tracks.length === 0) return;
    const shuffled = [...playlist.tracks].sort(() => Math.random() - 0.5);
    void playTrack(shuffled[0], shuffled);
  };

  // Add All to Queue
  const handleAddAllToQueue = () => {
    if (playlist.tracks.length === 0) return;
    addTracksToQueue(playlist.tracks);
    Alert.alert('Queue Updated', `Added ${playlist.tracks.length} songs to queue.`);
  };

  // Save Edit Changes
  const handleSaveEdit = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Playlist name cannot be empty.');
      return;
    }
    await updatePlaylist(playlist.id, {
      name: trimmed,
      description: editDescription.trim(),
      artworkUrl: selectedArtwork
    });
    setIsEditModalOpen(false);
  };

  // Delete Playlist
  const handleDelete = () => {
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
        <TouchableOpacity
          onPress={() => {
            setEditName(playlist.name);
            setEditDescription(playlist.description || '');
            setSelectedArtwork(playlist.artworkUrl || ARTWORK_PRESETS[0]);
            setIsEditModalOpen(true);
          }}
          style={styles.editBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
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
            ) : null}
            <Text style={styles.playlistMeta}>
              {playlist.tracks.length} track{playlist.tracks.length === 1 ? '' : 's'} • {totalDurationStr}
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
            onPress={() => setIsAddSongsModalOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addSongsPillText}>＋ Add Songs</Text>
          </TouchableOpacity>
        </View>

        {/* Song List Header */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeaderTitle}>Tracks in Playlist ({playlist.tracks.length})</Text>
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
              >
                <Text style={styles.reorderArrow}>▼</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void removeTrackFromPlaylist(playlist.id, track.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.removeBtn}
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
              Add songs from your favorites or device storage to create your custom mix.
            </Text>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setIsAddSongsModalOpen(true)}
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

            <Text style={styles.fieldLabel}>Choose Artwork</Text>
            <View style={styles.artworkPresetsRow}>
              {ARTWORK_PRESETS.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedArtwork(url)}
                  style={[
                    styles.presetThumbWrapper,
                    selectedArtwork === url && styles.presetThumbSelected
                  ]}
                >
                  <Image source={{ uri: url }} style={styles.presetThumb} />
                </TouchableOpacity>
              ))}
            </View>

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

      {/* Add Songs Modal */}
      <Modal visible={isAddSongsModalOpen} transparent animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.addSongsHeader}>
            <Text style={styles.modalTitle}>Add Songs to Playlist</Text>
            <TouchableOpacity
              onPress={() => setIsAddSongsModalOpen(false)}
              style={styles.closeModalBtn}
            >
              <Text style={styles.closeModalText}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search available songs..."
              placeholderTextColor={Colors.textTertiary}
              value={songSearchQuery}
              onChangeText={setSongSearchQuery}
              autoFocus
            />
          </View>

          <ScrollView contentContainerStyle={styles.addSongsList}>
            {candidateTracks.map((track) => (
              <View key={track.id} style={styles.candidateRow}>
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
                    {track.composer || track.artist}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addTrackBtn}
                  onPress={async () => {
                    await addTrackToPlaylist(playlist.id, track);
                  }}
                >
                  <Text style={styles.addTrackBtnText}>＋ Add</Text>
                </TouchableOpacity>
              </View>
            ))}

            {candidateTracks.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptySubtitle}>
                  {songSearchQuery.trim()
                    ? 'No songs matching your search.'
                    : 'All your favorite and local songs are already added to this playlist.'}
                </Text>
              </View>
            )}
          </ScrollView>
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
    marginBottom: Spacing.sm
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5
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
    color: Colors.textPrimary,
    marginBottom: Spacing.md
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
    marginBottom: Spacing.lg
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
    backgroundColor: Colors.accent,
    borderRadius: Radius.full
  },
  closeModalText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12
  },
  searchBox: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14
  },
  addSongsList: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
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
  addTrackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.accent
  },
  addTrackBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700'
  }
});
