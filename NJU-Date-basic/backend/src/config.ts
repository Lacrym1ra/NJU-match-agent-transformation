import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { loadSecret } from './utils/secretSource.js';

function toBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

function parseBoundedInteger(envVar: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[envVar];
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`[config] ${envVar} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function parseAllowedOrigins(): string[] {
  const urls = process.env.FRONTEND_URLS;
  if (urls) {
    return urls
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
  }
  return [process.env.FRONTEND_URL || 'http://localhost:3001'];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = nodeEnv === 'development';
const isProduction = nodeEnv === 'production';

function requireSecret(envVar: string, devFallback: string): string {
  const value = process.env[envVar];
  if (value) return value;
  if (!isProduction) return devFallback;
  throw new Error(`[config] ${envVar} must be set in production`);
}

const jwtSecret = requireSecret('JWT_SECRET', 'dev-secret-change-me');
const adminKey = requireSecret('ADMIN_KEY', 'dev-admin-key');
const studentIdPepper = process.env.HEARTBOX_STUDENT_ID_PEPPER || `student-id:${jwtSecret}`;
const contactEncryptionKey = requireSecret('CONTACT_ENCRYPTION_KEY', `contact-encryption:${jwtSecret}`);
const contactBlindIndexKey = requireSecret('CONTACT_BLIND_INDEX_KEY', `contact-blind-index:${jwtSecret}`);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv,
  isDev,

  jwt: {
    secret: jwtSecret,
    expiresIn: '30d',
  },

  realtime: {
    ticketExpiresInSeconds: parseBoundedInteger('REALTIME_TICKET_EXPIRES_SECONDS', 120, 30, 300),
  },

  admin: {
    key: adminKey,
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'NJU Match <noreply@njudate.com>',
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    aliyun: {
      accessKeyId: process.env.ALIYUN_DM_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_DM_ACCESS_KEY_SECRET || '',
      region: process.env.ALIYUN_DM_REGION || 'cn-hangzhou',
      accountName: process.env.ALIYUN_DM_ACCOUNT_NAME || '',
      fromAlias: process.env.ALIYUN_DM_FROM_ALIAS || 'NJU Match',
      replyToAddress: toBoolean(process.env.ALIYUN_DM_REPLY_TO_ADDRESS, false),
    },
  },

  qwen: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    model: process.env.QWEN_MODEL || 'qwen-plus',
  },

  agentLlm: {
    apiKey: loadSecret('LLM_API_KEY'),
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.LLM_MODEL || 'gpt-5.6-terra',
  },

  agentHarness: {
    maxSteps: parseBoundedInteger('AGENT_MAX_STEPS', 6, 1, 20),
    toolTimeoutMs: parseBoundedInteger('AGENT_TOOL_TIMEOUT_MS', 10_000, 100, 60_000),
    duplicateActionLimit: parseBoundedInteger('AGENT_DUPLICATE_ACTION_LIMIT', 2, 1, 10),
    memoryEntries: parseBoundedInteger('AGENT_MEMORY_ENTRIES', 24, 1, 100),
  },

  frontend: {
    allowedOrigins: parseAllowedOrigins(),
    publicUrl: process.env.FRONTEND_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3001',
  },

  support: {
    email: process.env.SUPPORT_EMAIL || 'njumatch@163.com',
  },

  security: {
    trustProxy: toBoolean(process.env.TRUST_PROXY, false),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT || '256kb',
  },

  heartbox: {
    // Used to hash normalized student ids server-side. Defaults to a JWT_SECRET-derived
    // namespace so Heartbox does not require an extra production secret.
    studentIdPepper,
  },

  g2Contacts: {
    encryptionKey: contactEncryptionKey,
    blindIndexKey: contactBlindIndexKey,
  },

  db: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/nju_date',
    ssl: toBoolean(process.env.DB_SSL, false),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

};
