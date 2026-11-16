import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { syncStore } from '../src/db/store';
import { WelcomeEmailService } from '../src/services/auth/welcomeEmail.service';
import { GoogleOAuthService } from '../src/services/auth/googleOAuth.service';
import { OtpMailerService } from '../src/services/auth/otpMailer.service';

describe('Automatic Welcome Email After Google OAuth Login Suite', () => {
  const capturedWelcomeEmails: Array<{
    to: string;
    displayName: string;
    subject: string;
    html: string;
    text: string;
  }> = [];

  beforeEach(() => {
    capturedWelcomeEmails.length = 0;
    WelcomeEmailService.setTestTransport((payload) => {
      capturedWelcomeEmails.push(payload);
    });
  });

  afterEach(() => {
    WelcomeEmailService.setTestTransport(null);
    OtpMailerService.setTestTransport(null);
    vi.restoreAllMocks();
  });

  it('1. New Google OAuth user receives a personalized welcome email upon first registration', async () => {
    const googleProfile = {
      sub: `google_sub_${Date.now()}`,
      email: `new_listener_${Date.now()}@gmail.com`,
      displayName: 'Aditya Shankar',
      avatarUrl: 'https://lh3.googleusercontent.com/a/avatar123'
    };

    // Mock Google ID token verification
    vi.spyOn(GoogleOAuthService, 'getConfigStatus').mockReturnValue({
      redirectFlowEnabled: true,
      idTokenEnabled: true,
      clientId: 'mock-google-client-id.apps.googleusercontent.com'
    });
    vi.spyOn(GoogleOAuthService, 'verifyGoogleIdToken').mockResolvedValue(googleProfile);

    // Call /api/auth/google (Mobile & Web ID token flow)
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'valid_test_credential_token_abc123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(googleProfile.email);
    expect(res.body.user.displayName).toBe(googleProfile.displayName);

    // Give background async email dispatch a tick to finish
    await new Promise((r) => setTimeout(r, 50));

    // Verify exactly 1 welcome email was sent
    expect(capturedWelcomeEmails.length).toBe(1);
    const email = capturedWelcomeEmails[0];

    // Check email recipient
    expect(email.to).toBe(googleProfile.email);

    // Check subject requirement
    expect(email.subject).toBe('Welcome to SyncWave – Your Music Journey Starts Here! 🎵');

    // Check personalized greeting
    expect(email.text).toContain('Hi Aditya Shankar,');
    expect(email.html).toContain('Hi Aditya Shankar,');

    // Check feature requirements in content
    // - Personalized recommendations
    expect(email.html).toContain('Smart Music Recommendations');
    expect(email.text).toContain('Personalized Recommendations');

    // - Music discovery by language, artists, and music directors
    expect(email.html).toContain('Language &amp; Artist Discovery');
    expect(email.text).toContain('Universal Discovery');
    expect(email.text).toContain('music directors');

    // - Playlists, liked songs and listening history
    expect(email.html).toContain('Custom Playlists, Likes &amp; History');
    expect(email.text).toContain('Playlists & Listening History');

    // - Call to action button
    expect(email.html).toContain('Start Listening →');

    // Verify user record in database
    const userInDb = syncStore.findUserByEmail(googleProfile.email);
    expect(userInDb).toBeDefined();
    expect(userInDb?.welcomeEmailSent).toBe(true);
    expect(userInDb?.welcomeEmailStatus).toBe('SENT');
    expect(userInDb?.welcomeEmailSentAt).toBeDefined();
  });

  it('2. Existing Google OAuth user does NOT receive another welcome email on subsequent logins', async () => {
    const googleProfile = {
      sub: `existing_sub_${Date.now()}`,
      email: `existing_user_${Date.now()}@gmail.com`,
      displayName: 'Maya Sundaram'
    };

    vi.spyOn(GoogleOAuthService, 'getConfigStatus').mockReturnValue({
      redirectFlowEnabled: true,
      idTokenEnabled: true,
      clientId: 'mock-google-client-id.apps.googleusercontent.com'
    });
    vi.spyOn(GoogleOAuthService, 'verifyGoogleIdToken').mockResolvedValue(googleProfile);

    // 1st Login: New account creation
    const res1 = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'valid_test_credential_token_first_time' });

    expect(res1.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(capturedWelcomeEmails.length).toBe(1);

    // 2nd Login: Existing account
    const res2 = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'valid_test_credential_token_second_time' });

    expect(res2.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));

    // Verify still exactly 1 email sent (NO duplicate email)
    expect(capturedWelcomeEmails.length).toBe(1);
  });

  it('3. Web Google OAuth redirect callback (/api/auth/google/callback) sends welcome email for new users', async () => {
    const googleProfile = {
      sub: `web_redirect_sub_${Date.now()}`,
      email: `web_redirect_${Date.now()}@gmail.com`,
      displayName: 'Karthik Raja'
    };

    vi.spyOn(GoogleOAuthService, 'exchangeAuthorizationCode').mockResolvedValue({
      profile: googleProfile,
      frontendOrigin: 'http://localhost:5173'
    });

    const res = await request(app)
      .get('/api/auth/google/callback')
      .query({ code: 'valid_oauth_code_123', state: 'valid_state_456' });

    // Expect redirect with token in fragment
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('http://localhost:5173/auth/google/callback#token=');

    await new Promise((r) => setTimeout(r, 50));

    expect(capturedWelcomeEmails.length).toBe(1);
    expect(capturedWelcomeEmails[0].to).toBe(googleProfile.email);
    expect(capturedWelcomeEmails[0].displayName).toBe('Karthik Raja');
    expect(capturedWelcomeEmails[0].html).toContain('http://localhost:5173');
  });

  it('4. Concurrent duplicate OAuth callbacks safely send only ONE welcome email', async () => {
    const googleProfile = {
      sub: `concurrent_sub_${Date.now()}`,
      email: `concurrent_${Date.now()}@gmail.com`,
      displayName: 'Sneha Patel'
    };

    vi.spyOn(GoogleOAuthService, 'getConfigStatus').mockReturnValue({
      redirectFlowEnabled: true,
      idTokenEnabled: true,
      clientId: 'mock-google-client-id.apps.googleusercontent.com'
    });
    vi.spyOn(GoogleOAuthService, 'verifyGoogleIdToken').mockResolvedValue(googleProfile);

    // Trigger two requests concurrently (simulating network retry or double click)
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid_test_credential_token_concurrent_1' }),
      request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid_test_credential_token_concurrent_2' })
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    await new Promise((r) => setTimeout(r, 50));

    // Duplicate prevention ensures strictly 1 email is sent
    expect(capturedWelcomeEmails.length).toBe(1);
  });

  it('5. Email delivery failure does not prevent login or crash authentication', async () => {
    const googleProfile = {
      sub: `fail_sub_${Date.now()}`,
      email: `email_fail_${Date.now()}@gmail.com`,
      displayName: 'Rajesh Kumar'
    };

    vi.spyOn(GoogleOAuthService, 'getConfigStatus').mockReturnValue({
      redirectFlowEnabled: true,
      idTokenEnabled: true,
      clientId: 'mock-google-client-id.apps.googleusercontent.com'
    });
    vi.spyOn(GoogleOAuthService, 'verifyGoogleIdToken').mockResolvedValue(googleProfile);

    // Mock email transport throwing an error (e.g. SMTP down)
    WelcomeEmailService.setTestTransport(() => {
      throw new Error('SMTP Server Connection Refused');
    });

    // Login request MUST still succeed cleanly
    const res = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'valid_test_credential_token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();

    await new Promise((r) => setTimeout(r, 50));

    // Verify user record tracks failed status
    const userInDb = syncStore.findUserByEmail(googleProfile.email);
    expect(userInDb?.welcomeEmailSent).toBe(false);
    expect(userInDb?.welcomeEmailStatus).toBe('FAILED');
  });

  it('6. Safe retry of a previously failed welcome email', async () => {
    const googleProfile = {
      sub: `retry_sub_${Date.now()}`,
      email: `retry_test_${Date.now()}@gmail.com`,
      displayName: 'Pooja Hegde'
    };

    vi.spyOn(GoogleOAuthService, 'getConfigStatus').mockReturnValue({
      redirectFlowEnabled: true,
      idTokenEnabled: true,
      clientId: 'mock-google-client-id.apps.googleusercontent.com'
    });
    vi.spyOn(GoogleOAuthService, 'verifyGoogleIdToken').mockResolvedValue(googleProfile);

    // First attempt fails
    WelcomeEmailService.setTestTransport(() => {
      throw new Error('Network timeout');
    });

    const loginRes = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'valid_test_credential_token_attempt_1' });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.token;

    await new Promise((r) => setTimeout(r, 50));
    expect(capturedWelcomeEmails.length).toBe(0);

    // Now restore healthy transport
    WelcomeEmailService.setTestTransport((payload) => {
      capturedWelcomeEmails.push(payload);
    });

    // Call retry endpoint
    const retryRes = await request(app)
      .post('/api/auth/welcome-email/retry')
      .set('Authorization', `Bearer ${token}`);

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.success).toBe(true);
    expect(retryRes.body.status).toBe('SENT');

    expect(capturedWelcomeEmails.length).toBe(1);
    expect(capturedWelcomeEmails[0].to).toBe(googleProfile.email);

    // Status endpoint confirms 'SENT'
    const statusRes = await request(app)
      .get('/api/auth/welcome-status')
      .set('Authorization', `Bearer ${token}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.sent).toBe(true);
    expect(statusRes.body.status).toBe('SENT');
  });

  it('7. Safely escapes HTML in user display names to prevent XSS in email clients', () => {
    const maliciousName = '<script>alert("xss")</script> & "Admin"';
    const email = WelcomeEmailService.buildWelcomeEmail(maliciousName, 'http://localhost:5173');

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).toContain('&amp;');
    expect(email.html).toContain('&quot;Admin&quot;');
  });

  it('8. New email/password registration triggers personalized welcome email', async () => {
    const email = `new_email_user_${Date.now()}@example.com`;
    const res = await request(app).post('/api/auth/register').send({
      email,
      password: 'StrongPassword#2026',
      displayName: 'Kavitha Ram'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(capturedWelcomeEmails.length).toBe(1);
    const sent = capturedWelcomeEmails[0];
    expect(sent.to).toBe(email);
    expect(sent.subject).toBe('Welcome to SyncWave – Your Music Journey Starts Here! 🎵');
    expect(sent.text).toContain('Hi Kavitha Ram,');
    expect(sent.html).toContain('Hi Kavitha Ram,');
    expect(sent.html).toContain('Your account has been successfully created');
    expect(sent.text).toContain('You received this email because you created an account on SyncWave.');

    const userInDb = syncStore.findUserByEmail(email);
    expect(userInDb?.welcomeEmailSent).toBe(true);
    expect(userInDb?.welcomeEmailStatus).toBe('SENT');
  });

  it('9. Existing email user logging in does NOT receive duplicate welcome email', async () => {
    const email = `duplicate_check_${Date.now()}@example.com`;
    // Register account
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'StrongPassword#2026',
      displayName: 'Deepak V'
    });
    expect(regRes.status).toBe(201);

    await new Promise((r) => setTimeout(r, 50));
    expect(capturedWelcomeEmails.length).toBe(1);

    // Login with direct password
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: 'StrongPassword#2026'
    });
    expect(loginRes.status).toBe(200);

    await new Promise((r) => setTimeout(r, 50));
    // Still strictly 1 email
    expect(capturedWelcomeEmails.length).toBe(1);
  });
});
