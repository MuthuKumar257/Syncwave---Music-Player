import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { OtpMailerService, OtpEmailPayload } from '../src/services/auth/otpMailer.service';

describe('Production Auth Flow (Email+Password+OTP, Sign-Up Verification, Google OAuth)', () => {
  const capturedEmails: OtpEmailPayload[] = [];

  beforeEach(() => {
    capturedEmails.length = 0;
  });

  afterEach(() => {
    OtpMailerService.setTestTransport(null);
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  it('GET /api/auth/providers returns honest provider capabilities with zero secrets', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.google).toBeDefined();
    expect(res.body.otp).toBeDefined();
    expect(res.body).not.toHaveProperty('clientSecret');
  });

  it('POST /api/auth/login/initiate never leaks demo OTPs and returns 503 when SMTP/Resend unconfigured', async () => {
    const email = `unconf_${Date.now()}@syncwave.app`;
    await request(app).post('/api/auth/register').send({
      email,
      password: 'StrongPassword#2026',
      displayName: 'Unconfigured Test'
    });

    OtpMailerService.setTestTransport(null);

    const res = await request(app).post('/api/auth/login/initiate').send({
      email,
      password: 'StrongPassword#2026'
    });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('OTP_DELIVERY_NOT_CONFIGURED');
    expect(res.body.otp).toBeUndefined();
    expect(res.body.demoOtp).toBeUndefined();
  });

  it('Email + Password + 6-digit OTP verification issues single-use challenge and enforces attempt & replay limits', async () => {
    OtpMailerService.setTestTransport((payload) => {
      capturedEmails.push(payload);
    });

    const email = `otp_user_${Date.now()}@syncwave.app`;
    const password = 'StrongPassword#2026';

    // Register with OTP verification enabled
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      displayName: 'OTP Wave Listener',
      verifyWithOtp: true
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.otpRequired).toBe(true);
    expect(regRes.body.expiresInSec).toBe(180);
    expect(regRes.body.token).toBeUndefined();
    expect(capturedEmails.length).toBe(1);
    expect(capturedEmails[0].expiresInMinutes).toBe(3);
    const signupOtp = capturedEmails[0].otp;
    expect(signupOtp).toMatch(/^\d{6}$/);

    // Verify signup OTP -> returns JWT
    const verifySignupRes = await request(app).post('/api/auth/otp/verify').send({
      challengeId: regRes.body.challengeId,
      email,
      otp: signupOtp
    });
    expect(verifySignupRes.status).toBe(200);
    expect(verifySignupRes.body.token).toBeDefined();
    expect(verifySignupRes.body.user.emailVerified).toBe(true);

    // Step 1 Login initiate -> sends fresh 6-digit OTP
    const initRes = await request(app).post('/api/auth/login/initiate').send({
      email,
      password
    });
    expect(initRes.status).toBe(200);
    expect(initRes.body.otpRequired).toBe(true);
    expect(initRes.body.expiresInSec).toBe(180);
    expect(initRes.body.challengeId).toBeDefined();
    expect(capturedEmails[1].expiresInMinutes).toBe(3);
    expect(JSON.stringify(initRes.body)).not.toContain(capturedEmails[1].otp);

    // Resend within cooldown returns 429
    const cooldownRes = await request(app).post('/api/auth/otp/resend').send({
      challengeId: initRes.body.challengeId,
      email
    });
    expect(cooldownRes.status).toBe(429);

    // Wrong OTP attempt returns 401 with remaining attempts
    const badVerify = await request(app).post('/api/auth/login/verify-otp').send({
      challengeId: initRes.body.challengeId,
      email,
      otp: '000000' === capturedEmails[1].otp ? '999999' : '000000'
    });
    expect(badVerify.status).toBe(401);
    expect(badVerify.body.attemptsRemaining).toBe(4);

    // Valid OTP verifies cleanly & issues JWT
    const goodVerify = await request(app).post('/api/auth/login/verify-otp').send({
      challengeId: initRes.body.challengeId,
      email,
      otp: capturedEmails[1].otp
    });
    expect(goodVerify.status).toBe(200);
    expect(goodVerify.body.success).toBe(true);
    expect(goodVerify.body.token).toBeDefined();

    // Replay same OTP fails (single-use challenge consumed)
    const replayRes = await request(app).post('/api/auth/login/verify-otp').send({
      challengeId: initRes.body.challengeId,
      email,
      otp: capturedEmails[1].otp
    });
    expect(replayRes.status).toBe(404);
  });

  it('enforces 3-minute OTP expiration limit (180s) and rejects expired codes with 410', async () => {
    OtpMailerService.setTestTransport((payload) => {
      capturedEmails.push(payload);
    });

    const email = `otp_expire_${Date.now()}@syncwave.app`;
    const password = 'StrongPassword#2026';

    await request(app).post('/api/auth/register').send({
      email,
      password,
      displayName: 'Expire Test'
    });

    const initRes = await request(app).post('/api/auth/login/initiate').send({
      email,
      password
    });
    expect(initRes.status).toBe(200);
    expect(initRes.body.expiresInSec).toBe(180);
    const lastEmail = capturedEmails[capturedEmails.length - 1];
    expect(lastEmail.expiresInMinutes).toBe(3);

    // Mock Date.now to simulate 3 minutes and 5 seconds passing
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + (3 * 60 + 5) * 1000;
      const expiredVerify = await request(app).post('/api/auth/login/verify-otp').send({
        challengeId: initRes.body.challengeId,
        email,
        otp: lastEmail.otp
      });
      expect(expiredVerify.status).toBe(410);
      expect(expiredVerify.body.code).toBe('EXPIRED');
    } finally {
      Date.now = originalNow;
    }
  });

  it('POST /api/auth/google strictly rejects forged tokens and reports unconfigured state cleanly', async () => {
    const resUnconf = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'fake.unsigned.google_id_token_payload_123456' });
    expect(resUnconf.status).toBe(503);

    process.env.GOOGLE_CLIENT_ID = '123456-testclient.apps.googleusercontent.com';
    const resForged = await request(app)
      .post('/api/auth/google')
      .send({ credential: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NSJ9.' });
    expect(resForged.status).toBe(401);
  });
});
