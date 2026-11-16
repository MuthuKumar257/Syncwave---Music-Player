import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import songsRoutes from './routes/songs.routes';
import playlistsRoutes from './routes/playlists.routes';
import schedulesRoutes from './routes/schedules.routes';
import favoritesRoutes from './routes/favorites.routes';
import historyRoutes from './routes/history.routes';
import settingsRoutes from './routes/settings.routes';
import discoveryRoutes from './routes/discovery.routes';
import searchRoutes from './routes/search.routes';
import recommendationsRoutes from './routes/recommendations.routes';
import playbackSessionRoutes from './routes/playbackSession.routes';
import adminRoutes from './routes/admin.routes';
import { deepLinkRouter } from './routes/deepLink.routes';
import { SearchAggregatorService } from './services/search/searchAggregator.service';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { authRateLimiter, generalApiRateLimiter } from './middleware/rateLimiter';

export const app = express();

// Trust reverse proxies (Render, Cloudflare, etc.) to correctly resolve req.protocol and client IP
app.set('trust proxy', 1);

// Security Hardening (High H1): Disable Express fingerprinting header
app.disable('x-powered-by');

// Security Hardening (High H1): Comprehensive Security Headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(securityHeadersMiddleware);

// Security Hardening (High H2): Restricted and Configurable CORS Policy
const configuredFrontend = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  ...(configuredFrontend ? [configuredFrontend] : [])
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow mobile apps, curl, server-to-server or local dev requests with no origin header
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, '');
      if (allowedOrigins.has(cleanOrigin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy does not allow access from origin ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'Range', 'Accept']
  })
);

// Security Hardening (Medium M4): Enforce Request Body Size Limits to prevent DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health Check Endpoints (Excluded from strict rate limits)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SyncWave Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SyncWave Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Security Hardening (High H3): Rate Limiting
app.use('/api', generalApiRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/auth/otp', authRateLimiter);
app.use('/api/auth/refresh', authRateLimiter);

// App Deep Linking and Domain Verification
app.use(deepLinkRouter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/music', discoveryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/playback-session', playbackSessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', recommendationsRoutes);

// Direct Universal Search REST Routes
app.get('/api/movies/:id/soundtracks', async (req, res, next) => {
  try {
    const soundtrack = await SearchAggregatorService.getMovieSoundtrackById(req.params.id);
    if (!soundtrack) {
      res.status(404).json({ success: false, message: 'Soundtrack not found' });
      return;
    }
    res.json({ success: true, soundtrack });
  } catch (err) {
    next(err);
  }
});

app.get('/api/songs/:id/versions', async (req, res, next) => {
  try {
    const title = (req.query.title as string) || req.params.id.replace(/_/g, ' ');
    const artist = (req.query.artist as string) || '';
    const versions = await SearchAggregatorService.getSongVersions(title, artist);
    res.json({ success: true, songTitle: title, artist, versions });
  } catch (err) {
    next(err);
  }
});

app.get('/api/artists/:id/songs', async (req, res, next) => {
  try {
    const artistName = req.params.id.replace(/_/g, ' ');
    const results = await SearchAggregatorService.search(`${artistName} songs`, { type: 'SONG', limit: 20 });
    res.json({ success: true, artistName, songs: results.songs });
  } catch (err) {
    next(err);
  }
});

// Security Hardening (Medium M1): Centralized 404 Handler for Unmatched API Endpoints
app.use('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'API endpoint not found'
  });
});

// Security Hardening (Medium M1): Centralized Error Handling Middleware (No stack trace leak in prod)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const isProd = process.env.NODE_ENV === 'production';
  res.status(status).json({
    success: false,
    code: err?.code || 'INTERNAL_SERVER_ERROR',
    message: isProd ? 'An unexpected error occurred.' : (err?.message || 'Internal server error')
  });
});
