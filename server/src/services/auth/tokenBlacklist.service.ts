import crypto from 'crypto';

interface RevokedTokenEntry {
  tokenHash: string;
  expiresAtMs: number;
}

/**
 * TokenBlacklistService
 *
 * In-memory secure blacklist for revoked JWT tokens (logout, token refresh/rotation).
 * Stores cryptographic SHA-256 hashes of revoked tokens with automatic TTL eviction.
 */
export class TokenBlacklistService {
  private static revokedTokens = new Map<string, number>();
  private static cleanupInterval: NodeJS.Timeout | null = null;

  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Revoke a JWT token by storing its hash and expiration time.
   * If expiresAtSec is omitted, defaults to 30 days from now.
   */
  static revokeToken(token: string, expiresAtSec?: number): void {
    if (!token || typeof token !== 'string') return;
    const tokenHash = this.hashToken(token);
    const nowMs = Date.now();
    const expiresAtMs = expiresAtSec && expiresAtSec > 0
      ? expiresAtSec * 1000
      : nowMs + 30 * 24 * 60 * 60 * 1000;

    this.revokedTokens.set(tokenHash, expiresAtMs);
    this.ensureCleanupScheduled();
  }

  /**
   * Check whether a JWT token has been revoked.
   */
  static isTokenRevoked(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    const tokenHash = this.hashToken(token);
    const expiresAtMs = this.revokedTokens.get(tokenHash);

    if (!expiresAtMs) return false;

    // If the token's lifetime has passed, prune it and return false
    if (Date.now() > expiresAtMs) {
      this.revokedTokens.delete(tokenHash);
      return false;
    }

    return true;
  }

  /**
   * Remove expired entries from the blacklist map.
   */
  static pruneExpired(): void {
    const nowMs = Date.now();
    for (const [hash, expMs] of this.revokedTokens.entries()) {
      if (nowMs > expMs) {
        this.revokedTokens.delete(hash);
      }
    }
  }

  /**
   * Number of currently tracked revoked tokens.
   */
  static getRevokedCount(): number {
    this.pruneExpired();
    return this.revokedTokens.size;
  }

  /**
   * Reset store (useful for automated test isolation).
   */
  static resetForTesting(): void {
    this.revokedTokens.clear();
  }

  private static ensureCleanupScheduled(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.pruneExpired();
      }, 60 * 60 * 1000); // Hourly cleanup
      if (typeof this.cleanupInterval.unref === 'function') {
        this.cleanupInterval.unref();
      }
    }
  }
}
