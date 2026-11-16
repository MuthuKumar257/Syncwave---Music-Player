import { syncStore, User } from '../../db/store';
import { OtpMailerService, RawEmailPayload } from './otpMailer.service';

export interface WelcomeEmailDeliveryResult {
  success: boolean;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  provider?: 'SMTP' | 'RESEND' | 'TEST_TRANSPORT' | 'UNCONFIGURED';
  reason?: string;
  error?: string;
}

export type WelcomeTestTransportHook = (payload: {
  to: string;
  displayName: string;
  subject: string;
  html: string;
  text: string;
}) => Promise<void> | void;

const isTestEnv = () =>
  process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

const escapeHtml = (str: string): string =>
  str.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });

/**
 * Masks user email addresses in server logs to prevent leaking personal information
 * e.g., "muthukumar@gmail.com" -> "m***r@gmail.com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export class WelcomeEmailService {
  private static testHook: WelcomeTestTransportHook | null = null;

  /**
   * Test transport hook (strictly restricted to test environments)
   */
  static setTestTransport(hook: WelcomeTestTransportHook | null): void {
    if (!isTestEnv()) {
      throw new Error('Test Welcome Email transport is strictly restricted to test environments.');
    }
    this.testHook = hook;
  }

  /**
   * Builds the modern music-themed responsive HTML and plain-text welcome email
   */
  static buildWelcomeEmail(
    displayName: string,
    frontendUrl: string,
    authProvider: 'GOOGLE' | 'EMAIL' = 'EMAIL'
  ): {
    subject: string;
    html: string;
    text: string;
  } {
    const safeName = escapeHtml(displayName.trim()) || 'Music Lover';
    const ctaUrl = frontendUrl.replace(/\/+$/, '');
    const subject = 'Welcome to SyncWave – Your Music Journey Starts Here! 🎵';

    const providerNote =
      authProvider === 'GOOGLE'
        ? 'You received this email because you signed up for SyncWave via Google OAuth.'
        : 'You received this email because you created an account on SyncWave.';

    const leadHtml =
      authProvider === 'GOOGLE'
        ? `Welcome to <strong>SyncWave</strong> – your personal music companion! Your Google account has been successfully linked, and your smart audio journey starts right now.`
        : `Welcome to <strong>SyncWave</strong> – your personal music companion! Your account has been successfully created, and your smart audio journey starts right now.`;

    const text = [
      `Hi ${displayName.trim() || 'Music Lover'},`,
      '',
      'Welcome to SyncWave – Your Music Journey Starts Here! 🎵',
      '',
      "We're thrilled to welcome you to SyncWave, your smart cross-platform music streaming ecosystem.",
      '',
      'HERE IS WHAT AWAITS YOU:',
      '• Personalized Recommendations: An intelligent music companion that learns your unique taste, favorite moods, and replay habits.',
      '• Universal Discovery: Discover tracks by language, legendary music directors, iconic singers, and complete soundtrack albums.',
      '• Playlists & Listening History: Curate custom playlists, heart favorite songs, track your most rewatched hits, and listen offline on any device.',
      '',
      `Ready to dive in? Click here to start listening: ${ctaUrl}`,
      '',
      'Happy listening,',
      'The SyncWave Team',
      '',
      'Support: support@syncwave.app | https://syncwave.app',
      providerNote
    ].join('\n');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0A0A0C;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #EDEDED;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0A0A0C;
      padding: 40px 16px;
      box-sizing: border-box;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #141417;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 32px 32px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
      background: linear-gradient(180deg, #1A1A1E 0%, #141417 100%);
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 9999px;
      color: #F59E0B;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: -0.5px;
      margin: 0 0 4px;
    }
    .brand-sub {
      font-size: 13px;
      color: #85858B;
      margin: 0;
    }
    .content {
      padding: 32px;
    }
    .greeting {
      font-size: 20px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0 0 16px;
    }
    .lead {
      font-size: 15px;
      line-height: 1.6;
      color: #D4D4D8;
      margin: 0 0 28px;
    }
    .features-grid {
      margin-bottom: 32px;
    }
    .feature-card {
      background: #1C1C21;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 14px;
    }
    .feature-title {
      font-size: 14px;
      font-weight: 700;
      color: #F59E0B;
      margin: 0 0 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .feature-desc {
      font-size: 13px;
      line-height: 1.5;
      color: #A1A1AA;
      margin: 0;
    }
    .cta-container {
      text-align: center;
      padding: 12px 0 24px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
      color: #000000 !important;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      padding: 14px 36px;
      border-radius: 10px;
      box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
      transition: transform 0.15s ease;
    }
    .closing-text {
      text-align: center;
      font-size: 13px;
      color: #71717A;
      margin: 16px 0 0;
    }
    .footer {
      padding: 24px 32px;
      background-color: #0F0F12;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      line-height: 1.6;
      color: #71717A;
      margin: 0 0 6px;
    }
    .footer-link {
      color: #F59E0B;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="brand-badge">🎵 SyncWave Ecosystem</div>
        <h1 class="brand-title">SyncWave</h1>
        <p class="brand-sub">Smart Cross-Platform Music Player</p>
      </div>

      <!-- Main Body -->
      <div class="content">
        <h2 class="greeting">Hi ${safeName},</h2>
        <p class="lead">
          ${leadHtml}
        </p>

        <!-- Feature Spotlight Cards -->
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-title">✨ Smart Music Recommendations</div>
            <p class="feature-desc">
              Experience an intelligent queue that continuously adapts to your music preferences, moods, and top replay habits. Select a single song and let SyncWave curate the rest.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-title">🌐 Language &amp; Artist Discovery</div>
            <p class="feature-desc">
              Explore music by languages, legendary music directors, iconic playback singers, and complete movie soundtracks without clutter.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-title">🎧 Custom Playlists, Likes &amp; History</div>
            <p class="feature-desc">
              Organize your personal playlists, heart your favorites, inspect deep listening stats, and save music for reliable offline playback anytime.
            </p>
          </div>
        </div>

        <!-- Call To Action -->
        <div class="cta-container">
          <a href="${ctaUrl}" target="_blank" class="cta-button">Start Listening →</a>
          <p class="closing-text">Your soundtrack is ready. Hit play and enjoy your music!</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">
          &copy; ${new Date().getFullYear()} SyncWave Music Ecosystem. All rights reserved.
        </p>
        <p class="footer-text">
          Need assistance or have feedback? Reach our support team anytime at
          <a href="mailto:support@syncwave.app" class="footer-link">support@syncwave.app</a>
        </p>
        <p class="footer-text" style="color:#52525B;">
          ${escapeHtml(providerNote)}
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { subject, html, text };
  }

  /**
   * Sends the personalized welcome email upon a newly registered Google OAuth user's first login.
   * - Atomically checks and claims the email send to prevent duplicate emails from retries or concurrent requests.
   * - Executes asynchronously and never blocks or throws in the login flow.
   */
  static async sendWelcomeEmailOnFirstLogin(
    user: User,
    customFrontendOrigin?: string
  ): Promise<WelcomeEmailDeliveryResult> {
    const masked = maskEmail(user.email);

    // 1. Duplicate Prevention: Check and claim send atomically
    const claimed = syncStore.claimWelcomeEmailSend(user.id);
    if (!claimed) {
      console.log(`[WelcomeEmailService] Welcome email already sent or currently sending for ${masked}. Skipping.`);
      return {
        success: false,
        status: 'SKIPPED',
        reason: 'Welcome email already delivered or claimed'
      };
    }

    try {
      const frontendUrl =
        customFrontendOrigin?.trim() ||
        process.env.FRONTEND_URL?.trim() ||
        'http://localhost:5173';

      const { subject, html, text } = this.buildWelcomeEmail(
        user.displayName || 'Music Lover',
        frontendUrl,
        user.authProvider || 'EMAIL'
      );

      // 2. In test environment, if test hook registered, dispatch directly
      if (isTestEnv() && this.testHook) {
        await this.testHook({
          to: user.email,
          displayName: user.displayName || 'Music Lover',
          subject,
          html,
          text
        });
        syncStore.markWelcomeEmailResult(user.id, true);
        console.log(`[WelcomeEmailService] [TEST_TRANSPORT] Welcome email delivered to ${masked}`);
        return { success: true, status: 'SENT', provider: 'TEST_TRANSPORT' };
      }

      // 3. Dispatch through configured SMTP or Resend transport
      const fromAddress = process.env.EMAIL_FROM?.trim() || 'SyncWave <onboarding@syncwave.app>';
      const result = await OtpMailerService.sendRawEmail({
        to: user.email,
        subject,
        html,
        text,
        from: fromAddress
      });

      if (result.delivered) {
        syncStore.markWelcomeEmailResult(user.id, true);
        console.log(`[WelcomeEmailService] Welcome email successfully delivered to ${masked} via ${result.provider}`);
        return {
          success: true,
          status: 'SENT',
          provider: result.provider
        };
      } else {
        syncStore.markWelcomeEmailResult(user.id, false, { error: result.error });
        console.warn(
          `[WelcomeEmailService] Welcome email delivery failed for ${masked}: ${result.error || result.reason}`
        );
        return {
          success: false,
          status: 'FAILED',
          reason: result.reason,
          error: result.error
        };
      }
    } catch (err: any) {
      syncStore.markWelcomeEmailResult(user.id, false, { error: err?.message });
      console.error(
        `[WelcomeEmailService] Unexpected error sending welcome email to ${masked}:`,
        err?.message || err
      );
      return {
        success: false,
        status: 'FAILED',
        error: err?.message || 'Unexpected delivery failure'
      };
    }
  }

  /**
   * Safely retries a failed welcome email delivery for an existing user account
   */
  static async retryWelcomeEmail(userId: string): Promise<WelcomeEmailDeliveryResult> {
    const user = syncStore.findUserById(userId);
    if (!user) {
      return { success: false, status: 'FAILED', error: 'User not found' };
    }

    if (user.welcomeEmailSent || user.welcomeEmailStatus === 'SENT') {
      return { success: false, status: 'SKIPPED', reason: 'Welcome email already sent' };
    }

    // Reset status to allow re-claiming
    user.welcomeEmailStatus = 'PENDING';
    return this.sendWelcomeEmailOnFirstLogin(user);
  }
}
