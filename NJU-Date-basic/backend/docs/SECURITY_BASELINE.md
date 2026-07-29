# NJU Match Security & DB Baseline (10k users)

## 1) Database Architecture Baseline

### Current Stage (now)
- Use PostgreSQL as the primary database in all environments.
- Ensure key indexes exist for hot paths:
  - participant selection: `users(is_participating, profile_complete, survey_complete)`
  - weekly and user match lookups: `matches(week_of, status)`, `matches(user_a_id, created_at)`, `matches(user_b_id, created_at)`
  - OTP lifecycle: `otp_codes(email, created_at)`

### Production Stage (recommended for 10k users)
- Use PostgreSQL managed service.
- Add connection pool (e.g. PgBouncer or driver-level pooling).
- Add regular backups + point-in-time recovery.
- Split environments and secrets:
  - dev/staging/prod independent databases
  - secrets in environment manager, never in repo

### Data Governance
- Keep least data principle:
  - only store required profile fields
  - avoid storing raw sensitive logs
- Add retention policy:
  - OTP and temporary data scheduled cleanup
  - data export and deletion flow for user requests

## 2) Backend Security Baseline

- Strict CORS allowlist only for trusted frontend origins.
- Security headers via Helmet.
- Global API rate limiting + route-level limits for auth/admin.
- JWT verification hardening:
  - fixed algorithm (`HS256`)
  - payload shape validation
- OTP anti-bruteforce:
  - send cooldown
  - verify failure lockout window
- Admin key check:
  - timing-safe comparison
  - dedicated admin route rate limit
- Request body limit to reduce abuse and DoS surface.

## 3) Frontend Anti-Hacking Baseline

- Never trust frontend input; backend validation is source of truth.
- Token handling:
  - if moving to cookie auth, use `HttpOnly + Secure + SameSite`
  - if using bearer token, keep short token lifetime and rotate refresh tokens
- Avoid `dangerouslySetInnerHTML` unless content is sanitized.
- Keep dependencies updated and run periodic vulnerability scans.
- Build with source map strategy suitable for prod (no unnecessary internals exposure).

## 4) Operational Security

- Enable HTTPS everywhere (TLS only).
- Enable WAF/CDN rate limiting in front of API for public traffic.
- Add audit logs for admin operations and security events.
- Add alerts for spikes in:
  - `/auth/send-code`
  - `/auth/verify-code`
  - `/admin/*`

## 5) Immediate Next Milestones

1. Introduce Redis-backed shared rate limiter (for multi-instance deployment).
2. Add OTP cleanup cron (`expires_at < now`) and admin audit table.
3. Start PostgreSQL migration branch with dual-write or migration window plan.
4. Add security test cases (rate limit, auth failure, CORS denial, admin key checks).
