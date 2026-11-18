import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Track } from '../../api/types';
import { useLibraryStore } from '../../store/useLibraryStore';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

interface SaveToPlaylistModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
}

export const SaveToPlaylistModal: React.FC<SaveToPlaylistModalProps> = ({
  visible,
  track,
  onClose
}) => {
  const { playlists, createPlaylist, addTrackToPlaylist, removeTrackFromPlaylist, isInPlaylist } =
    useLibraryStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  if (!track) return null;

  const handleToggle = async (playlistId: string, playlistName: string) => {
    const inPlaylist = isInPlaylist(playlistId, track.id);
    if (inPlaylist) {
      await removeTrackFromPlaylist(playlistId, track.id);
    } else {
      await addTrackToPlaylist(playlistId, track);
    }
  };

  const handleCreate = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) {
      Alert.alert('Playlist Name', 'Please enter a name for the new playlist.');
      return;
    }
    const newPl = await createPlaylist(trimmed, [track]);
    setNewPlaylistName('');
    setIsCreating(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.modalCard}>
            {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Save to Playlist</Text>
              <Text style={styles.trackSubtitle} numberOfLines={1}>
                {track.title} • {track.artist}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* New Playlist inline form */}
          {isCreating ? (
            <View style={styles.createBox}>
              <TextInput
                style={styles.input}
                placeholder="Playlist name..."
                placeholderTextColor={Colors.textTertiary}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={styles.cancelCreateBtn}
                  onPress={() => {
                    setIsCreating(false);
                    setNewPlaylistName('');
                  }}
                >
                  <Text style={styles.cancelCreateText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmCreateBtn} onPress={handleCreate}>
                  <Text style={styles.confirmCreateText}>Create & Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addPlaylistBtn}
              onPress={() => setIsCreating(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addPlaylistIcon}>＋</Text>
              <Text style={styles.addPlaylistText}>New Playlist</Text>
            </TouchableOpacity>
          )}

          {/* Playlist list */}
          <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
            {playlists.map((pl) => {
              const checked = isInPlaylist(pl.id, track.id);
              return (
                <TouchableOpacity
                  key={pl.id}
                  style={[styles.playlistRow, checked && styles.playlistRowSelected]}
                  onPress={() => handleToggle(pl.id, pl.name)}
                  activeOpacity={0.7}
                >
                  <View style={styles.playlistIconBox}>
                    <Text style={styles.playlistFolderIcon}>♪</Text>
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>
                      {pl.name}
                    </Text>
                    <Text style={styles.playlistTracksCount}>
                      {pl.trackIds.length} tracks
                    </Text>
                  </View>
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}

            {playlists.length === 0 && !isCreating && (
              <Text style={styles.emptyText}>No playlists yet. Create one above!</Text>
            )}
          </ScrollView>

          {/* Done button */}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl
  },
  keyboardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '84%',
    backgroundColor: '#18181b',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a'
  },
  headerTitles: {
    flex: 1,
    marginRight: Spacing.sm
  },
  title: {
    ...Typography.bodyMedium,
    fontWeight: '700',
    color: '#ffffff'
  },
  trackSubtitle: {
    ...Typography.caption,
    color: '#a1a1aa',
    marginTop: 2
  },
  closeBtn: {
    fontSize: 16,
    color: '#a1a1aa',
    padding: 4
  },
  addPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a'
  },
  addPlaylistIcon: {
    fontSize: 16,
    color: Colors.accent,
    marginRight: Spacing.sm,
    fontWeight: '700'
  },
  addPlaylistText: {
    ...Typography.body2,
    fontWeight: '600',
    color: Colors.accent
  },
  createBox: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a'
  },
  input: {
    backgroundColor: '#27272a',
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46'
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm
  },
  cancelCreateBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.control
  },
  cancelCreateText: {
    ...Typography.caption,
    color: '#a1a1aa'
  },
  confirmCreateBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.control
  },
  confirmCreateText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#000000'
  },
  listContainer: {
    maxHeight: 240,
    marginTop: Spacing.xs
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.control,
    marginVertical: 2
  },
  playlistRowSelected: {
    backgroundColor: '#27272a'
  },
  playlistIconBox: {
    width: 32,
    height: 32,
    borderRadius: Radius.control,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm
  },
  playlistFolderIcon: {
    fontSize: 14,
    color: '#a1a1aa'
  },
  playlistInfo: {
    flex: 1
  },
  playlistName: {
    ...Typography.body2,
    fontWeight: '500',
    color: '#ffffff'
  },
  playlistTracksCount: {
    ...Typography.caption,
    fontSize: 11,
    color: '#a1a1aa'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#52525b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000'
  },
  emptyText: {
    ...Typography.caption,
    color: '#71717a',
    textAlign: 'center',
    paddingVertical: Spacing.lg
  },
  doneBtn: {
    backgroundColor: '#27272a',
    borderRadius: Radius.control,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md
  },
  doneBtnText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
    color: '#ffffff'
  }
});
