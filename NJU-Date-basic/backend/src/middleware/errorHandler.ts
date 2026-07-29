import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if ((err as any).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: '请求体过大' } });
    return;
  }

  if (err instanceof AppError) {
    const retryAt = (err as AppError & { retryAt?: string }).retryAt;
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(retryAt && { retryAt }),
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误',
    },
  });
}
