import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS card_modules (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL CHECK(category IN ('basic','contact','interests','game')),
      is_system BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      modules JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_cards
      ALTER COLUMN modules TYPE JSONB
      USING CASE
        WHEN modules IS NULL OR btrim(modules::text, '"') = '' THEN '[]'::jsonb
        ELSE modules::jsonb
      END;
    ALTER TABLE user_cards
      ALTER COLUMN modules SET DEFAULT '[]'::jsonb;

    CREATE TABLE IF NOT EXISTS circle_card_overrides (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      overrides JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    ALTER TABLE circle_card_overrides
      ALTER COLUMN overrides TYPE JSONB
      USING CASE
        WHEN overrides IS NULL OR btrim(overrides::text, '"') = '' THEN '{}'::jsonb
        ELSE overrides::jsonb
      END;
    ALTER TABLE circle_card_overrides
      ALTER COLUMN overrides SET DEFAULT '{}'::jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_circle_card_overrides_user_circle ON circle_card_overrides(user_id, circle_id);

    CREATE TABLE IF NOT EXISTS base_card_components (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_key TEXT
    );

    CREATE TABLE IF NOT EXISTS user_base_cards (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      components JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_base_cards
      ALTER COLUMN components TYPE JSONB
      USING CASE
        WHEN components IS NULL OR btrim(components::text, '"') = '' THEN '[]'::jsonb
        ELSE components::jsonb
      END;
    ALTER TABLE user_base_cards
      ALTER COLUMN components SET DEFAULT '[]'::jsonb;

    CREATE TABLE IF NOT EXISTS user_circle_cards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      circle_id TEXT NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      components JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE user_circle_cards
      ALTER COLUMN components TYPE JSONB
      USING CASE
        WHEN components IS NULL OR btrim(components::text, '"') = '' THEN '[]'::jsonb
        ELSE components::jsonb
      END;
    ALTER TABLE user_circle_cards
      ALTER COLUMN components SET DEFAULT '[]'::jsonb;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_circle_cards_user_circle ON user_circle_cards(user_id, circle_id);

    -- Insert Seed Data for card_modules
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM card_modules) THEN
        INSERT INTO card_modules (id, key, name, description, category, is_system) VALUES 
        (gen_random_uuid()::text, 'display_name', '昵称', '你的显示名称', 'basic', true),
        (gen_random_uuid()::text, 'grade', '年级', '你所在的年级', 'basic', true),
        (gen_random_uuid()::text, 'campus', '校区', '你所在的校区', 'basic', true),
        (gen_random_uuid()::text, 'department', '院系', '你所在的院系', 'basic', true),
        (gen_random_uuid()::text, 'bio', '个人简介', '简短介绍自己', 'basic', true),
        
        (gen_random_uuid()::text, 'contact_wechat', '微信', '微信号', 'contact', false),
        (gen_random_uuid()::text, 'contact_qq', 'QQ', 'QQ号', 'contact', false),
        (gen_random_uuid()::text, 'contact_email', '邮箱', '常用邮箱', 'contact', false),
        (gen_random_uuid()::text, 'contact_xiaohongshu', '小红书', '小红书号', 'contact', false),
        
        (gen_random_uuid()::text, 'hobbies', '兴趣爱好', '平时的爱好', 'interests', false),
        (gen_random_uuid()::text, 'music', '喜欢的音乐', '常听的音乐类型或歌手', 'interests', false),
        (gen_random_uuid()::text, 'games', '玩的游戏', '常玩的游戏', 'interests', false),
        (gen_random_uuid()::text, 'movies', '喜欢的电影', '电影偏好', 'interests', false),
        
        (gen_random_uuid()::text, 'gaming_title', '游戏名称', '主玩游戏', 'game', false),
        (gen_random_uuid()::text, 'gaming_rank', '游戏段位', '当前游戏段位', 'game', false),
        (gen_random_uuid()::text, 'gaming_role', '游戏位置', '常玩位置/职业', 'game', false),
        (gen_random_uuid()::text, 'gaming_kd', '游戏战绩', 'KDA或胜率', 'game', false);
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM base_card_components) THEN
        INSERT INTO base_card_components (id, key, name, source_type, source_key) VALUES
        (gen_random_uuid()::text, 'grade', '年级', 'user_profile', 'users.grade'),
        (gen_random_uuid()::text, 'campus', '校区', 'user_profile', 'users.campus'),
        (gen_random_uuid()::text, 'department', '院系', 'user_profile', 'users.department'),
        (gen_random_uuid()::text, 'mbti', 'MBTI', 'user_profile', 'users.mbti'),
        (gen_random_uuid()::text, 'bio', '个人简介', 'user_profile', 'users.bio');
      END IF;
    END $$;
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    DROP TABLE IF EXISTS user_circle_cards CASCADE;
    DROP TABLE IF EXISTS user_base_cards CASCADE;
    DROP TABLE IF EXISTS base_card_components CASCADE;
    DROP TABLE IF EXISTS circle_card_overrides CASCADE;
    DROP TABLE IF EXISTS user_cards CASCADE;
    DROP TABLE IF EXISTS card_modules CASCADE;
  `);
}
