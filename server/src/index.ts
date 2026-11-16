import 'dotenv/config';
import { app } from './app';

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
