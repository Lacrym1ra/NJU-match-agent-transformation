import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { UnauthorizedError } from '../utils/errors.js';

export interface AuthPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
    }) as Partial<AuthPayload>;

    if (!payload.userId || !payload.email) {
      throw new UnauthorizedError('token 载荷无效');
    }

    req.auth = { userId: payload.userId, email: payload.email };
    next();
  } catch {
    throw new UnauthorizedError('token 无效或已过期');
  }
}
