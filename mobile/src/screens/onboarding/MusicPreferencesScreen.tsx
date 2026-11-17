import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useRecommendationStore } from '../../store/useRecommendationStore';
import { ArtistCard } from '../../components/cards/ArtistCard';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const MusicPreferencesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    selectedLanguages,
    selectedDirectors,
    selectedSingers,
    artistsCatalog,
    isLoadingArtists,
    fetchArtists,
    toggleDirector,
    toggleSinger,
    selectAllDirectors,
    clearAllDirectors,
    selectAllSingers,
    clearAllSingers,
    selectAllArtists,
    clearAllArtists,
    savePreferences,
    skipOnboarding
  } = useRecommendationStore();

  const [activeTab, setActiveTab] = useState<'ALL' | 'DIRECTORS' | 'SINGERS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    fetchArtists(selectedLanguages);
  }, [selectedLanguages]);

  // Filter by Tab and Search
  const displayedArtists = useMemo(() => {
    let list = artistsCatalog;

    if (activeTab === 'DIRECTORS') {
      list = list.filter((a) => a.role === 'DIRECTOR');
    } else if (activeTab === 'SINGERS') {
      list = list.filter((a) => a.role === 'SINGER');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.roleTitle && a.roleTitle.toLowerCase().includes(q)) ||
          a.knownFor.some((k) => k.toLowerCase().includes(q)) ||
          a.popularTracks.some((t) => t.toLowerCase().includes(q)) ||
          a.languages.some((l) => l.toLowerCase().includes(q))
      );
    }

    return viewAll || searchQuery ? list : list.slice(0, 16);
  }, [artistsCatalog, activeTab, searchQuery, viewAll]);

  const totalSelectedCount = selectedDirectors.length + selectedSingers.length;

  const handleFinish = async () => {
    await savePreferences();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('MainTabs');
    }
  };

  const handleSkip = async () => {
    await skipOnboarding();
    navigation.replace('MainTabs');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>Step 2 of 2 • Artists Preferences</Text>
        </View>
        <Text style={styles.title}>Artists Preferences</Text>
        <Text style={styles.subtitle}>
          Select your favourite Artists (Music Directors & Singers) on this screen
        </Text>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Filter Pills */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ALL' && styles.activeTabButton]}
          onPress={() => setActiveTab('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.activeTabText]}>
            All Artists
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'DIRECTORS' && styles.activeTabButton]}
          onPress={() => setActiveTab('DIRECTORS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'DIRECTORS' && styles.activeTabText]}>
            Music Directors ({selectedDirectors.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'SINGERS' && styles.activeTabButton]}
          onPress={() => setActiveTab('SINGERS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'SINGERS' && styles.activeTabText]}>
            Singers ({selectedSingers.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search and Bulk Actions Bar */}
      <View style={styles.controlsRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search artists, composers, movies..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.bulkButton}
          onPress={
            activeTab === 'DIRECTORS'
              ? selectAllDirectors
              : activeTab === 'SINGERS'
              ? selectAllSingers
              : selectAllArtists
          }
        >
          <Text style={styles.bulkText}>Select All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bulkButton}
          onPress={
            activeTab === 'DIRECTORS'
              ? clearAllDirectors
              : activeTab === 'SINGERS'
              ? clearAllSingers
              : clearAllArtists
          }
        >
          <Text style={styles.bulkTextClear}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Counter Badge */}
      <View style={styles.counterRow}>
        <Text style={styles.counterText}>
          Total Selected: {totalSelectedCount} Artists ({selectedDirectors.length} Directors • {selectedSingers.length} Singers)
        </Text>
      </View>

      {/* Artist Grid */}
      {isLoadingArtists ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="small" />
          <Text style={styles.loadingText}>Loading curated artist catalog with original photos...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.artistListContent}>
          <View style={styles.artistGrid}>
            {displayedArtists.map((artist) => {
              const isSelected =
                artist.role === 'DIRECTOR'
                  ? selectedDirectors.includes(artist.name)
                  : selectedSingers.includes(artist.name);

              return (
                <View key={artist.id} style={styles.artistItemWrapper}>
                  <ArtistCard
                    artist={artist}
                    isSelected={isSelected}
                    onPress={() =>
                      artist.role === 'DIRECTOR'
                        ? toggleDirector(artist.name)
                        : toggleSinger(artist.name)
                    }
                  />
                </View>
              );
            })}
          </View>

          {/* View All Toggle */}
          {searchQuery.trim().length === 0 && artistsCatalog.length > 16 && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => setViewAll(!viewAll)}
            >
              <Text style={styles.viewAllText}>
                {viewAll ? 'Show Less' : `View All (${artistsCatalog.length}) Artists`}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Fixed Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Languages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleFinish}
          activeOpacity={0.85}
        >
          <Text style={styles.continueText}>
            Continue to SyncWave ({totalSelectedCount})
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    position: 'relative'
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  stepText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600'
  },
  title: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2
  },
  skipButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    padding: Spacing.xs
  },
  skipText: {
    ...Typography.bodyMedium,
    color: Colors.textTertiary
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeTabButton: {
    backgroundColor: Colors.surfaceRaised
  },
  tabText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500'
  },
  activeTabText: {
    color: Colors.accent,
    fontWeight: '700'
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.xs
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: Colors.surface,
    borderRadius: Radius.control,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing.sm,
    color: Colors.textPrimary,
    fontSize: 12
  },
  bulkButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: Radius.control,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Colors.hairline
  },
  bulkText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600'
  },
  bulkTextClear: {
    ...Typography.caption,
    color: Colors.error,
    fontWeight: '600'
  },
  counterRow: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs
  },
  counterText: {
    ...Typography.caption,
    color: Colors.accent,
    fontWeight: '600'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textTertiary
  },
  artistListContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100
  },
  artistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  artistItemWrapper: {
    width: '48%',
    marginBottom: Spacing.xs
  },
  viewAllButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs
  },
  viewAllText: {
    ...Typography.bodyMedium,
    color: Colors.accent,
    fontWeight: '600'
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md
  },
  backButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md
  },
  backText: {
    ...Typography.bodyMedium,
    color: Colors.textSecondary
  },
  continueButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm
  },
  continueText: {
    ...Typography.bodyMedium,
    color: '#000000',
    fontWeight: '700'
  }
});
