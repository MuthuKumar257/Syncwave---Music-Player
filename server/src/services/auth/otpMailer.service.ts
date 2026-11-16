import net from 'net';
import tls from 'tls';
import crypto from 'crypto';

export interface OtpEmailPayload {
  to: string;
  displayName: string;
  otp: string;
  purpose: 'LOGIN' | 'SIGNUP' | 'PASSWORD_RESET';
  expiresInMinutes: number;
}

export interface RawEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export type OtpDeliveryResult =
  | { delivered: true; provider: 'SMTP' | 'RESEND' | 'TEST_TRANSPORT' }
  | { delivered: false; reason: 'NOT_CONFIGURED' | 'SEND_FAILED'; error?: string };

export type RawDeliveryResult = OtpDeliveryResult;

type TestTransportHook = (payload: OtpEmailPayload) => Promise<void> | void;

const isTestEnv = () =>
  process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

const isRealEnvValue = (val?: string): val is string => {
  const trimmed = (val || '').trim();
  if (!trimmed) return false;
  if (/^(your-|re_x+|replace_with_)/i.test(trimmed)) return false;
  if (trimmed.includes('your-email@') || trimmed.includes('your-16-char')) return false;
  return true;
};

export class OtpMailerService {
  private static testHook: TestTransportHook | null = null;

  static setTestTransport(hook: TestTransportHook | null): void {
    if (!isTestEnv()) {
      throw new Error('Test OTP transport is strictly restricted to test environments.');
    }
    this.testHook = hook;
  }

  static getDeliveryStatus(): {
    configured: boolean;
    provider: 'RESEND' | 'SMTP' | 'TEST_TRANSPORT' | 'UNCONFIGURED';
  } {
    if (isRealEnvValue(process.env.RESEND_API_KEY)) {
      return { configured: true, provider: 'RESEND' };
    }
    if (
      isRealEnvValue(process.env.SMTP_HOST) &&
      isRealEnvValue(process.env.SMTP_USER) &&
      isRealEnvValue(process.env.SMTP_PASS)
    ) {
      return { configured: true, provider: 'SMTP' };
    }
    if (isTestEnv() && this.testHook) {
      return { configured: true, provider: 'TEST_TRANSPORT' };
    }
    return { configured: false, provider: 'UNCONFIGURED' };
  }

