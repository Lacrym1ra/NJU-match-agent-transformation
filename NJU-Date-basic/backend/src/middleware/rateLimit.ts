import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试',
    },
  },
});

export const authSendCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '验证码发送过于频繁，请稍后再试',
    },
  },
});

export const authVerifyCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '验证码校验过于频繁，请稍后再试',
    },
  },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '管理员请求过于频繁，请稍后再试',
    },
  },
});

export const heartboxSignalMinuteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '操作过于频繁，请稍后再试',
    },
  },
});

// 单用户 unread-count 轮询限流：1 分钟最多 5 次
export const notificationUnreadCountLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '未读数查询过于频繁，请稍后再试',
    },
  },
});

// 管理员广播限流：10 分钟最多 3 次
export const notificationBroadcastLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: '广播操作过于频繁，请稍后再试',
    },
  },
});
