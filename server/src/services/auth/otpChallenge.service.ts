import crypto from 'crypto';
import { JWT_SECRET } from '../../middleware/auth';
import { OtpMailerService, OtpDeliveryResult } from './otpMailer.service';

export type OtpPurpose = 'LOGIN' | 'SIGNUP' | 'PASSWORD_RESET';

interface PendingOtpChallenge {
  challengeId: string;
  userId: string;
  email: string;
  displayName: string;
  purpose: OtpPurpose;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  expiresAt: number;
  resendAvailableAt: number;
}

export const getOtpTtlMinutes = (): number => {
  const envVal = parseInt(process.env.OTP_EXPIRY_MINUTES || '', 10);
  return Number.isFinite(envVal) && envVal > 0 ? envVal : 3;
};

export const getOtpTtlMs = (): number => getOtpTtlMinutes() * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const MAX_VERIFY_ATTEMPTS = 5;

export class OtpChallengeService {
  private static challenges = new Map<string, PendingOtpChallenge>();

  private static hashOtp(challengeId: string, email: string, otp: string): string {
    return crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${challengeId}:${email.toLowerCase().trim()}:${otp}`)
      .digest('hex');
  }

  private static pruneExpired(): void {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [id, ch] of this.challenges.entries()) {
      if (ch.expiresAt <= cutoff) {
        this.challenges.delete(id);
      }
    }
  }

  static maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
  }

  static async createAndSendChallenge(params: {
    userId: string;
    email: string;
    displayName: string;
    purpose: OtpPurpose;
  }): Promise<{
    challengeId: string;
    maskedEmail: string;
    expiresInSec: number;
    resendAfterSec: number;
    delivery: OtpDeliveryResult;
  }> {
    this.pruneExpired();

    const normalizedEmail = params.email.toLowerCase().trim();
    const challengeId = crypto.randomUUID();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const now = Date.now();

    const ttlMinutes = getOtpTtlMinutes();
    const ttlMs = getOtpTtlMs();

    const delivery = await OtpMailerService.sendOtpEmail({
      to: normalizedEmail,
      displayName: params.displayName,
      otp,
      purpose: params.purpose,
      expiresInMinutes: ttlMinutes
    });

    if (!delivery.delivered) {
      return {
        challengeId: '',
        maskedEmail: this.maskEmail(normalizedEmail),
        expiresInSec: 0,
        resendAfterSec: 0,
        delivery
      };
    }

    this.challenges.set(challengeId, {
      challengeId,
      userId: params.userId,
      email: normalizedEmail,
      displayName: params.displayName,
      purpose: params.purpose,
      otpHash: this.hashOtp(challengeId, normalizedEmail, otp),
      attempts: 0,
      maxAttempts: MAX_VERIFY_ATTEMPTS,
      createdAt: now,
      expiresAt: now + ttlMs,
      resendAvailableAt: now + OTP_RESEND_COOLDOWN_MS
    });

    return {
      challengeId,
      maskedEmail: this.maskEmail(normalizedEmail),
      expiresInSec: ttlMs / 1000,
      resendAfterSec: OTP_RESEND_COOLDOWN_MS / 1000,
      delivery
    };
  }

  static async resendChallenge(
    challengeId: string,
    email: string
  ): Promise<
    | { ok: true; resendAfterSec: number; expiresInSec: number }
    | { ok: false; code: 'NOT_FOUND' | 'COOLDOWN' | 'DELIVERY_FAILED'; message: string; retryAfterSec?: number }
  > {
    this.pruneExpired();
    const ch = this.challenges.get(challengeId);
    const normalizedEmail = email.toLowerCase().trim();

    if (!ch || ch.email !== normalizedEmail) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'OTP session expired or not found. Please sign in again.'
      };
    }

    const now = Date.now();
    if (now < ch.resendAvailableAt) {
      const retryAfterSec = Math.ceil((ch.resendAvailableAt - now) / 1000);
      return {
        ok: false,
        code: 'COOLDOWN',
        retryAfterSec,
        message: `Please wait ${retryAfterSec}s before requesting another code.`
      };
    }

    const ttlMinutes = getOtpTtlMinutes();
    const ttlMs = getOtpTtlMs();

    const freshOtp = crypto.randomInt(100000, 1000000).toString();
    const delivery = await OtpMailerService.sendOtpEmail({
      to: ch.email,
      displayName: ch.displayName,
      otp: freshOtp,
      purpose: ch.purpose,
      expiresInMinutes: ttlMinutes
    });

    if (!delivery.delivered) {
      return {
        ok: false,
        code: 'DELIVERY_FAILED',
        message: delivery.error || 'Failed to resend OTP email.'
      };
    }

    ch.otpHash = this.hashOtp(ch.challengeId, ch.email, freshOtp);
    ch.attempts = 0;
    ch.expiresAt = now + ttlMs;
    ch.resendAvailableAt = now + OTP_RESEND_COOLDOWN_MS;
    this.challenges.set(ch.challengeId, ch);

    return {
      ok: true,
      resendAfterSec: OTP_RESEND_COOLDOWN_MS / 1000,
      expiresInSec: ttlMs / 1000
    };
  }

  static verifyChallenge(
    challengeId: string,
    email: string,
    otp: string
  ):
    | { ok: true; userId: string; email: string; purpose: OtpPurpose }
    | {
        ok: false;
        code: 'NOT_FOUND' | 'EXPIRED' | 'LOCKED' | 'INVALID_OTP';
        status: number;
        message: string;
        attemptsRemaining?: number;
      } {
    this.pruneExpired();
    const normalizedEmail = email.toLowerCase().trim();
    const ch = this.challenges.get(challengeId);

    if (!ch || ch.email !== normalizedEmail) {
      return {
        ok: false,
        code: 'NOT_FOUND',
        status: 404,
        message: 'Verification session not found or expired. Please start again.'
      };
    }

    if (Date.now() > ch.expiresAt) {
      this.challenges.delete(challengeId);
      return {
        ok: false,
        code: 'EXPIRED',
        status: 410,
        message: 'Verification code expired. Request a new code.'
      };
    }

    if (ch.attempts >= ch.maxAttempts) {
      this.challenges.delete(challengeId);
      return {
        ok: false,
        code: 'LOCKED',
        status: 429,
        message: 'Too many invalid attempts. Please sign in again to receive a fresh code.'
      };
    }

    const candidateHash = this.hashOtp(challengeId, normalizedEmail, otp.trim());
    const bufA = Buffer.from(candidateHash, 'hex');
    const bufB = Buffer.from(ch.otpHash, 'hex');

    const matches = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    if (!matches) {
      ch.attempts += 1;
      const remaining = ch.maxAttempts - ch.attempts;
      if (remaining <= 0) {
        this.challenges.delete(challengeId);
        return {
          ok: false,
          code: 'LOCKED',
          status: 429,
          message: 'Maximum OTP verification attempts exceeded. Please sign in again.'
        };
      }
      return {
        ok: false,
        code: 'INVALID_OTP',
        status: 401,
        attemptsRemaining: remaining,
        message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      };
    }

    // Consume single-use OTP challenge
    this.challenges.delete(challengeId);
    return {
      ok: true,
      userId: ch.userId,
      email: ch.email,
      purpose: ch.purpose
    };
  }
}
