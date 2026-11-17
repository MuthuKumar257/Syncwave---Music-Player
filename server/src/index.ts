import 'dotenv/config';
import { app } from './app';

// Validate production environment variables on startup
if (process.env.NODE_ENV === 'production') {
  const missingVars: string[] = [];
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === 'syncwave-super-secret-jwt-key-2026') {
    missingVars.push('JWT_SECRET (must be configured to a cryptographically strong secret)');
  }
  if (!process.env.SUPABASE_URL && !process.env.SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[SyncWave Backend] Warning: SUPABASE_URL / keys not configured. Playback history will run on in-memory storage.');
  }
  if (missingVars.length > 0 && process.env.STRICT_SECURITY === 'true') {
    console.error('[SyncWave Backend] Startup halted due to missing production environment variables:', missingVars);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  console.log(`[SyncWave Backend] Server running on http://localhost:${PORT}`);
  console.log(`[SyncWave Backend] Health check: http://localhost:${PORT}/api/health`);
});

// Security & Reliability Hardening (Medium M2): Graceful Shutdown Handlers
function gracefulShutdown(signal: string) {
  console.log(`[SyncWave Backend] Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    console.log('[SyncWave Backend] HTTP server closed cleanly.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds if connections hang
  setTimeout(() => {
    console.error('[SyncWave Backend] Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason) => {
  console.error('[SyncWave Backend] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SyncWave Backend] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});