  private static buildEmailContent(payload: OtpEmailPayload): {
    subject: string;
    html: string;
    text: string;
  } {
    const actionLabel =
      payload.purpose === 'SIGNUP'
        ? 'Verify your new SyncWave account'
        : payload.purpose === 'PASSWORD_RESET'
          ? 'Reset your SyncWave password'
          : 'Sign in to SyncWave';
    const subject = `${payload.otp} is your SyncWave verification code`;
    const text = [
      `Hi ${payload.displayName},`,
      '',
      `Your one-time verification code to ${actionLabel.toLowerCase()} is: ${payload.otp}`,
      `This code expires in ${payload.expiresInMinutes} minutes. Do not share it with anyone.`,
      '',
      'If you did not request this code, you can safely ignore this email.',
      '— SyncWave Security'
    ].join('\n');

    const safeName = payload.displayName.replace(/[<>&"']/g, '');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0F0F10; color:#EDEDED; padding:32px; border-radius:12px; max-width:480px; margin:auto; border:1px solid rgba(255,255,255,0.08);">
        <div style="font-size:18px; font-weight:700; color:#F59E0B; margin-bottom:12px;">SyncWave</div>
        <h2 style="font-size:18px; margin:0 0 12px; color:#FFFFFF;">${actionLabel}</h2>
        <p style="font-size:14px; color:#A1A1AA; line-height:1.5; margin:0 0 20px;">
          Hi ${safeName || 'Listener'}, enter the 6-digit verification code below to complete authentication:
        </p>
        <div style="background:#19191B; border:1px solid rgba(245,158,11,0.35); border-radius:10px; padding:18px; text-align:center; letter-spacing:8px; font-size:28px; font-weight:700; font-family:monospace; color:#F59E0B; margin-bottom:20px;">
          ${payload.otp}
        </div>
        <p style="font-size:12px; color:#85858B; line-height:1.5; margin:0;">
          This code expires in ${payload.expiresInMinutes} minutes and can only be used once. If you did not attempt to sign in, change your password immediately.
        </p>
      </div>
    `.trim();

    return { subject, html, text };
  }

  static async sendOtpEmail(payload: OtpEmailPayload): Promise<OtpDeliveryResult> {
    if (isTestEnv() && this.testHook) {
      await this.testHook(payload);
      return { delivered: true, provider: 'TEST_TRANSPORT' };
    }

    const { subject, html, text } = this.buildEmailContent(payload);
    return this.sendRawEmail({ to: payload.to, subject, html, text });
  }

  static async sendRawEmail(payload: RawEmailPayload): Promise<RawDeliveryResult> {
    // 1. Prefer HTTPS Resend API if configured
    if (isRealEnvValue(process.env.RESEND_API_KEY)) {
      try {
        const fromAddress =
          payload.from ||
          (isRealEnvValue(process.env.EMAIL_FROM)
            ? process.env.EMAIL_FROM.trim()
            : 'SyncWave <onboarding@resend.dev>');
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [payload.to],
            subject: payload.subject,
            html: payload.html,
            text: payload.text
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          return { delivered: false, reason: 'SEND_FAILED', error: `Resend API HTTP ${res.status}: ${errText}` };
        }

        return { delivered: true, provider: 'RESEND' };
      } catch (err: any) {
        return { delivered: false, reason: 'SEND_FAILED', error: err?.message || 'Resend delivery failed' };
      }
    }

    // 2. Standard TLS / STARTTLS SMTP transport (Gmail, SES, Outlook, Brevo, SendGrid, etc.)
    const host = isRealEnvValue(process.env.SMTP_HOST) ? process.env.SMTP_HOST.trim() : '';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = isRealEnvValue(process.env.SMTP_USER) ? process.env.SMTP_USER.trim() : '';
    const rawPass = isRealEnvValue(process.env.SMTP_PASS) ? process.env.SMTP_PASS.trim() : '';
    const pass = host.toLowerCase().includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass;
    const from =
      payload.from ||
      (isRealEnvValue(process.env.EMAIL_FROM) ? process.env.EMAIL_FROM.trim() : user);

    if (host && user && pass && from) {
      try {
        await this.sendViaSmtp({
          host,
          port: Number.isFinite(port) ? port : 465,
          user,
          pass,
          from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text
        });
        return { delivered: true, provider: 'SMTP' };
      } catch (err: any) {
        return { delivered: false, reason: 'SEND_FAILED', error: err?.message || 'SMTP delivery failed' };
      }
    }

    return { delivered: false, reason: 'NOT_CONFIGURED' };
  }

  private static async sendViaSmtp(opts: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void> {
    const extractAddr = (raw: string) => {
      const m = raw.match(/<([^>]+)>/);
      return m ? m[1] : raw;
    };

    const boundary = `----=_SyncWave_${crypto.randomBytes(12).toString('hex')}`;
    const messageId = `<${crypto.randomUUID()}@${opts.host}>`;
    const mimeBody = [
      `From: ${opts.from}`,
      `To: ${opts.to}`,
      `Subject: ${opts.subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.text,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      opts.html,
      '',
      `--${boundary}--`,
      '.'
    ]
      .join('\r\n')
      .replace(/\r\n\.(?=\r\n)/g, '\r\n..');

    return new Promise((resolve, reject) => {
      let socket: net.Socket | tls.TLSSocket =
        opts.port === 465
          ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
          : net.connect({ host: opts.host, port: opts.port });

      let buffer = '';
      let closed = false;
      const timeout = setTimeout(() => {
        if (!closed) {
          closed = true;
          socket.destroy();
          reject(new Error('SMTP connection timed out'));
        }
      }, 10000);

      const readResponse = (): Promise<{ code: number; lines: string }> =>
        new Promise((res, rej) => {
          const checkBuffer = () => {
            const parts = buffer.split('\r\n');
            for (let i = 0; i < parts.length - 1; i++) {
              const line = parts[i];
              if (/^\d{3} /.test(line)) {
                const code = parseInt(line.slice(0, 3), 10);
                const full = parts.slice(0, i + 1).join('\r\n');
                buffer = parts.slice(i + 1).join('\r\n');
                cleanup();
                res({ code, lines: full });
                return true;
              }
            }
            return false;
          };

          const onData = (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            checkBuffer();
          };
          const onError = (err: Error) => {
            cleanup();
            rej(err);
          };
          const cleanup = () => {
            socket.off('data', onData);
            socket.off('error', onError);
          };

          if (!checkBuffer()) {
            socket.on('data', onData);
            socket.on('error', onError);
          }
        });

      const sendCommand = async (cmd: string, expectedCodes: number[]) => {
        socket.write(`${cmd}\r\n`);
        const resp = await readResponse();
        if (!expectedCodes.includes(resp.code)) {
          throw new Error(`SMTP command failed (${resp.code}): ${resp.lines}`);
        }
        return resp;
      };

      (async () => {
        try {
          const greeting = await readResponse();
          if (greeting.code !== 220) throw new Error(`SMTP greeting error: ${greeting.lines}`);

          await sendCommand(`EHLO syncwave.local`, [250]);

          if (opts.port !== 465) {
            await sendCommand('STARTTLS', [220]);
            socket = await new Promise<tls.TLSSocket>((resTls, rejTls) => {
              const tlsSock = tls.connect(
                { socket: socket as net.Socket, servername: opts.host },
                () => resTls(tlsSock)
              );
              tlsSock.once('error', rejTls);
            });
            buffer = '';
            await sendCommand(`EHLO syncwave.local`, [250]);
          }

          await sendCommand('AUTH LOGIN', [334]);
          await sendCommand(Buffer.from(opts.user).toString('base64'), [334]);
          await sendCommand(Buffer.from(opts.pass).toString('base64'), [235]);

          await sendCommand(`MAIL FROM:<${extractAddr(opts.from)}>`, [250]);
          await sendCommand(`RCPT TO:<${extractAddr(opts.to)}>`, [250, 251]);
          await sendCommand('DATA', [354]);

          socket.write(`${mimeBody}\r\n`);
          const dataResp = await readResponse();
          if (dataResp.code !== 250) throw new Error(`SMTP DATA rejected: ${dataResp.lines}`);

          await sendCommand('QUIT', [221]).catch(() => {});
          closed = true;
          clearTimeout(timeout);
          socket.end();
          resolve();
        } catch (err) {
          closed = true;
          clearTimeout(timeout);
          socket.destroy();
          reject(err);
        }
      })();
    });
  }
}
