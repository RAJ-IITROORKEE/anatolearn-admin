# AnatoLearn Setup Guide

This guide describes the implemented Phase 7 repository. Use Node.js 20.19 or newer,
npm, Supabase (PostgreSQL, Auth, and private Storage), and a Vercel-compatible Next.js
deployment. Never commit `.env.local` or print credentials.

## 1. Supabase project

Collect the project URL, modern publishable key, server-only secret key, database
password, pooled runtime connection string, and direct/session migration connection.

- `DATABASE_URL`: pooled Supavisor connection used by Prisma at runtime.
- `DIRECT_URL`: direct/session connection used by Prisma Migrate.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe
  Auth configuration.
- `SUPABASE_SECRET_KEY`: server only; never prefix it with `NEXT_PUBLIC_`.

The application tables are server/Prisma-only. Migrations enable RLS and revoke direct
table access from Supabase `anon` and `authenticated`; do not add permissive application-
table policies for browser/mobile clients. Auth and Storage remain Supabase integrations.

## 2. Authentication

Enable email/password Auth. Configure:

- site URL: `http://localhost:3000` locally;
- callback: `http://localhost:3000/auth/callback`;
- password reset: `http://localhost:3000/reset-password`;
- equivalent allowlisted production URLs before deployment.

Admin web sessions use secure SSR cookies. Native Expo clients send a verified Supabase
access token as `Authorization: Bearer <token>`. Native requests do not require browser
CORS; no application CORS variable exists. CORS is not an authorization control.

## 3. Private Storage

Create a **private** bucket named `anatomy-media`. Do not make it public. Configure an
8 MB limit and allow PNG, JPEG, and WebP. The application validates image bytes,
dimensions, MIME agreement, and required alt text, then serves short-lived signed URLs.

Use these exact settings in `.env.local`:

```dotenv
SUPABASE_STORAGE_BUCKET="anatomy-media"
SUPABASE_STORAGE_MAX_FILE_MB="8"
SUPABASE_STORAGE_ALLOWED_MIME_TYPES="image/png,image/jpeg,image/webp"
SUPABASE_STORAGE_VISIBILITY="private"
```

## 4. Environment

```powershell
Copy-Item .env.example .env.local
```

Replace every required placeholder. Important server-only values are `DATABASE_URL`,
`DIRECT_URL`, `SUPABASE_SECRET_KEY`, bootstrap credentials, and `CRON_SECRET`.
`CRON_SECRET` must be a non-placeholder random value of at least 32 characters before
scheduled jobs are deployed.

Production also requires both variables below. They must be paired; development/test may
leave both blank to use the bounded in-memory limiter.

```dotenv
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

Expo is optional at startup. Real delivery requires `EXPO_PUSH_ENABLED="true"` and a
valid `EXPO_ACCESS_TOKEN`. Do not mark delivery ready until ticket, receipt, partial
outcome, and `DeviceNotRegistered` behavior have been exercised on real EAS devices.

## 5. Install, migrate, seed, and run

```bash
npm install
npm run env:check
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
npm run admin:bootstrap
npm run dev
```

`prisma:deploy` uses `prisma migrate deploy`; use it for controlled deployment rather
than creating migration history in production. Seven migrations are current in the
configured development database. The final two enable RLS/revoke direct application-
table access and restrict schema creation for `anon`/`authenticated`.

The seed is idempotent and **non-destructive**: canonical records are created only when
missing (`upsert` with empty updates), so repeated runs do not overwrite editorial work.
Seeded anatomy material is draft/demo academic content and requires qualified review
before publication.

`admin:bootstrap` finds an existing Auth user or creates one when a 12+ character
temporary password is supplied, then links an active `ADMIN` profile. It compensates by
deleting a newly created Auth user if profile persistence fails. Rotate the temporary
password and remove `ADMIN_BOOTSTRAP_PASSWORD` after successful production bootstrap.

## 6. Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run openapi:validate
npm run build
npm run test:e2e
```

Install Chromium once with `npx playwright install chromium`. Set `TEST_DATABASE_URL` to
a migrated, isolated non-production database to run the assessment and direct-role
PostgreSQL tests. It must not be the normal `DATABASE_URL`. Set `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` to run authenticated admin projects; without them those tests skip.

The current local `npm run env:check` fails only because `CRON_SECRET` is invalid. Do not
weaken validation; install a valid secret.

## 7. Deployment, backup, and rollback

1. Take and verify a recoverable database backup before migration.
2. Configure production Supabase URLs/keys, private bucket, redirects, random 32+
   `CRON_SECRET`, and both Upstash variables.
3. Run `npm run prisma:deploy` as a controlled deployment step.
4. Deploy the application, then verify `/api/health`, admin login, private media, and one
   representative read/write workflow.
5. Verify both Vercel cron jobs invoke every minute:
   `/api/internal/attempts/expire` and `/api/internal/notifications/process`.
6. Confirm server secrets do not appear in browser bundles or logs.

For rollback, roll back the application release first. Do not edit or delete applied
migration files and do not run `prisma migrate reset`. Restore from the verified backup
when a database rollback is required, then reconcile migration state before redeploying.
The Phase 7 RLS/revoke migrations are verified in development and isolated role tests,
not claimed as deployed in production.

## 8. Outstanding external gates

- install a valid deployment `CRON_SECRET` and verify both Vercel schedules;
- provision and verify production Upstash credentials;
- configure a real Expo access token and test EAS devices through ticket, receipt,
  partial, and `DeviceNotRegistered` outcomes;
- provide E2E admin credentials and run authenticated flows;
- test real Supabase Auth email/redirect and private Storage provider integration;
- execute backup/restore rehearsal and production deployment;
- optionally configure Sentry or equivalent monitoring.

Repository Phase 7 is complete, but these gates prevent a claim of full production
deployment readiness.
