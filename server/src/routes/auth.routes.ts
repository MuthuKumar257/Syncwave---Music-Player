import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { syncStore, User } from '../db/store';
import { JWT_SECRET, requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { OtpMailerService } from '../services/auth/otpMailer.service';
import { OtpChallengeService } from '../services/auth/otpChallenge.service';
import { GoogleOAuthService } from '../services/auth/googleOAuth.service';
import { WelcomeEmailService } from '../services/auth/welcomeEmail.service';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(1, 'Name is required').max(80).default('SyncWave User'),
  verifyWithOtp: z.boolean().optional()
});

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

const verifyOtpSchema = z.object({
  challengeId: z.string().uuid('Invalid challenge session'),
  email: z.string().email(),
  otp: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits')
});

const resendOtpSchema = z.object({
  challengeId: z.string().uuid('Invalid challenge session'),
  email: z.string().email()
});

const googleCredentialSchema = z.object({
  credential: z.string().min(20, 'Valid Google ID token credential is required')
});

function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider || 'EMAIL',
    emailVerified: Boolean(user.emailVerified),
    welcomeEmailSent: Boolean(user.welcomeEmailSent),
    welcomeEmailStatus: user.welcomeEmailStatus || 'PENDING',
    createdAt: user.createdAt
  };
}

function issueAuthToken(user: User): string {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function resolveAllowedFrontendOrigin(requestedOrigin?: string): string {
  const configured = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    ...(configured ? [configured] : [])
  ]);

  if (requestedOrigin && allowedOrigins.has(requestedOrigin.replace(/\/+$/, ''))) {
    return requestedOrigin.replace(/\/+$/, '');
  }
  return configured || 'http://localhost:3000';
}

function resolveBackendCallbackUri(req: Request): string {
  const explicit = process.env.GOOGLE_CALLBACK_URL?.trim();
  const host = (req.get('x-forwarded-host') || req.get('host') || '').trim();
  const isCloudHost = host && !host.includes('localhost') && !host.includes('127.0.0.1');

  // If server is deployed on cloud (e.g. onrender.com) and GOOGLE_CALLBACK_URL was accidentally left as localhost, prefer cloud URL
  if (explicit && (!isCloudHost || !explicit.includes('localhost'))) {
    return explicit;
  }

  const configuredBackend = process.env.BACKEND_URL?.trim().replace(/\/+$/, '');
  if (configuredBackend) {
    return `${configuredBackend}/api/auth/google/callback`;
  }

  if (isCloudHost) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    return `${proto}://${host}/api/auth/google/callback`;
  }

  if (explicit) return explicit;

  const rawHost = host || 'localhost:3001';
  // Normalize 127.0.0.1 to localhost for OAuth compatibility since Google Cloud Console credentials
  // typically authorize 'http://localhost:3001/api/auth/google/callback'
  const normalizedHost = rawHost.replace(/^127\.0\.0\.1/, 'localhost');
  return `${req.protocol}://${normalizedHost}/api/auth/google/callback`;
}

/**
 * GET /api/auth/providers
 * Exposes public authentication capabilities (never secrets)
 */
router.get('/providers', (_req: Request, res: Response): void => {
  const otpStatus = OtpMailerService.getDeliveryStatus();
  const googleStatus = GoogleOAuthService.getConfigStatus();

  res.json({
    success: true,
    google: {
      enabled: googleStatus.redirectFlowEnabled || googleStatus.idTokenEnabled,
      redirectFlowEnabled: googleStatus.redirectFlowEnabled,
      idTokenEnabled: googleStatus.idTokenEnabled,
      clientId: googleStatus.clientId
    },
    otp: {
      enabled: otpStatus.configured,
      provider: otpStatus.provider
    }
  });
});

