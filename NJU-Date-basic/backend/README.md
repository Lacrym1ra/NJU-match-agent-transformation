# NJU Match Backend

TypeScript + Express backend service for NJU Match.

## Overview

- Runtime: Node.js 20+
- Framework: Express 5
- Database: PostgreSQL
- Auth: OTP + JWT
- Email: SMTP or Aliyun DirectMail API
- AI: 通义千问 (Qwen via DashScope) (for curator note generation)
- Scheduler: node-cron (weekly matching and reveal)

## Project Layout

```text
backend/
  docs/
    API_REFERENCE.md
    ARCHITECTURE.md
    IMPLEMENTATION_PLAN.md
    SECURITY_BASELINE.md
  src/
    index.ts
    config.ts
    cron/
    db/
    matching/
    middleware/
    routes/
    services/
    utils/
```

## API Base Path

- Base path: `/api/v1`
- Health check: `GET /health`

Main route groups:

- `/api/v1/auth`
- `/api/v1/user`
- `/api/v1/survey`
- `/api/v1/match`
- `/api/v1/admin`

Detailed endpoint docs are in `docs/API_REFERENCE.md`.

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 14+ (16 recommended)

## Quick Start (Local Development)

1. Install dependencies:

```bash
npm ci
```

2. Create local env file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Update required values in `.env`:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_KEY`
- `SMTP_*` fields
- `EMAIL_PROVIDER` and `ALIYUN_DM_*` fields when using Aliyun API
- `DASHSCOPE_API_KEY`

4. Run development server:

```bash
npm run dev
```

Default port is `3000`.

## Build and Run (Production Mode)

```bash
npm run build
npm run start
```

## Scripts

- `npm run dev`: start dev server with watch mode (`tsx watch`)
- `npm run build`: compile TypeScript to `dist/`
- `npm run start`: start compiled app from `dist/index.js`
- `npm run lint`: type-check only (`tsc --noEmit`)
- `npm run seed`: loads question bank module (`src/db/seed.ts`)

## Database Notes

- The app runs DB migrations automatically on startup (`runMigrations`).
- Ensure your `DATABASE_URL` points to a reachable PostgreSQL instance.
- Default local URL in `.env.example`:

```text
postgres://postgres:postgres@localhost:5432/nju_date
```

## Docker

From repository root:

```bash
docker compose up -d --build
```

Backend container:

- Service name: `backend`
- Exposed port: `3000`

Stop stack:

```bash
docker compose down
```

Remove DB volume too:

```bash
docker compose down -v
```

## Security Checklist Before Deployment

- Replace `JWT_SECRET`
- Replace `ADMIN_KEY`
- Restrict CORS via `FRONTEND_URLS`
- Set `TRUST_PROXY=true` if behind reverse proxy
- Configure real SMTP credentials
- Or configure `EMAIL_PROVIDER=aliyun_api` and `ALIYUN_DM_*` credentials
- Configure `DASHSCOPE_API_KEY`
- Rotate all default secrets

## Troubleshooting

### Backend cannot connect to DB

- Verify PostgreSQL is running.
- Verify `DATABASE_URL` is correct.
- Check DB SSL flags (`DB_SSL`) against your environment.

### CORS blocked in browser

- Set `FRONTEND_URLS` to a comma-separated allowlist.
- Example:

```text
FRONTEND_URLS=http://localhost:3001,https://yourdomain.com
```

### Health check verification

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","timestamp":"2026-01-01T00:00:00.000Z"}
```

## Additional Docs

- `docs/API_REFERENCE.md`: endpoint-level request/response examples
- `docs/ARCHITECTURE.md`: system structure and matching design
- `docs/SECURITY_BASELINE.md`: hardening and security baseline
