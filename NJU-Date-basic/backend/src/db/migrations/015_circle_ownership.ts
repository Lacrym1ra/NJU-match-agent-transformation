import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE circles
      ADD COLUMN IF NOT EXISTS creator_id TEXT REFERENCES users(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS circle_member_roles (
      id TEXT PRIMARY KEY,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_member_roles_circle_user_role
      ON circle_member_roles(circle_id, user_id, role);
    CREATE INDEX IF NOT EXISTS idx_circle_member_roles_circle_role
      ON circle_member_roles(circle_id, role);
    CREATE INDEX IF NOT EXISTS idx_circle_member_roles_user
      ON circle_member_roles(user_id);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_circle_member_roles_user;
    DROP INDEX IF EXISTS idx_circle_member_roles_circle_role;
    DROP INDEX IF EXISTS idx_circle_member_roles_circle_user_role;
    DROP TABLE IF EXISTS circle_member_roles CASCADE;
    ALTER TABLE circles
      DROP COLUMN IF EXISTS creator_id;
  `);
}
