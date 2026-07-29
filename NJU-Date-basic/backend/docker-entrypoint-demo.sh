#!/bin/sh
set -e

echo "═══════════════════════════════════════════"
echo "  G3 演示环境启动"
echo "═══════════════════════════════════════════"

echo "⏳ 等待 PostgreSQL 就绪..."
until pg_isready -h postgres -U postgres -d nju_date; do sleep 2; done
echo "✓ PostgreSQL 已就绪"

echo "📝 运行数据库迁移 + 导入 G3 演示数据..."
npx tsx src/db/seedForumDemo.ts

echo "🚀 启动后端服务..."
exec npm run dev
