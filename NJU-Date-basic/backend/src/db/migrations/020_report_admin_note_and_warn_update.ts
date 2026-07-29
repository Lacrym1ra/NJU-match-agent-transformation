import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export async function up(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- 1. 加 admin_note 列（已在生产库手动执行过，IF NOT EXISTS 保证幂等）
    ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS admin_note TEXT;

    -- 2. 更新 status CHECK 约束，加入 warn_update
    --    旧约束由 migrate.ts 内联创建，名称由 PostgreSQL 自动生成，用 pg_constraint 查找后删除
    DO $$
    DECLARE
      constraint_name text;
    BEGIN
      SELECT con.conname INTO constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'user_reports'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%reviewed%'
        AND pg_get_constraintdef(con.oid) ILIKE '%dismissed%';

      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE user_reports DROP CONSTRAINT %I', constraint_name);
      END IF;
    END $$;

    -- 3. 加入新约束（包含 warn_update）
    ALTER TABLE user_reports DROP CONSTRAINT IF EXISTS user_reports_status_check;
    ALTER TABLE user_reports
      ADD CONSTRAINT user_reports_status_check
      CHECK (status IN ('pending', 'reviewed', 'warn_update', 'dismissed'));
  `);
}

export async function down(db: PostgresJsDatabase<any>) {
  await db.execute(`
    -- 回滚：将 warn_update 改回 reviewed，再恢复旧约束
    UPDATE user_reports SET status = 'reviewed' WHERE status = 'warn_update';

    ALTER TABLE user_reports DROP CONSTRAINT IF EXISTS user_reports_status_check;
    ALTER TABLE user_reports
      ADD CONSTRAINT user_reports_status_check
      CHECK (status IN ('pending', 'reviewed', 'dismissed'));

    ALTER TABLE user_reports DROP COLUMN IF EXISTS admin_note;
  `);
}
