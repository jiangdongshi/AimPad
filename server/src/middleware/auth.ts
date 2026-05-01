import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; username: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as {
      id: number;
      email: string;
      username: string;
    };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '令牌无效或已过期' });
  }
}
