import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';
import * as schema from './schema.js';

export const queryClient = postgres(config.db.url, {
  ssl: config.db.ssl ? 'require' : undefined,
  max: config.db.poolMax,
});

export const db = drizzle(queryClient, { schema });
