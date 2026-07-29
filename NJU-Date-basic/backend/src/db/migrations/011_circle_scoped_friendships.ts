import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE friendships
      ADD COLUMN IF NOT EXISTS circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE;

    DROP INDEX IF EXISTS idx_friendships_users;
    DROP INDEX IF EXISTS idx_friendships_circle_users;
    DROP INDEX IF EXISTS idx_friendships_user_a_circle;
    DROP INDEX IF EXISTS idx_friendships_user_b_circle;

    INSERT INTO friendships (id, circle_id, user_a_id, user_b_id, created_at)
    SELECT
      gen_random_uuid()::text,
      shared.circle_id,
      f.user_a_id,
      f.user_b_id,
      f.created_at
    FROM friendships f
    JOIN (
      SELECT
        LEAST(cm1.user_id, cm2.user_id) AS user_a_id,
        GREATEST(cm1.user_id, cm2.user_id) AS user_b_id,
        cm1.circle_id
      FROM circle_members cm1
      JOIN circle_members cm2
        ON cm1.circle_id = cm2.circle_id
       AND cm1.user_id < cm2.user_id
    ) AS shared
      ON shared.user_a_id = f.user_a_id
     AND shared.user_b_id = f.user_b_id
    WHERE f.circle_id IS NULL
    ON CONFLICT DO NOTHING;

    DELETE FROM friendships
    WHERE circle_id IS NULL;

    ALTER TABLE friendships
      ALTER COLUMN circle_id SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_circle_users
      ON friendships(circle_id, user_a_id, user_b_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_user_a_circle
      ON friendships(user_a_id, circle_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_user_b_circle
      ON friendships(user_b_id, circle_id);

    ALTER TABLE friend_requests
      ADD COLUMN IF NOT EXISTS circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE;

    UPDATE friend_requests fr
    SET circle_id = shared.circle_id
    FROM (
      SELECT
        fr2.id,
        MIN(cm1.circle_id) AS circle_id
      FROM friend_requests fr2
      JOIN circle_members cm1
        ON cm1.user_id = fr2.sender_id
      JOIN circle_members cm2
        ON cm2.user_id = fr2.receiver_id
       AND cm2.circle_id = cm1.circle_id
      GROUP BY fr2.id
    ) AS shared
    WHERE fr.id = shared.id
      AND fr.circle_id IS NULL;

    DELETE FROM friend_requests
    WHERE circle_id IS NULL;

    DROP INDEX IF EXISTS idx_friend_requests_sender_receiver;
    DROP INDEX IF EXISTS idx_friend_requests_circle_sender_receiver;
    DROP INDEX IF EXISTS idx_friend_requests_receiver_status_circle;

    ALTER TABLE friend_requests
      ALTER COLUMN circle_id SET NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_circle_sender_receiver
      ON friend_requests(circle_id, sender_id, receiver_id)
      WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_status_circle
      ON friend_requests(receiver_id, status, circle_id);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_friend_requests_receiver_status_circle;
    DROP INDEX IF EXISTS idx_friend_requests_circle_sender_receiver;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_requests_sender_receiver
      ON friend_requests(sender_id, receiver_id)
      WHERE status = 'pending';

    ALTER TABLE friend_requests
      ALTER COLUMN circle_id DROP NOT NULL;

    DROP INDEX IF EXISTS idx_friendships_user_b_circle;
    DROP INDEX IF EXISTS idx_friendships_user_a_circle;
    DROP INDEX IF EXISTS idx_friendships_circle_users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_users
      ON friendships(user_a_id, user_b_id);

    ALTER TABLE friendships
      ALTER COLUMN circle_id DROP NOT NULL;
  `);
}
