import { Router, Request, Response } from 'express';
import { syncStore } from '../db/store';
import { musicDiscoveryService } from '../services/musicDiscovery.service';

const router = Router();

router.get('/search', async (req: Request, res: Response): Promise<void> => {
  const query = (req.query.q as string) || '';
  const platform = (req.query.platform as string) || 'ALL';

  const localMatches = syncStore.searchSongs(query);

  let onlineMatches = [];
  if (query.trim()) {
    onlineMatches = await musicDiscoveryService.searchUnified(query, platform);
  } else {
    // Curated default recommendations
    onlineMatches = [
      {
        id: 'ext_sp_1',
        title: 'Deep Focus Chill Beats',
        artist: 'Lofi Study Routine',
        album: 'Concentration Flow',
        durationMs: 184000,
        artworkUrl:
          'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=500&auto=format&fit=crop&q=60',
        source: 'SPOTIFY',
        externalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS'
      },
      {
        id: 'ext_yt_1',
        title: 'Cyberpunk Synthwave Mix',
        artist: 'Retro Horizon',
        album: 'Neon Drive 2026',
        durationMs: 255000,
        artworkUrl:
          'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=60',
        source: 'YOUTUBE',
        externalUrl: 'https://music.youtube.com'
      },
      {
        id: 'ext_sp_2',
        title: 'Power Cardio Workout',
        artist: 'Velocity Sound',
        album: 'Hyper Routine',
        durationMs: 210000,
        artworkUrl:
          'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60',
        source: 'SPOTIFY',
        externalUrl: 'https://open.spotify.com'
      }
    ];
  }

  res.json({
    success: true,
    query,
    localMatches: platform === 'ALL' || platform === 'LOCAL' ? localMatches : [],
    onlineMatches
  });
});

router.get('/discover', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    platforms: [
      { id: 'spotify', name: 'Spotify', status: 'Available' },
      { id: 'youtube', name: 'YouTube Music', status: 'Available' },
      { id: 'applemusic', name: 'Apple Music', status: 'Available' }
    ],
    featured: [
      { id: 'feat_1', title: 'Deep Focus Chill Beats', source: 'SPOTIFY' },
      { id: 'feat_2', title: 'Cyberpunk Synthwave Mix', source: 'YOUTUBE' }
    ]
  });
});

router.get('/integrations', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    integrations: [
      {
        platform: 'Spotify',
        status: 'Supported (Authorized Playback & Links)',
        supportsDirectAudioExtraction: false,
        attributionRequired: true
      },
      {
        platform: 'YouTube Music',
        status: 'Supported (Official Embed & Discovery)',
        supportsDirectAudioExtraction: false,
        attributionRequired: true
      },
      {
        platform: 'Apple Music',
        status: 'Supported (MusicKit Scaffolding)',
        supportsDirectAudioExtraction: false,
        attributionRequired: true
      }
    ]
  });
});

export default router;