/**
 * POST /api/auth/register
 * Production sign-up with bcrypt password hashing and optional email OTP verification step
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const { email, password, displayName, verifyWithOtp } = result.data;

  const existing = syncStore.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ success: false, message: 'An account with this email already exists' });
    return;
  }

  if (verifyWithOtp && !OtpMailerService.getDeliveryStatus().configured) {
    res.status(503).json({
      success: false,
      code: 'OTP_DELIVERY_NOT_CONFIGURED',
      message: 'Email OTP delivery is not configured on the server. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (or RESEND_API_KEY) in server/.env.'
    });
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = syncStore.createUser(email, passwordHash, displayName.trim(), {
    authProvider: 'EMAIL',
    emailVerified: !verifyWithOtp
  });

  if (verifyWithOtp) {
    const challenge = await OtpChallengeService.createAndSendChallenge({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      purpose: 'SIGNUP'
    });

    if (!challenge.delivery.delivered) {
      syncStore.deleteUser(user.id);
      res.status(challenge.delivery.reason === 'NOT_CONFIGURED' ? 503 : 502).json({
        success: false,
        code:
          challenge.delivery.reason === 'NOT_CONFIGURED'
            ? 'OTP_DELIVERY_NOT_CONFIGURED'
            : 'OTP_SEND_FAILED',
        message:
          challenge.delivery.error ||
          'Unable to send verification code email. Check server SMTP/Resend configuration.'
      });
      return;
    }

    res.status(201).json({
      success: true,
      otpRequired: true,
      challengeId: challenge.challengeId,
      maskedEmail: challenge.maskedEmail,
      expiresInSec: challenge.expiresInSec,
      resendAfterSec: challenge.resendAfterSec
    });
    return;
  }

  const token = issueAuthToken(user);

  // Asynchronously dispatch personalized welcome email upon account creation
  void WelcomeEmailService.sendWelcomeEmailOnFirstLogin(
    user,
    resolveAllowedFrontendOrigin(req.headers.origin as string)
  );

  res.status(201).json({
    success: true,
    token,
    user: serializeUser(user),
    settings: syncStore.getUserSettings(user.id)
  });
});

/**
 * POST /api/auth/login/initiate
 * Step 1 of Email + Password + OTP Login: verifies bcrypt hash & dispatches real 6-digit OTP email
 */
router.post('/login/initiate', async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const { email, password } = result.data;
  const user = syncStore.findUserByEmail(email);

  if (!user) {
    res.status(401).json({ success: false, message: 'Invalid email or password' });
    return;
  }

  if (user.authProvider === 'GOOGLE' && !user.passwordHash) {
    res.status(400).json({
      success: false,
      code: 'GOOGLE_ACCOUNT',
      message: 'This account is linked with Google Sign-In. Please click Continue with Google.'
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid email or password' });
    return;
  }

  const challenge = await OtpChallengeService.createAndSendChallenge({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    purpose: 'LOGIN'
  });

  if (!challenge.delivery.delivered) {
    const notConfigured = challenge.delivery.reason === 'NOT_CONFIGURED';
    res.status(notConfigured ? 503 : 502).json({
      success: false,
      code: notConfigured ? 'OTP_DELIVERY_NOT_CONFIGURED' : 'OTP_SEND_FAILED',
      message: notConfigured
        ? 'Email OTP delivery is not configured on the server. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (or RESEND_API_KEY) in server/.env to deliver verification codes.'
        : challenge.delivery.error || 'Failed to deliver OTP email.'
    });
    return;
  }

  res.json({
    success: true,
    otpRequired: true,
    challengeId: challenge.challengeId,
    maskedEmail: challenge.maskedEmail,
    expiresInSec: challenge.expiresInSec,
    resendAfterSec: challenge.resendAfterSec
  });
});

/**
 * POST /api/auth/login/verify-otp (alias: /api/auth/otp/verify)
 * Step 2: cryptographically verifies 6-digit OTP & issues SyncWave JWT
 */
const handleVerifyOtp = (req: Request, res: Response): void => {
  const result = verifyOtpSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const { challengeId, email, otp } = result.data;
  const verification = OtpChallengeService.verifyChallenge(challengeId, email, otp);

  if (!verification.ok) {
    res.status(verification.status).json({
      success: false,
      code: verification.code,
      attemptsRemaining: verification.attemptsRemaining,
      message: verification.message
    });
    return;
  }

  const user = syncStore.findUserById(verification.userId);
  if (!user) {
    res.status(404).json({ success: false, message: 'User account not found' });
    return;
  }

  syncStore.markEmailVerified(user.id);
  const token = issueAuthToken(user);

  // If this user has not received their welcome email yet (e.g. newly verified signup), dispatch it
  if (!user.welcomeEmailSent) {
    void WelcomeEmailService.sendWelcomeEmailOnFirstLogin(
      user,
      resolveAllowedFrontendOrigin(req.headers.origin as string)
    );
  }

  res.json({
    success: true,
    token,
    user: serializeUser(user),
    settings: syncStore.getUserSettings(user.id)
  });
};

router.post('/login/verify-otp', handleVerifyOtp);
router.post('/otp/verify', handleVerifyOtp);

/**
 * POST /api/auth/otp/resend
 * Resends a fresh 6-digit OTP email respecting cooldown
 */
router.post('/otp/resend', async (req: Request, res: Response): Promise<void> => {
  const result = resendOtpSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const resent = await OtpChallengeService.resendChallenge(result.data.challengeId, result.data.email);
  if (!resent.ok) {
    const status = resent.code === 'COOLDOWN' ? 429 : resent.code === 'NOT_FOUND' ? 404 : 502;
    res.status(status).json({
      success: false,
      code: resent.code,
      retryAfterSec: resent.retryAfterSec,
      message: resent.message
    });
    return;
  }

  res.json({
    success: true,
    expiresInSec: resent.expiresInSec,
    resendAfterSec: resent.resendAfterSec,
    message: 'A new 6-digit verification code has been sent to your email.'
  });
});

/**
 * POST /api/auth/login
 * Direct credential verification endpoint (retained for API compatibility)
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const { email, password } = result.data;
  const user = syncStore.findUserByEmail(email);
  if (!user || !user.passwordHash) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
    return;
  }

  const token = issueAuthToken(user);
  res.json({
    success: true,
    token,
    user: serializeUser(user),
    settings: syncStore.getUserSettings(user.id)
  });
});

/**
 * POST /api/auth/google
 * Production Google Identity ID Token verification against live Google JWKS keys
 */
router.post('/google', async (req: Request, res: Response): Promise<void> => {
  const result = googleCredentialSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  if (!GoogleOAuthService.getConfigStatus().idTokenEnabled) {
    res.status(503).json({
      success: false,
      code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
      message: 'Google Sign-In is not configured on the server. Set GOOGLE_CLIENT_ID in server/.env.'
    });
    return;
  }

  try {
    const profile = await GoogleOAuthService.verifyGoogleIdToken(result.data.credential);
    const { user, isNewUser } = syncStore.findOrCreateGoogleUser(profile);
    const token = issueAuthToken(user);

    // Asynchronously dispatch welcome email for first-time Google sign-up without blocking auth response
    if (isNewUser) {
      void WelcomeEmailService.sendWelcomeEmailOnFirstLogin(user);
    }

    res.json({
      success: true,
      token,
      user: serializeUser(user),
      settings: syncStore.getUserSettings(user.id)
    });
  } catch (err: any) {
    res.status(401).json({
      success: false,
      message: err?.message || 'Google ID token verification failed'
    });
  }
});

/**
 * GET /api/auth/google/start
 * Generates Google OAuth 2.0 + PKCE Authorization URL
 */
router.get('/google/start', (req: Request, res: Response): void => {
  if (!GoogleOAuthService.getConfigStatus().redirectFlowEnabled) {
    res.status(503).json({
      success: false,
      code: 'GOOGLE_OAUTH_NOT_CONFIGURED',
      message:
        'Google OAuth is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env.'
    });
    return;
  }

  const frontendOrigin = resolveAllowedFrontendOrigin(req.query.origin as string | undefined);
  const backendCallbackUri = resolveBackendCallbackUri(req);

  try {
    const authUrl = GoogleOAuthService.createAuthorizationUrl({
      backendCallbackUri,
      frontendOrigin
    });

    if (req.query.redirect === '1') {
      res.redirect(authUrl);
      return;
    }

    res.json({ success: true, authUrl });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err?.message || 'Unable to start Google OAuth flow'
    });
  }
});

