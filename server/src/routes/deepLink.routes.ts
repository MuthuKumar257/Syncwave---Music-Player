import { Router, Request, Response } from 'express';
import { RecommendationEngineService } from '../services/recommendation/recommendationEngine.service';
import { syncStore } from '../db/store';

export const deepLinkRouter = Router();

/**
 * Android App Links Domain Verification Specification
 * Serves /.well-known/assetlinks.json
 */
deepLinkRouter.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.syncwave.music',
        sha256_cert_fingerprints: [
          // Developer debug keystore fingerprint
          '12:82:0B:67:4E:6C:1B:D4:8B:C4:ED:0D:37:C3:61:1C:91:A6:94:14:D8:86:78:F8:CB:3E:0B:8E:AB:4B:81:38',
          // Standard Android debug keystore default
          '14:6D:E9:7D:0C:5E:EA:71:1A:E4:E3:76:7F:4D:45:9B:F7:BA:7D:4F:92:BA:2C:D6:7A:B6:EB:85:4E:9F:58:22',
          // Production release keystore fingerprint
          'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'
        ]
      }
    }
  ]);
});

/**
 * iOS Universal Links Domain Verification Specification
 * Serves /.well-known/apple-app-site-association and /apple-app-site-association
 */
const appleAppSiteAssociation = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'TEAM_SYNCWAVE_ID.com.syncwave.music',
        paths: ['/song/*', '/artist/*', '/playlist/*'],
        components: [
          {
            '/': '/song/*',
            comment: 'Matches any shared song link'
          },
          {
            '/': '/artist/*',
            comment: 'Matches any shared artist link'
          },
          {
            '/': '/playlist/*',
            comment: 'Matches any shared playlist link'
          }
        ]
      }
    ]
  },
  webcredentials: {
    apps: ['TEAM_SYNCWAVE_ID.com.syncwave.music']
  }
};

deepLinkRouter.get('/.well-known/apple-app-site-association', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(appleAppSiteAssociation);
});

deepLinkRouter.get('/apple-app-site-association', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(appleAppSiteAssociation);
});

/**
 * Public Share & Metadata Endpoint for Shared Songs
 * GET /api/share/song/:id
 */
deepLinkRouter.get('/api/share/song/:id', (req: Request, res: Response): void => {
  const songId = req.params.id?.trim();
  if (!songId) {
    res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Invalid song ID provided' });
    return;
  }

  // Look in syncStore
  const storeSong = syncStore.getSongById(songId);
  // Look in recommendation master catalog
  const catalogTrack = RecommendationEngineService.findTrackById(songId);

  const matched = catalogTrack || (storeSong ? {
    id: storeSong.id,
    title: storeSong.title,
    artist: storeSong.artist,
    album: storeSong.album,
    movieName: storeSong.album,
    composer: storeSong.artist,
    durationMs: storeSong.durationMs,
    artworkUrl: storeSong.artworkUrl,
    sourcePlatform: storeSong.source,
    sourceUrl: storeSong.externalUrl || `https://syncwave.app/song/${encodeURIComponent(storeSong.id)}`,
    isPlayableDirectly: true
  } : null);

  if (!matched) {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Song not found or unavailable'
    });
    return;
  }

  const cleanId = encodeURIComponent(matched.id);
  const shareUrl = `https://syncwave.app/song/${cleanId}`;
  const shareMessage = `Listen to ${matched.title} by ${matched.artist} on SyncWave.\n\nListen here: ${shareUrl}`;

  res.json({
    success: true,
    data: {
      id: matched.id,
      title: matched.title,
      artist: matched.artist,
      composer: (matched as any).composer || matched.artist,
      singers: (matched as any).singers || [matched.artist],
      movieName: (matched as any).movieName || (matched as any).album || 'Single',
      durationMs: matched.durationMs,
      artworkUrl: matched.artworkUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
      videoId: (matched as any).videoId,
      sourceUrl: (matched as any).sourceUrl,
      language: (matched as any).language || 'Unknown',
      genre: (matched as any).genre || 'Music',
      mood: (matched as any).mood,
      isPlayableDirectly: Boolean((matched as any).videoId || matched.isPlayableDirectly),
      shareUrl,
      shareMessage,
      appLinks: {
        android: `syncwave://song/${cleanId}`,
        ios: `syncwave://song/${cleanId}`,
        universal: shareUrl,
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.syncwave.music',
        appStoreUrl: 'https://apps.apple.com/app/syncwave-music/id123456789'
      }
    }
  });
});
