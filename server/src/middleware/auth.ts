import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const envJwtSecret = process.env.JWT_SECRET?.trim();
if (process.env.NODE_ENV === 'production' && !envJwtSecret) {
  console.warn(
    '[SyncWave Auth] SECURITY WARNING: JWT_SECRET environment variable is not set in production.'
  );
}

export const JWT_SECRET = envJwtSecret || 'syncwave-super-secret-jwt-key-2026';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  // Security Hardening (Critical C1): In production or live server runs, never trust unauthenticated
  // client-supplied 'x-user-id' headers. Only accept 'x-user-id' when running in an automated test suite.
  const isTestRunner = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (isTestRunner) {
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    if (headerUserId) {
      req.userId = headerUserId;
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
    } catch {
      // Non-blocking for optional auth
    }
  }
  next();
}

