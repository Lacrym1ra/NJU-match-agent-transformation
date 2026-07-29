import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_circle_custom_cards
      ADD COLUMN IF NOT EXISTS display_order INTEGER;

    UPDATE user_circle_custom_cards AS target
    SET display_order = ordered.display_order
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, circle_id
          ORDER BY created_at ASC, id ASC
        ) - 1 AS display_order
      FROM user_circle_custom_cards
    ) AS ordered
    WHERE target.id = ordered.id
      AND (target.display_order IS NULL OR target.display_order <> ordered.display_order);

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN display_order SET DEFAULT 0;

    UPDATE user_circle_custom_cards
    SET display_order = 0
    WHERE display_order IS NULL;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN display_order SET NOT NULL;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_circle_custom_cards
      DROP COLUMN IF EXISTS display_order;
  `);
}
