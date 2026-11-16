import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface VerifiedGoogleProfile {
  sub: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

interface PendingOAuthState {
  state: string;
  codeVerifier: string;
  callbackUri: string;
  frontendOrigin: string;
  expiresAt: number;
}

interface GoogleJwk {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

export class GoogleOAuthService {
  private static jwksCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;
  private static pendingStates = new Map<string, PendingOAuthState>();

  private static cleanValue(raw?: string): string {
    const trimmed = (raw || '').trim();
    if (!trimmed || /^your-/i.test(trimmed)) return '';
    return trimmed;
  }

  static getClientId(): string {
    return this.cleanValue(process.env.GOOGLE_CLIENT_ID);
  }

  static getAndroidClientId(): string {
    return this.cleanValue(process.env.GOOGLE_ANDROID_CLIENT_ID);
  }

  static getClientSecret(): string {
    return this.cleanValue(process.env.GOOGLE_CLIENT_SECRET);
  }

  static getConfigStatus(): {
    redirectFlowEnabled: boolean;
    idTokenEnabled: boolean;
    clientId: string | null;
  } {
    const clientId = this.getClientId();
    const androidClientId = this.getAndroidClientId();
    const clientSecret = this.getClientSecret();
    return {
      redirectFlowEnabled: Boolean(clientId && clientSecret),
      idTokenEnabled: Boolean(clientId || androidClientId),
      clientId: clientId || null
    };
  }

  private static async getGoogleJwks(): Promise<GoogleJwk[]> {
    if (this.jwksCache && Date.now() < this.jwksCache.expiresAt) {
      return this.jwksCache.keys;
    }

    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', {
      signal: AbortSignal.timeout(6000)
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch Google JWKS (HTTP ${res.status})`);
    }

    const cacheControl = res.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const ttlMs = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;

    const data: any = await res.json();
    const keys = (data.keys || []) as GoogleJwk[];
    this.jwksCache = {
      keys,
      expiresAt: Date.now() + ttlMs
    };
    return keys;
  }

  static async verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleProfile> {
    const clientId = this.getClientId();
    const androidClientId = this.getAndroidClientId();
    const allowedAudiences = [clientId, androidClientId].filter(Boolean);
    if (allowedAudiences.length === 0) {
      throw new Error('GOOGLE_CLIENT_ID is not configured on the server.');
    }

    const decodedComplete = jwt.decode(idToken, { complete: true }) as {
      header?: { kid?: string; alg?: string };
    } | null;

    const kid = decodedComplete?.header?.kid;
    const alg = decodedComplete?.header?.alg;
    if (!kid || alg !== 'RS256') {
      throw new Error('Invalid Google ID token header.');
    }

    const keys = await this.getGoogleJwks();
    const jwk = keys.find((k) => k.kid === kid && k.kty === 'RSA');
    if (!jwk) {
      throw new Error('Unable to match signing key in Google JWKS.');
    }

    const publicKey = crypto.createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e
      },
      format: 'jwk'
    });

    const payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience:
        allowedAudiences.length === 1
          ? allowedAudiences[0]
          : (allowedAudiences as [string, ...string[]])
    }) as jwt.JwtPayload & {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
      sub?: string;
    };

    if (!payload.sub || !payload.email) {
      throw new Error('Google ID token missing subject or email claims.');
    }

    if (!payload.email_verified) {
      throw new Error('Google account email is not verified.');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase().trim(),
      displayName: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture
    };
  }

  private static pruneStates(): void {
    const now = Date.now();
    for (const [k, v] of this.pendingStates.entries()) {
      if (v.expiresAt <= now) {
        this.pendingStates.delete(k);
      }
    }
  }

  static createAuthorizationUrl(opts: {
    backendCallbackUri: string;
    frontendOrigin: string;
  }): string {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in server/.env');
    }

    this.pruneStates();

    const state = crypto.randomBytes(24).toString('base64url');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    this.pendingStates.set(state, {
      state,
      codeVerifier,
      callbackUri: opts.backendCallbackUri,
      frontendOrigin: opts.frontendOrigin,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: opts.backendCallbackUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'online',
      prompt: 'select_account'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  static async exchangeAuthorizationCode(
    code: string,
    state: string
  ): Promise<{ profile: VerifiedGoogleProfile; frontendOrigin: string }> {
    this.pruneStates();
    const pending = this.pendingStates.get(state);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new Error('OAuth state expired or invalid.');
    }
    this.pendingStates.delete(state);

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth client credentials missing.');
    }

    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: pending.callbackUri,
      grant_type: 'authorization_code',
      code_verifier: pending.codeVerifier
    });

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text().catch(() => '');
      throw new Error(`Google token exchange failed (${tokenRes.status}): ${errTxt}`);
    }

    const tokens: any = await tokenRes.json();
    if (!tokens.id_token) {
      throw new Error('Google token response missing id_token.');
    }

    const profile = await this.verifyGoogleIdToken(tokens.id_token);
    return {
      profile,
      frontendOrigin: pending.frontendOrigin
    };
  }
}
