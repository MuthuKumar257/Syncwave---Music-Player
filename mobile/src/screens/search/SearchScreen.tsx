import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useSearchStore } from '../../store/useSearchStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { TrackCard } from '../../components/cards/TrackCard';
import { MovieCard } from '../../components/cards/MovieCard';
import { MiniPlayer } from '../../components/player/MiniPlayer';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing, Radius } from '../../theme/spacing';

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    query,
    results,
    suggestions,
    recentSearches,
    selectedPlatform,
    isSearching,
    setQuery,
    setSelectedPlatform,
    performSearch,
    clearResults
  } = useSearchStore();

  const { playTrack } = usePlayerStore();
  const [filterType, setFilterType] = useState<'ALL' | 'MOVIES' | 'SONGS'>('ALL');

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by theme (e.g. love songs, melody), movie, artist..."
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => performSearch()}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={clearResults} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Quick Theme Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themePills}>
          {['Love Songs', 'Melody Songs', 'Party Songs', 'Workout Songs', 'Sad Songs', 'Rain Songs'].map((theme) => (
            <TouchableOpacity
              key={theme}
              style={styles.themePill}
              onPress={() => {
                setQuery(theme);
                performSearch(theme);
              }}
            >
              <Text style={styles.themeText}>{theme}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Content Area */}
      {isSearching ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.accent} size="small" />
          <Text style={styles.loadingText}>Searching universal movie & song catalog...</Text>
        </View>
      ) : suggestions.length > 0 && query.length > 0 && !results ? (
        /* Instant Suggestions List */
        <ScrollView style={styles.suggestionsContainer}>
          <Text style={styles.sectionLabel}>Suggestions</Text>
          {suggestions.map((sug, idx) => (
            <TouchableOpacity
              key={`${sug.text}_${idx}`}
              style={styles.suggestionRow}
              onPress={() => {
                setQuery(sug.text);
                performSearch(sug.text);
              }}
            >
              <Text style={styles.suggestionText}>{sug.text}</Text>
              <Text style={styles.suggestionSubtitle}>
                {sug.type} • {sug.subtitle}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : results ? (
        /* Search Results */
        <ScrollView contentContainerStyle={styles.resultsContent}>
          {/* Quick Category Toggle: Movies or Songs */}
          <View style={styles.typeFilterRow}>
            <TouchableOpacity
              style={[styles.typeButton, filterType === 'ALL' && styles.activeTypeButton]}
              onPress={() => setFilterType('ALL')}
            >
              <Text style={[styles.typeText, filterType === 'ALL' && styles.activeTypeText]}>
                All ({results.totalResults})
              </Text>
            </TouchableOpacity>

            {results.movies.length > 0 && (
              <TouchableOpacity
                style={[styles.typeButton, filterType === 'MOVIES' && styles.activeTypeButton]}
                onPress={() => setFilterType('MOVIES')}
              >
                <Text style={[styles.typeText, filterType === 'MOVIES' && styles.activeTypeText]}>
                  Movies ({results.movies.length})
                </Text>
              </TouchableOpacity>
            )}

            {results.songs.length > 0 && (
              <TouchableOpacity
                style={[styles.typeButton, filterType === 'SONGS' && styles.activeTypeButton]}
                onPress={() => setFilterType('SONGS')}
              >
                <Text style={[styles.typeText, filterType === 'SONGS' && styles.activeTypeText]}>
                  Songs ({results.songs.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Theme Banner */}
          {results.theme && (
            <View style={styles.themeBanner}>
              <View style={styles.themeBadge}>
                <Text style={styles.themeBadgeText}>THEME</Text>
              </View>
              <Text style={styles.themeName}>{results.theme.name}</Text>
              <Text style={styles.themeDesc}>{results.theme.description} • {results.theme.songCount} songs</Text>
            </View>
          )}

          {/* Movie Soundtracks Grouping */}
          {(filterType === 'ALL' || filterType === 'MOVIES') && results.movies.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Movie Soundtracks</Text>
              {results.movies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onPressMovie={() => navigation.navigate('MovieDetail', { movie })}
                  onTrackPress={(track) => playTrack(track, movie.tracks)}
                />
              ))}
            </View>
          )}

          {/* Songs List */}
          {(filterType === 'ALL' || filterType === 'SONGS') && results.songs.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Matching Songs</Text>
              {results.songs.map((song) => (
                <TrackCard key={song.id} track={song} size="row" />
              ))}
            </View>
          )}

          {results.totalResults === 0 && (
            <View style={styles.emptyResults}>
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptySubtitle}>
                Try searching for another movie, composer (e.g. A. R. Rahman), singer, or song title.
              </Text>
            </View>
          )}

          <View style={styles.footerSpacing} />
        </ScrollView>
      ) : (
        /* Recent Searches and Suggested Starters */
        <ScrollView contentContainerStyle={styles.recentContent}>
          {recentSearches.length > 0 && (
            <View style={styles.recentSection}>
              <Text style={styles.sectionLabel}>Recent Searches</Text>
              <View style={styles.recentTags}>
                {recentSearches.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.recentTag}
                    onPress={() => {
                      setQuery(item);
                      performSearch(item);
                    }}
                  >
                    <Text style={styles.recentTagText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.starterSection}>
            <Text style={styles.sectionLabel}>Try Searching For</Text>
            {['Vaaranam Aayiram', 'Leo', 'Nenjukkul Peidhidum', 'Anirudh Ravichander', 'Arijit Singh'].map((term) => (
              <TouchableOpacity
                key={term}
                style={styles.starterItem}
                onPress={() => {
                  setQuery(term);
                  performSearch(term);
                }}
              >
                <Text style={styles.starterText}>🔍 {term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

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
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    height: 44
  },
  searchIcon: {
    fontSize: 14,
    marginRight: Spacing.sm
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    ...Typography.body
  },
  clearIcon: {
    fontSize: 14,
    color: Colors.textTertiary,
    padding: Spacing.xs
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.sm
  },
  suggestionsContainer: {
    padding: Spacing.xl
  },
  sectionLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm
  },
  suggestionRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  suggestionText: {
    ...Typography.bodyMedium,
    color: Colors.textPrimary
  },
  suggestionSubtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2
  },
  resultsContent: {
    padding: Spacing.xl,
    paddingBottom: 80
  },
  typeFilterRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md
  },
  typeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.tag,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginRight: Spacing.sm
  },
  activeTypeButton: {
    backgroundColor: Colors.surfaceRaised,
    borderColor: Colors.accent
  },
  typeText: {
    ...Typography.caption,
    color: Colors.textTertiary
  },
  activeTypeText: {
    color: Colors.accent,
    fontWeight: '600'
  },
  resultSection: {
    marginBottom: Spacing.lg
  },
  resultSectionTitle: {
    ...Typography.title,
    color: Colors.textPrimary,
    marginBottom: Spacing.md
  },
  emptyResults: {
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
  recentContent: {
    padding: Spacing.xl
  },
  recentSection: {
    marginBottom: Spacing.xl
  },
  recentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  recentTag: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm
  },
  recentTagText: {
    ...Typography.body2,
    color: Colors.textSecondary
  },
  starterSection: {},
  starterItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline
  },
  starterText: {
    ...Typography.body2,
    color: Colors.textSecondary
  },
  footerSpacing: {
    height: 60
  },
  themePills: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.xs
  },
  themePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginRight: Spacing.xs
  },
  themeText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '500'
  },
  themeBanner: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.md,
    marginBottom: Spacing.md
  },
  themeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4
  },
  themeBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.accent
  },
  themeName: {
    ...Typography.h2,
    color: Colors.textPrimary
  },
  themeDesc: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2
  }
});
