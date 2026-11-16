import { apiClient } from './client';
import { UniversalSearchResults } from './types';

export const searchApi = {
  searchUniversal: async (query: string, options?: {
    type?: 'movie' | 'song' | 'artist';
    language?: string;
    platform?: string;
  }): Promise<UniversalSearchResults> => {
    const res = await apiClient.get<UniversalSearchResults>('/api/search', {
      params: {
        q: query,
        type: options?.type,
        language: options?.language,
        platform: options?.platform || 'ALL'
      }
    });
    return res.data;
  },

  getSuggestions: async (query: string): Promise<Array<{ text: string; type: string; subtitle: string }>> => {
    const res = await apiClient.get<{ success: boolean; suggestions: Array<{ text: string; type: string; subtitle: string }> }>(
      '/api/search/suggestions',
      { params: { q: query } }
    );
    return res.data.suggestions;
  }
};