/**
 * GET /api/auth/google/callback
 * Google OAuth 2.0 Authorization Code exchange + JWKS ID token verification
 */
router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const oauthError = req.query.error as string | undefined;

  if (oauthError || !code || !state) {
    const fallbackOrigin = resolveAllowedFrontendOrigin();
    res.redirect(
      `${fallbackOrigin}/login?error=${encodeURIComponent(oauthError || 'Google sign-in was cancelled')}`
    );
    return;
  }

  try {
    const { profile, frontendOrigin } = await GoogleOAuthService.exchangeAuthorizationCode(code, state);
    const { user, isNewUser } = syncStore.findOrCreateGoogleUser(profile);
    const token = issueAuthToken(user);

    // Asynchronously dispatch welcome email for first-time Google sign-up without blocking redirect
    if (isNewUser) {
      void WelcomeEmailService.sendWelcomeEmailOnFirstLogin(user, frontendOrigin);
    }

    // Deliver token in URL fragment (#) so it is never sent to servers or logged in query strings
    res.redirect(`${frontendOrigin}/auth/google/callback#token=${encodeURIComponent(token)}`);
  } catch (err: any) {
    const fallbackOrigin = resolveAllowedFrontendOrigin();
    res.redirect(
      `${fallbackOrigin}/login?error=${encodeURIComponent(err?.message || 'Google authentication failed')}`
    );
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user & settings
 */
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const user = syncStore.findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  const settings = syncStore.getUserSettings(user.id);

  res.json({
    success: true,
    user: serializeUser(user),
    settings
  });
});

/**
 * GET /api/auth/welcome-status
 * Retrieves current user's welcome email delivery status
 */
router.get('/welcome-status', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const status = syncStore.getWelcomeEmailStatus(req.userId!);
  if (!status) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({
    success: true,
    ...status
  });
});

