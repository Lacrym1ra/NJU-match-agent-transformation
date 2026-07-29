import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  // Step 1: Add message_type column with CHECK constraint
  await db.execute(`
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';
  `);

  // Add CHECK on message_type (inline CHECK doesn't work with ADD COLUMN IF NOT EXISTS on older PG)
  await db.execute(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'direct_messages_message_type_check'
          AND conrelid = 'direct_messages'::regclass
      ) THEN
        ALTER TABLE direct_messages
          ADD CONSTRAINT direct_messages_message_type_check
          CHECK (message_type IN ('text', 'image', 'voice'));
      END IF;
    END $$;
  `);

  // Step 2: Make content nullable
  await db.execute(`
    ALTER TABLE direct_messages
      ALTER COLUMN content DROP NOT NULL;
  `);

  // Step 3: Add media columns
  await db.execute(`
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS image_urls JSONB;
  `);

  await db.execute(`
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS voice_url TEXT;
  `);

  await db.execute(`
    ALTER TABLE direct_messages
      ADD COLUMN IF NOT EXISTS voice_duration_sec INTEGER;
  `);

  // Step 4: Semantic constraints (using DO blocks for idempotency)
  await db.execute(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dm_text_has_content'
      ) THEN
        ALTER TABLE direct_messages
          ADD CONSTRAINT chk_dm_text_has_content
          CHECK (message_type != 'text' OR content IS NOT NULL);
      END IF;
    END $$;
  `);

  await db.execute(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dm_image_has_urls'
      ) THEN
        ALTER TABLE direct_messages
          ADD CONSTRAINT chk_dm_image_has_urls
          CHECK (message_type != 'image' OR (image_urls IS NOT NULL AND jsonb_array_length(image_urls) > 0));
      END IF;
    END $$;
  `);

  await db.execute(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_dm_voice_has_url'
      ) THEN
        ALTER TABLE direct_messages
          ADD CONSTRAINT chk_dm_voice_has_url
          CHECK (message_type != 'voice' OR voice_url IS NOT NULL);
      END IF;
    END $$;
  `);

  // Step 5: Index
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_direct_messages_type
      ON direct_messages(message_type);
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    ALTER TABLE direct_messages
      DROP CONSTRAINT IF EXISTS chk_dm_voice_has_url,
      DROP CONSTRAINT IF EXISTS chk_dm_image_has_urls,
      DROP CONSTRAINT IF EXISTS chk_dm_text_has_content,
      DROP CONSTRAINT IF EXISTS direct_messages_message_type_check;
  `);

  await db.execute(`
    DROP INDEX IF EXISTS idx_direct_messages_type;
  `);

  await db.execute(`
    ALTER TABLE direct_messages
      DROP COLUMN IF EXISTS voice_duration_sec,
      DROP COLUMN IF EXISTS voice_url,
      DROP COLUMN IF EXISTS image_urls;
  `);

  await db.execute(`
    ALTER TABLE direct_messages
      ALTER COLUMN content SET NOT NULL;
  `);

  await db.execute(`
    ALTER TABLE direct_messages
      DROP COLUMN IF EXISTS message_type;
  `);
}
