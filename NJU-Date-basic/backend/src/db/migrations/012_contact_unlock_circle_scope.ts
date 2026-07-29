import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE contact_unlock_requests
      ADD COLUMN IF NOT EXISTS circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE;

    UPDATE contact_unlock_requests cur
    SET circle_id = source.circle_id
    FROM (
      SELECT
        cur2.id,
        MIN(f.circle_id) AS circle_id
      FROM contact_unlock_requests cur2
      JOIN friendships f
        ON (
          (f.user_a_id = cur2.requester_id AND f.user_b_id = cur2.target_id)
          OR
          (f.user_a_id = cur2.target_id AND f.user_b_id = cur2.requester_id)
        )
      GROUP BY cur2.id
    ) AS source
    WHERE cur.id = source.id
      AND cur.circle_id IS NULL;

    UPDATE contact_unlock_requests cur
    SET circle_id = source.circle_id
    FROM (
      SELECT
        cur2.id,
        MIN(cm1.circle_id) AS circle_id
      FROM contact_unlock_requests cur2
      JOIN circle_members cm1
        ON cm1.user_id = cur2.requester_id
      JOIN circle_members cm2
        ON cm2.user_id = cur2.target_id
       AND cm2.circle_id = cm1.circle_id
      GROUP BY cur2.id
    ) AS source
    WHERE cur.id = source.id
      AND cur.circle_id IS NULL;

    DELETE FROM contact_unlock_requests
    WHERE circle_id IS NULL;

    ALTER TABLE contact_unlock_requests
      ALTER COLUMN circle_id SET NOT NULL;

    DROP INDEX IF EXISTS idx_contact_unlock_requests_target_status_circle;
    CREATE INDEX IF NOT EXISTS idx_contact_unlock_requests_target_status_circle
      ON contact_unlock_requests(target_id, status, circle_id);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP INDEX IF EXISTS idx_contact_unlock_requests_target_status_circle;
    ALTER TABLE contact_unlock_requests
      ALTER COLUMN circle_id DROP NOT NULL;
  `);
}
