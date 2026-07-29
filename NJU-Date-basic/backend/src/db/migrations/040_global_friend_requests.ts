import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE global_friendships
      ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'circle';

    ALTER TABLE global_friendships
      DROP CONSTRAINT IF EXISTS global_friendships_source_type_check;
    ALTER TABLE global_friendships
      ADD CONSTRAINT global_friendships_source_type_check
      CHECK (source_type IN ('circle', 'global')) NOT VALID;

    ALTER TABLE friend_requests
      ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'circle';
    UPDATE friend_requests
    SET source_type = 'circle'
    WHERE source_type IS NULL;

    ALTER TABLE friend_requests
      ALTER COLUMN circle_id DROP NOT NULL;

    ALTER TABLE friend_requests
      DROP CONSTRAINT IF EXISTS friend_requests_source_type_check;
    ALTER TABLE friend_requests
      ADD CONSTRAINT friend_requests_source_type_check
      CHECK (source_type IN ('circle', 'global')) NOT VALID;

    DROP INDEX IF EXISTS idx_friend_requests_circle_sender_receiver;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_circle_sender_receiver
      ON friend_requests(circle_id, sender_id, receiver_id)
      WHERE status = 'pending' AND source_type = 'circle';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_global_sender_receiver
      ON friend_requests(sender_id, receiver_id)
      WHERE status = 'pending' AND source_type = 'global';

    CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status_source
      ON friend_requests(receiver_id, status, source_type, circle_id);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_friend_requests_receiver_status_source;
    DROP INDEX IF EXISTS idx_friend_requests_global_sender_receiver;
    DROP INDEX IF EXISTS idx_friend_requests_circle_sender_receiver;

    DELETE FROM friend_requests
    WHERE source_type = 'global' OR circle_id IS NULL;

    ALTER TABLE friend_requests
      ALTER COLUMN circle_id SET NOT NULL;
    ALTER TABLE friend_requests
      DROP CONSTRAINT IF EXISTS friend_requests_source_type_check;
    ALTER TABLE friend_requests
      DROP COLUMN IF EXISTS source_type;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_circle_sender_receiver
      ON friend_requests(circle_id, sender_id, receiver_id)
      WHERE status = 'pending';

    ALTER TABLE global_friendships
      DROP CONSTRAINT IF EXISTS global_friendships_source_type_check;
    ALTER TABLE global_friendships
      DROP COLUMN IF EXISTS source_type;
  `);
}
