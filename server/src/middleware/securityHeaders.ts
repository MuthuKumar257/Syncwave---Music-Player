import { Request, Response, NextFunction } from 'express';

export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking via iframes (except SAMEORIGIN)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Cross-site scripting filter legacy protection
  res.setHeader('X-XSS-Protection', '0');

  // Strict Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict sensitive hardware features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // HTTP Strict Transport Security (HSTS) in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Modern Content Security Policy (allowing YouTube player embeds and assets)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' data: https: blob:",
      "connect-src 'self' https: ws: wss:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "object-src 'none'",
      "base-uri 'self'"
    ].join('; ')
  );

  next();
}
