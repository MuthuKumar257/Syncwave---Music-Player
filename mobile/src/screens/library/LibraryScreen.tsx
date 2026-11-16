import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLocalMusicStore } from '../../store/useLocalMusicStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useDownloadStore } from '../../store/useDownloadStore';
import { useAuthStore } from '../../store/useAuthStore';
import { TrackCard } from '../../components/cards/TrackCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const LibraryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { localTracks, isScanning, scanMessage, scanLocalTracks, clearMessage } = useLocalMusicStore();
  const {
    playlists,
    favoriteTracks,
    createPlaylist,
    deletePlaylist,
    initialize: initLibrary,
    syncFavorites,
    syncPlaylists
  } = useLibraryStore();
  const { downloadedTracks, initialize: initDownloads } = useDownloadStore();
  const { playTrack } = usePlayerStore();
  const { isAuthenticated } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'LOCAL' | 'PLAYLISTS' | 'FAVORITES' | 'DOWNLOADS'>('LOCAL');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');

  useEffect(() => {
    void initLibrary();
    void syncFavorites();
    void syncPlaylists();
    void initDownloads();
  }, [initLibrary, syncFavorites, syncPlaylists, initDownloads]);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  const handleCreatePlaylist = async () => {
    const trimmed = newPlaylistTitle.trim();
    if (!trimmed) {
      Alert.alert('Playlist Name', 'Please enter a name for the playlist.');
      return;
    }
    await createPlaylist(trimmed);
    setNewPlaylistTitle('');
    setIsCreatingPlaylist(false);
  };

  const handleDeletePlaylist = (playlistId: string, name: string) => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePlaylist(playlistId);
            if (selectedPlaylistId === playlistId) {
              setSelectedPlaylistId(null);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Library</Text>
        <Text style={styles.subtitle}>Imported local audio, playlists, and favorited songs</Text>

        {/* Tab Selector */}
        <View style={styles.tabBar}>
          {(['LOCAL', 'PLAYLISTS', 'FAVORITES', 'DOWNLOADS'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, isSelected && styles.activeTabButton]}
                onPress={() => {
                  setActiveTab(tab);
                  setSelectedPlaylistId(null);
                }}
              >
                <Text style={[styles.tabText, isSelected && styles.activeTabText]}>
                  {tab === 'LOCAL'
                    ? `Device (${localTracks.length})`
                    : tab === 'PLAYLISTS'
                      ? isAuthenticated
                        ? `Playlists (${playlists.length})`
                        : 'Playlists'
                      : tab === 'FAVORITES'
                        ? isAuthenticated
                          ? `Favorites (${favoriteTracks.length})`
                          : 'Favorites'
                        : isAuthenticated
                          ? `Downloads (${downloadedTracks.length})`
                          : 'Downloads'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'LOCAL' ? (
          <View>
            {/* Scan Device Button */}
            <TouchableOpacity
              style={styles.scanButton}
              onPress={scanLocalTracks}
              disabled={isScanning}
              activeOpacity={0.8}
            >
              {isScanning ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.scanButtonText}>Scan Storage For Audio Files</Text>
              )}
            </TouchableOpacity>

            {scanMessage ? (
              <View style={styles.messageBox}>
                <Text style={styles.messageText}>{scanMessage}</Text>
                <TouchableOpacity onPress={clearMessage}>
                  <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={styles.listHeader}>Local Tracks on Device ({localTracks.length})</Text>

            {localTracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                size="row"
                context="library"
                onPress={() => playTrack(track, localTracks)}
              />
            ))}
          </View>
        ) : activeTab === 'PLAYLISTS' ? (
          !isAuthenticated ? (
            <View style={styles.guestPromptCard}>
              <View style={styles.guestPromptIconCircle}>
                <Text style={styles.guestPromptIconText}>≡＋</Text>
              </View>
              <Text style={styles.guestPromptTitle}>Sign in for Playlists</Text>
              <Text style={styles.guestPromptSubtitle}>
                Create custom playlists, save tracks, and organize your music library across all your devices.
              </Text>
              <View style={styles.guestPromptActions}>
                <TouchableOpacity
                  style={styles.guestPromptPrimaryBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.guestPromptPrimaryBtnText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestPromptSecondaryBtn}
                  onPress={() => navigation.navigate('SignUp')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.guestPromptSecondaryBtnText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <View>
            {selectedPlaylist ? (
              <View>
                <TouchableOpacity
                  style={styles.backToPlaylistsBtn}
                  onPress={() => setSelectedPlaylistId(null)}
                >
                  <Text style={styles.backToPlaylistsText}>← Back to All Playlists</Text>
                </TouchableOpacity>

                <View style={styles.playlistDetailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playlistDetailTitle}>{selectedPlaylist.name}</Text>
                    <Text style={styles.playlistDetailMeta}>
                      {selectedPlaylist.tracks.length} track{selectedPlaylist.tracks.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  {selectedPlaylist.tracks.length > 0 && (
                    <TouchableOpacity
                      style={styles.playAllBtn}
                      onPress={() => playTrack(selectedPlaylist.tracks[0], selectedPlaylist.tracks)}
                    >
                      <Text style={styles.playAllBtnText}>▶ Play All</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {selectedPlaylist.tracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    size="row"
                    context="playlist"
                    playlistId={selectedPlaylist.id}
                    onPress={() => playTrack(track, selectedPlaylist.tracks)}
                  />
                ))}

                {selectedPlaylist.tracks.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>Empty Playlist</Text>
                    <Text style={styles.emptySubtitle}>
                      Use the 3-dot (⋮) menu on any song to save it to this playlist.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View>
                {/* Create Playlist Inline Row */}
                {isCreatingPlaylist ? (
                  <View style={styles.createPlaylistCard}>
                    <TextInput
                      style={styles.createInput}
                      placeholder="Playlist name..."
                      placeholderTextColor={Colors.textTertiary}
                      value={newPlaylistTitle}
                      onChangeText={setNewPlaylistTitle}
                      autoFocus
                    />
                    <View style={styles.createActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => {
                          setIsCreatingPlaylist(false);
                          setNewPlaylistTitle('');
                        }}
                      >
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmBtn} onPress={handleCreatePlaylist}>
                        <Text style={styles.confirmBtnText}>Create</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.createPlaylistTrigger}
                    onPress={() => setIsCreatingPlaylist(true)}
                  >
                    <Text style={styles.createPlaylistTriggerIcon}>＋</Text>
                    <Text style={styles.createPlaylistTriggerText}>Create New Playlist</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.playlistsGrid}>
                  {playlists.map((pl) => (
                    <TouchableOpacity
                      key={pl.id}
                      style={styles.playlistCard}
                      onPress={() => navigation.navigate('PlaylistDetail', { playlistId: pl.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.playlistCardHeader}>
                        <View style={styles.playlistCardIcon}>
                          <Text style={styles.playlistCardIconText}>♪</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeletePlaylist(pl.id, pl.name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.deletePlaylistText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.playlistCardName} numberOfLines={1}>
                        {pl.name}
                      </Text>
                      <Text style={styles.playlistCardCount}>
                        {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
          )
        ) : activeTab === 'FAVORITES' ? (
          !isAuthenticated ? (
            <View style={styles.guestPromptCard}>
              <View style={styles.guestPromptIconCircle}>
                <Text style={styles.guestPromptIconText}>♥</Text>
              </View>
              <Text style={styles.guestPromptTitle}>Sign in for Favorites</Text>
              <Text style={styles.guestPromptSubtitle}>
                Save your favorite tracks and access them anytime by signing in to your SyncWave account.
              </Text>
              <View style={styles.guestPromptActions}>
                <TouchableOpacity
                  style={styles.guestPromptPrimaryBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.guestPromptPrimaryBtnText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestPromptSecondaryBtn}
                  onPress={() => navigation.navigate('SignUp')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.guestPromptSecondaryBtnText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <View>
            {favoriteTracks.length > 0 && (
              <View style={styles.favoritesHeader}>
                <Text style={styles.listHeader}>Favorites ({favoriteTracks.length})</Text>
                <TouchableOpacity
                  style={styles.playAllBtn}
                  onPress={() => playTrack(favoriteTracks[0], favoriteTracks)}
                >
                  <Text style={styles.playAllBtnText}>▶ Play All</Text>
                </TouchableOpacity>
              </View>
            )}

            {favoriteTracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                size="row"
                context="liked"
                onPress={() => playTrack(track, favoriteTracks)}
              />
            ))}

            {favoriteTracks.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Favorite Tracks</Text>
                <Text style={styles.emptySubtitle}>
                  Tap the heart icon or ⋮ menu on any song to save it here for fast access.
                </Text>
              </View>
            )}
          </View>
          )
        ) : (
          !isAuthenticated ? (
            <View style={styles.guestPromptCard}>
              <View style={styles.guestPromptIconCircle}>
                <Text style={styles.guestPromptIconText}>⬇️</Text>
              </View>
              <Text style={styles.guestPromptTitle}>Sign in for Offline Downloads</Text>
              <Text style={styles.guestPromptSubtitle}>
                Download songs and listen anywhere without internet after signing in to your account.
              </Text>
              <View style={styles.guestPromptActions}>
                <TouchableOpacity
                  style={styles.guestPromptPrimaryBtn}
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.guestPromptPrimaryBtnText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestPromptSecondaryBtn}
                  onPress={() => navigation.navigate('SignUp')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.guestPromptSecondaryBtnText}>Create Account</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
          <View>
            {downloadedTracks.length > 0 && (
              <View style={styles.favoritesHeader}>
                <Text style={styles.listHeader}>Offline Downloads ({downloadedTracks.length})</Text>
                <TouchableOpacity
                  style={styles.playAllBtn}
                  onPress={() => playTrack(downloadedTracks[0], downloadedTracks)}
                >
                  <Text style={styles.playAllBtnText}>▶ Play All</Text>
                </TouchableOpacity>
              </View>
            )}

            {downloadedTracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                size="row"
                context="download"
                onPress={() => playTrack(track, downloadedTracks)}
              />
            ))}

            {downloadedTracks.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No Downloaded Songs</Text>
                <Text style={styles.emptySubtitle}>
                  Download songs from search, recommendations, or playlists to listen offline.
                </Text>
              </View>
            )}
          </View>
          )
        )}

        <View style={styles.footerSpacing} />
      </ScrollView>

      {/* Persistent Mini Player */}
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  tabBar: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.control,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.control - 2
  },
  activeTabButton: {
    backgroundColor: Colors.surfaceRaised
  },
  tabText: {
    ...Typography.body2,
    color: Colors.textTertiary
  },
  activeTabText: {
    color: Colors.textPrimary,
    fontWeight: '600'
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80
  },
  scanButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  scanButtonText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: '#000000'
  },
  messageBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.control,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  messageText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    flex: 1
  },
  dismissText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm
  },
  listHeader: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center'
  },
  emptyTitle: {
    ...Typography.title,
    color: Colors.textSecondary
  },
  emptySubtitle: {
    ...Typography.body2,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xl
  },
  footerSpacing: {
    height: 60
  },
  backToPlaylistsBtn: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm
  },
  backToPlaylistsText: {
    ...Typography.body2,
    color: Colors.accent,
    fontWeight: '600'
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    marginBottom: Spacing.md
  },
  playlistDetailTitle: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  playlistDetailMeta: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  playAllBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.control
  },
  playAllBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  createPlaylistCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.lg
  },
  createInput: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm
  },
  cancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6
  },
  cancelBtnText: {
    ...Typography.caption,
    color: Colors.textTertiary
  },
  confirmBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.control
  },
  confirmBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  createPlaylistTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.md
  },
  createPlaylistTriggerIcon: {
    fontSize: 18,
    color: Colors.accent,
    marginRight: Spacing.sm,
    fontWeight: '700'
  },
  createPlaylistTriggerText: {
    ...Typography.body2,
    fontWeight: '600',
    color: Colors.accent
  },
  playlistsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md
  },
  playlistCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.md
  },
  playlistCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm
  },
  playlistCardIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  playlistCardIconText: {
    fontSize: 14,
    color: Colors.textSecondary
  },
  deletePlaylistText: {
    fontSize: 14,
    color: Colors.textTertiary,
    padding: 4
  },
  playlistCardName: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: Colors.textPrimary
  },
  playlistCardCount: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  favoritesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md
  },
  guestPromptCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.lg
  },
  guestPromptIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md
  },
  guestPromptIconText: {
    fontSize: 24,
    color: Colors.accent
  },
  guestPromptTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs
  },
  guestPromptSubtitle: {
    ...Typography.body2,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md
  },
  guestPromptActions: {
    flexDirection: 'row',
    gap: Spacing.sm
  },
  guestPromptPrimaryBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestPromptPrimaryBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  guestPromptSecondaryBtn: {
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.control
  },
  guestPromptSecondaryBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textPrimary
  }
});
