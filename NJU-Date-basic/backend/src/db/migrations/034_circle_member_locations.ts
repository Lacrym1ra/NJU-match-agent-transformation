import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS circle_member_locations (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      accuracy_meters INT NOT NULL,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      captured_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_locations_circle_user
      ON circle_member_locations(circle_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_circle_member_locations_circle_enabled_expires
      ON circle_member_locations(circle_id, is_enabled, expires_at);
    CREATE INDEX IF NOT EXISTS idx_circle_member_locations_circle_geo
      ON circle_member_locations(circle_id, is_enabled, latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_circle_member_locations_user
      ON circle_member_locations(user_id);

    CREATE TABLE IF NOT EXISTS circle_member_location_cooldowns (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_updated_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO circle_member_location_cooldowns (
      id,
      circle_id,
      user_id,
      last_updated_at,
      created_at,
      updated_at
    )
    SELECT
      circle_id || ':' || user_id,
      circle_id,
      user_id,
      updated_at,
      created_at,
      updated_at
    FROM circle_member_locations
    ON CONFLICT DO NOTHING;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_location_cooldowns_circle_user
      ON circle_member_location_cooldowns(circle_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_circle_member_location_cooldowns_user
      ON circle_member_location_cooldowns(user_id);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_circle_member_location_cooldowns_user;
    DROP INDEX IF EXISTS idx_circle_member_location_cooldowns_circle_user;
    DROP TABLE IF EXISTS circle_member_location_cooldowns;
    DROP INDEX IF EXISTS idx_circle_member_locations_user;
    DROP INDEX IF EXISTS idx_circle_member_locations_circle_geo;
    DROP INDEX IF EXISTS idx_circle_member_locations_circle_enabled_expires;
    DROP INDEX IF EXISTS idx_circle_member_locations_circle_user;
    DROP TABLE IF EXISTS circle_member_locations;
  `);
}