/**
 * POST /api/auth/welcome-email/retry
 * Retries a failed welcome email delivery for the authenticated user
 */
router.post('/welcome-email/retry', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await WelcomeEmailService.retryWelcomeEmail(req.userId!);
  res.json({
    success: result.success,
    status: result.status,
    reason: result.reason,
    error: result.error
  });
});

/**
 * POST /api/auth/refresh
 * Refreshes an active or recently-expired JWT (within a 7-day grace window after exp)
 */
router.post('/refresh', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1]?.trim() : undefined;
  const bodyToken = typeof req.body?.token === 'string' ? req.body.token.trim() : undefined;
  const token = headerToken || bodyToken;

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication token is required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as {
      userId?: string;
      email?: string;
      exp?: number;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    const maxGraceSec = 7 * 24 * 60 * 60;
    if (decoded.exp && nowSec - decoded.exp > maxGraceSec) {
      res.status(401).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: 'Session expired. Please sign in again.'
      });
      return;
    }

    const user = decoded.userId ? syncStore.findUserById(decoded.userId) : undefined;
    if (!user) {
      res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Account session is no longer valid. Please sign in again.'
      });
      return;
    }

    const freshToken = issueAuthToken(user);
    const settings = syncStore.getUserSettings(user.id);
    res.json({
      success: true,
      token: freshToken,
      user: serializeUser(user),
      settings
    });
  } catch {
    res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Invalid authentication token'
    });
  }
});

/**
 * POST /api/auth/logout
 * Acknowledges client sign-out cleanly
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ success: true, message: 'Signed out' });
});

/**
 * POST /api/auth/password-reset/request
 * Initiates secure password reset with 6-digit OTP challenge
 */
router.post('/password-reset/request', async (req: Request, res: Response): Promise<void> => {
  const result = z
    .object({ email: z.string().email('Please enter a valid email address') })
    .safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const normalizedEmail = result.data.email.toLowerCase().trim();
  const user = syncStore.findUserByEmail(normalizedEmail);
  if (!user) {
    res.status(404).json({ success: false, message: 'No registered user found with this email address.' });
    return;
  }

  const challenge = await OtpChallengeService.createAndSendChallenge({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    purpose: 'PASSWORD_RESET'
  });

  if (!challenge.delivery.delivered) {
    res.status(503).json({
      success: false,
      code: 'EMAIL_DELIVERY_FAILED',
      message: 'Unable to send password reset code. Please check server email delivery setup.'
    });
    return;
  }

  res.json({
    success: true,
    challengeId: challenge.challengeId,
    maskedEmail: challenge.maskedEmail,
    expiresInSec: challenge.expiresInSec,
    message: `Password reset verification code sent to ${challenge.maskedEmail}`
  });
});

/**
 * POST /api/auth/password-reset/confirm
 * Validates OTP and updates account password with bcrypt hashing
 */
router.post('/password-reset/confirm', async (req: Request, res: Response): Promise<void> => {
  const result = z
    .object({
      email: z.string().email('Please enter a valid email address'),
      challengeId: z.string().uuid('Invalid challenge session'),
      otp: z.string().regex(/^\d{6}$/, 'Verification code must be 6 digits'),
      newPassword: z.string().min(6, 'Password must be at least 6 characters')
    })
    .safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const verifyResult = OtpChallengeService.verifyChallenge(
    result.data.challengeId,
    result.data.email,
    result.data.otp
  );

  if (!verifyResult.ok) {
    res.status(verifyResult.status || 400).json({
      success: false,
      code: verifyResult.code,
      message: verifyResult.message,
      remainingAttempts: verifyResult.attemptsRemaining
    });
    return;
  }

  const newHash = await bcrypt.hash(result.data.newPassword, 10);
  const updated = syncStore.updateUserPassword(verifyResult.userId, newHash);
  if (!updated) {
    res.status(404).json({ success: false, message: 'User account could not be found.' });
    return;
  }

  res.json({
    success: true,
    message: 'Your password has been reset successfully. Please sign in with your new password.'
  });
});

/**
 * PUT /api/auth/profile
 * Updates authenticated user's profile display name or avatar
 */
router.put('/profile', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const result = z
    .object({
      displayName: z.string().min(1, 'Name is required').max(80).optional(),
      avatarUrl: z.string().optional()
    })
    .safeParse(req.body);

  if (!result.success) {
    res.status(400).json({ success: false, errors: result.error.errors, message: result.error.errors[0]?.message });
    return;
  }

  const updated = syncStore.updateUserProfile(req.userId!, result.data);
  if (!updated) {
    res.status(404).json({ success: false, message: 'User not found' });
    return;
  }

  res.json({
    success: true,
    user: serializeUser(updated),
    message: 'Profile updated successfully'
  });
});

export default router;
