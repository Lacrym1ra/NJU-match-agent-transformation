import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_circle_custom_cards
      ADD COLUMN IF NOT EXISTS top_left_x INTEGER;

    ALTER TABLE user_circle_custom_cards
      ADD COLUMN IF NOT EXISTS top_left_y INTEGER;

    ALTER TABLE user_circle_custom_cards
      ADD COLUMN IF NOT EXISTS width INTEGER;

    ALTER TABLE user_circle_custom_cards
      ADD COLUMN IF NOT EXISTS height INTEGER;

    UPDATE user_circle_custom_cards
    SET
      top_left_x = CASE WHEN visibility_level = 'hidden' THEN -1 ELSE 0 END,
      top_left_y = CASE WHEN visibility_level = 'hidden' THEN -1 ELSE display_order END,
      width = CASE WHEN visibility_level = 'hidden' THEN -1 ELSE 1 END,
      height = CASE WHEN visibility_level = 'hidden' THEN -1 ELSE 1 END
    WHERE top_left_x IS NULL
       OR top_left_y IS NULL
       OR width IS NULL
       OR height IS NULL;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN top_left_x SET DEFAULT 0;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN top_left_y SET DEFAULT 0;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN width SET DEFAULT 1;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN height SET DEFAULT 1;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN top_left_x SET NOT NULL;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN top_left_y SET NOT NULL;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN width SET NOT NULL;

    ALTER TABLE user_circle_custom_cards
      ALTER COLUMN height SET NOT NULL;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE user_circle_custom_cards
      DROP COLUMN IF EXISTS top_left_x;

    ALTER TABLE user_circle_custom_cards
      DROP COLUMN IF EXISTS top_left_y;

    ALTER TABLE user_circle_custom_cards
      DROP COLUMN IF EXISTS width;

    ALTER TABLE user_circle_custom_cards
      DROP COLUMN IF EXISTS height;
  `);
}
