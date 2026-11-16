import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRecommendationStore } from '../src/store/useRecommendationStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('useRecommendationStore - Onboarding & Taste Profile', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
    useRecommendationStore.setState({
      selectedLanguages: ['Tamil'],
      selectedDirectors: ['A. R. Rahman'],
      selectedSingers: ['Sid Sriram'],
      artistsCatalog: [
        {
          id: 'dir_1',
          name: 'A. R. Rahman',
          role: 'DIRECTOR',
          languages: ['Tamil'],
          imageUrl: '',
          knownFor: ['Roja', 'Dil Se'],
          popularTracks: []
        },
        {
          id: 'dir_2',
          name: 'Anirudh Ravichander',
          role: 'DIRECTOR',
          languages: ['Tamil'],
          imageUrl: '',
          knownFor: ['Vikram', 'Master'],
          popularTracks: []
        },
        {
          id: 'sing_1',
          name: 'Sid Sriram',
          role: 'SINGER',
          languages: ['Tamil'],
          imageUrl: '',
          knownFor: ['Kannaana Kanney'],
          popularTracks: []
        },
        {
          id: 'sing_2',
          name: 'S. P. Balasubrahmanyam',
          role: 'SINGER',
          languages: ['Tamil'],
          imageUrl: '',
          knownFor: ['Thalapathi'],
          popularTracks: []
        }
      ],
      hasCompletedOnboarding: false,
      feed: null,
      preferences: null
    });
  });

  it('toggles language selection accurately', () => {
    const store = useRecommendationStore.getState();
    expect(store.selectedLanguages).toContain('Tamil');

    // Add Hindi
    store.toggleLanguage('Hindi');
    expect(useRecommendationStore.getState().selectedLanguages).toContain('Hindi');
    expect(useRecommendationStore.getState().selectedLanguages).toContain('Tamil');

    // Remove Tamil
    store.toggleLanguage('Tamil');
    expect(useRecommendationStore.getState().selectedLanguages).not.toContain('Tamil');
    expect(useRecommendationStore.getState().selectedLanguages).toContain('Hindi');
  });

  it('preserves director and singer selections simultaneously on the single preferences screen', () => {
    const store = useRecommendationStore.getState();

    // Toggle another director
    store.toggleDirector('Anirudh Ravichander');
    // Toggle another singer
    store.toggleSinger('S. P. Balasubrahmanyam');

    const state = useRecommendationStore.getState();
    expect(state.selectedDirectors).toEqual(['A. R. Rahman', 'Anirudh Ravichander']);
    expect(state.selectedSingers).toEqual(['Sid Sriram', 'S. P. Balasubrahmanyam']);

    // Toggling director does NOT mutate singers
    store.toggleDirector('A. R. Rahman');
    const updatedState = useRecommendationStore.getState();
    expect(updatedState.selectedDirectors).toEqual(['Anirudh Ravichander']);
    expect(updatedState.selectedSingers).toEqual(['Sid Sriram', 'S. P. Balasubrahmanyam']);
  });

  it('supports selectAll and clearAll for directors and singers separately', () => {
    const store = useRecommendationStore.getState();

    // Select all directors
    store.selectAllDirectors();
    expect(useRecommendationStore.getState().selectedDirectors).toEqual([
      'A. R. Rahman',
      'Anirudh Ravichander'
    ]);
    // Singers unaffected
    expect(useRecommendationStore.getState().selectedSingers).toEqual(['Sid Sriram']);

    // Clear all directors
    store.clearAllDirectors();
    expect(useRecommendationStore.getState().selectedDirectors).toEqual([]);
    expect(useRecommendationStore.getState().selectedSingers).toEqual(['Sid Sriram']);

    // Select all singers
    store.selectAllSingers();
    expect(useRecommendationStore.getState().selectedSingers).toEqual([
      'Sid Sriram',
      'S. P. Balasubrahmanyam'
    ]);

    // Clear all singers
    store.clearAllSingers();
    expect(useRecommendationStore.getState().selectedSingers).toEqual([]);
  });

  it('marks onboarding completed when skipOnboarding is triggered', async () => {
    const store = useRecommendationStore.getState();
    await store.skipOnboarding();

    expect(useRecommendationStore.getState().hasCompletedOnboarding).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@syncwave_onboarding_completed_v1',
      'true'
    );
  });

  it('resets onboarding state when resetPreferences is invoked', async () => {
    const store = useRecommendationStore.getState();
    useRecommendationStore.setState({ hasCompletedOnboarding: true });

    await store.resetPreferences();
    expect(useRecommendationStore.getState().hasCompletedOnboarding).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      '@syncwave_onboarding_completed_v1'
    );
  });
});
