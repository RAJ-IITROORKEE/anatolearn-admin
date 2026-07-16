# AnatoLearn Phase Status

## Current phase

**Phase 7: Hardening and delivery — repository implementation complete; external gates open**

Date: 2026-07-15

Phases 0-7 are implemented and all ten migrations are current in the configured
development database. The product is not claimed as fully deployed or production-ready.
`npm run env:check` passes locally. The production Vercel project now has a free Upstash
resource; the adapter accepts its standard `KV_REST_API_*` credentials as well as the
self-managed `UPSTASH_REDIS_REST_*` pair. Provider, authenticated E2E, backup/restore,
cron, and production deployment acceptance remain external gates.

## Phase 7 completed repository work

- Enforced exact configured-origin CSRF checks for cookie mutations; bearer-native Expo
  clients do not need browser CORS, and the unused CORS variable was removed.
- Added request-nonce CSP, global frame/MIME/referrer/permissions headers, production-only
  HSTS, `noindex` metadata/robots, and tests for browser security responses.
- Standardized `X-Request-ID`, private `no-store` plus `Vary: Authorization, Cookie`, and
  explicit public health/meta caches; added strict response-header/privacy tests.
- Added structured redacted unexpected-error logging containing only safe correlation and
  classification fields.
- Added an Upstash REST distributed rate-limiter adapter. Paired credentials are required
  by production validation; development/test has a bounded memory fallback. Auth uses
  independent client/account quotas; feedback/device/password hooks use server-derived IDs.
- Added compatibility with Vercel Upstash's standard `KV_REST_API_URL` and
  `KV_REST_API_TOKEN` names after production login correctly failed closed before reaching
  Supabase when only those integration-managed variables were present.
- Corrected production Supabase Auth URLs and routed password recovery through the server
  callback before the reset form so hosted recovery no longer falls back to localhost or
  reaches the form without an exchanged recovery session.
- Enabled RLS and revoked Supabase client-role access on Prisma's migration metadata table
  after the production security advisor identified it as publicly readable.
- Obfuscated existing-account registration responses and added newly-created Auth-user
  compensation when profile provisioning fails.
- Classified permanent Expo HTTP/shape failures so claimed deliveries fail immediately;
  transient network/429/5xx failures retain bounded retry behavior.
- Updated Prisma client/CLI to 6.19.3, removing the previous high audit finding. Current
  audit result is zero high/critical; two moderate PostCSS findings through Next.js remain.
  No safe stable fix exists, and force remediation would downgrade Next.js to 9, so it was
  not used.
- Added/deployed `20260714130000_deny_direct_application_database_access` and
  `20260714131000_restrict_application_schema_access` to configured development. They
  enable RLS/revoke direct application access for Supabase client roles and restrict
  schema creation. Isolated role tests prove denied reads/writes and retained Prisma access.
- Replaced raw lesson JSON editing with a visual editor for all seven block types,
  validated learner preview, duplication/reordering, delete confirmation, and dirty guard.
- Replaced resource-form managed-media selection with direct image uploads for system,
  topic, lesson, flashcard, question, and option forms; the Media Library remains the
  searchable/paginated asset-management surface.
- Completed accessibility/responsive fixes across password toggles, pagination, dialogs,
  breadcrumbs, tables, labels, overflow, metadata, and robots; established axe-enabled
  public and credential-gated authenticated Playwright coverage.
- Reconciled OpenAPI to all 108 implemented route operations with unique IDs, strict
  empty-body, rate-limit, privacy, response-header, and route-parity tests.
- Made canonical seeding create-if-missing/non-destructive and added tested bootstrap
  find/create/compensation/redaction behavior. Seeded anatomy content remains draft/demo
  material requiring academic review before publication.
- Added recoverable Trash for six resource types, database-clock 30-day restore windows,
  DRAFT-only restore, Settings > Trash, leaf-first dependency-aware purge, protected
  daily cron, and retrying `MediaPurgeJob` storage cleanup. Attempts, progress, audits,
  and notification evidence are preserved; legacy ARCHIVED rows without Trash metadata
  are not auto-purged. Normal editor block deletion remains separate and confirmed.
- Updated final README, setup, architecture, API, security, testing, plan, status, and
  machine-readable contract documentation from inspected code and diffs.

Only documentation files were changed by this documentation task. Application code,
packages, migrations, `.env.example`, local secret values, and provider configuration
were not modified.

## Final verification record

| Command/check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 139 files, 3 skipped; 445 tests, 13 skipped |
| Isolated `TEST_DATABASE_URL` | Passed: 2 files/9 tests (4 assessment lifecycle + 5 direct DB access) |
| `npm run build` | Passed: 42 static-generation units under nonce dynamic CSP output; all routes |
| `npm run test:e2e` | 17 passed, 14 skipped |
| `npm run openapi:validate` | Passed: 108 operations, 108 unique operation IDs, exact route parity |
| `npm run prisma:deploy` / status | Passed; 10 migrations current, including `20260714141000_add_safe_trash` and `20260715151000_secure_prisma_migration_metadata` |
| `npm audit` | 0 high/critical; 2 moderate PostCSS-through-Next findings remain |
| `npm run env:check` | Passed locally; production deployment values remain an external gate |
| `git diff --check` | Passed; line-ending notices only |

The isolated PostgreSQL Trash suite passed 4/4. The default conditional database run
skips it when `TEST_DATABASE_URL` is not configured. Production gates remain external:
valid deployment `CRON_SECRET`, daily cron verification, production RLS verification,
real Supabase Storage purge, and authenticated E2E.

The 17 Playwright passes cover desktop/mobile public, security, and accessibility checks.
Authenticated admin tests were skipped because `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` were absent. The 14 skips are auth setup, 12 authenticated tests,
and one existing intentional skip; do not imply authenticated flows passed.

## External gates and risks

1. Install a valid random 32+ character deployment `CRON_SECRET`, configure the Vercel
   daily cron and GitHub Actions scheduler secrets, and verify both workers.
2. Provision and verify paired Upstash production credentials.
3. Configure a real Expo access token and exercise EAS devices through ticket, receipt,
   partial, and `DeviceNotRegistered` outcomes. The at-least-once crash window remains.
4. Supply admin E2E credentials and run all authenticated desktop/mobile flows.
5. Test real Supabase Auth email/redirect and private Storage integration.
6. Rehearse backup/restore and complete production deployment. Phase 7 RLS is deployed to
   configured development and isolated tested, not claimed in production.
7. Optional Sentry/monitoring remains unconfigured.

## Continuation point

Phase 7 repository implementation is complete. Continue with external deployment
acceptance above; do not claim full production readiness until those gates pass.

## Phase 6 historical record

## Phase 6 completed implementation

- Replaced the placeholder dashboard with `GET /api/v1/admin/dashboard` and `/dashboard`:
  strict 7/30/90-day UTC trends, learner/content/feedback/attempt counts, all-time
  question-weighted accuracy, explicit content-readiness denominators/criteria, and safe
  bounded recent registrations, feedback, and audit activity.
- Added learner-only `GET /api/v1/admin/users`, `GET/PATCH /api/v1/admin/users/{id}`, and
  `/users`, `/users/[id]`. Search/filter/sort/pagination and activity/device summaries are
  real. Deactivation preserves history, disables active tokens, cancels pending
  deliveries, and audits the state change; activation does not reactivate old tokens.
- Added `POST /api/v1/feedback`, `GET /api/v1/feedback/mine`, admin list/detail/update,
  and `/feedback`, `/feedback/[id]`. Learner DTOs exclude internal data; admin review/
  resolve attribution is server-derived; audits redact message/notes/PII. Submission is
  process-limited to five attempts per user per minute.
- Added strict device-token ownership/reassignment and cancellation behavior without
  exposing token text in DTOs.
- Added notification campaign list/create/detail/update/schedule/cancel/send, provider
  status, recipient/delivery evidence, learner list/read, and `GET`/`POST
  `/api/internal/notifications/process` triggered approximately every ten minutes by the
  GitHub Actions scheduler.
- Isolated provider environment parsing. Drafting/scheduling work while Expo is disabled;
  send returns `503` before mutation when not ready, and the authorized worker returns
  zero work without mutation.
- Added immutable one-time audience/token materialization, campaign/delivery leases,
  `SKIP LOCKED` claims, five-attempt backoff, delayed receipt polling, 20-poll/23-hour
  receipt limits, and explicit at-least-once crash-window documentation.
- Implemented truthful evidence: provider acceptance is `TICKETED`; only receipts produce
  delivery `SENT`; campaigns remain `PROCESSING` then finalize `SENT`, `PARTIAL`, or
  `FAILED`. Tokens, token snapshots, receipt IDs/messages, leases, and credentials are
  absent from API and audit DTOs.
- Added `/notifications`, `/notifications/new`, `/notifications/[id]` with responsive
  table/card views, pagination, provider-disabled states, preview, confirmations,
  pending/success/error/empty/loading states, accessible labels, and dirty navigation/
  before-unload protection.
- Deployed Phase 6 in two migrations: enum labels first, then dependent structure. This
  split is required by PostgreSQL's rule that new enum values must commit before use.
  Both migrations repeat the empty notification-table preflight; five migrations were
  current at the Phase 6 close.
- Updated README, architecture, API/OpenAPI, security, testing, implementation plan, and
  this status from inspected code/routes/tests/schema/migrations.

## Phase 6 primary files and routes

- `features/admin-dashboard/`, `features/users/`, `features/feedback/`,
  `features/notifications/`
- `components/dashboard/`, `components/phase6/`, `components/notifications/`
- `app/(admin)/dashboard/`, `users/`, `feedback/`, `notifications/`
- `app/api/v1/admin/dashboard/`, `admin/users/`, `admin/feedback/`,
  `admin/notifications/`
- `app/api/v1/feedback/`, `app/api/v1/notifications/`,
  `app/api/v1/me/device-tokens/`
- `app/api/internal/notifications/process/`, `vercel.json`
- `prisma/migrations/20260714120000_add_phase6_feedback_notification_foundation/`
- `prisma/migrations/20260714121000_add_phase6_feedback_notification_structure/`

## Phase 4 completed items

- Added strict flashcard schemas, admin DTOs/services/routes, paginated search and
  filters, topic-scoped reorder, create/read/update, individual status/archive, and
  atomic bulk lifecycle operations.
- Added authenticated `GET /api/v1/topics/{id}/flashcards`. It returns only published
  cards under a published topic/active published system with unarchived media, ordered
  by display order/ID and joined to the requesting user's progress.
- Added same-user `PUT /api/v1/flashcards/{id}/progress` with cookie-origin protection,
  serializable transactions, retry handling, event UUID idempotency, one-time view
  increments, and difficult/mastered flags.
- Added quiz/test question admin CRUD with strict atomic 2-6 option aggregates and
  exactly one correct answer. Replacement validates option ownership, preserves IDs/
  stable keys where supplied, and regenerates contiguous `A`-onward labels/order.
- Added question publish/draft, recoverable Trash, active/inactive, duplicate-to-active-
  draft, and atomic bulk status APIs/workflows. Stored option aggregates fail closed if
  cardinality, correctness, labels, or ordering are invalid.
- Added admin question filters for assessment type, topic/system, difficulty, status,
  activity, concept tag, text search, sorting, and pagination.
- Kept the question bank private by design. `features/questions/selection-service.ts`
  is an internal assessment-engine boundary that admits only published active,
  parent/media/option-eligible questions; no public question route was added.
- Integrated flashcard sides, active published questions, and question options into
  signed published-media eligibility and archive-reference blocking.
- Added responsive protected UI routes with flashcard grid/list and front/back preview;
  separate text-and-color quiz/test lists; filters/pagination/bulk status; dynamic
  answer option editing; correct-answer selection; question preview; duplicate,
  activity, lifecycle, success/error/pending, empty, loading, and confirmation states.
- Expanded the idempotent seed with four draft flashcards and ten draft questions with
  four options for each of `QUIZ` and `TEST`.
- Added and applied migration `20260713024000_add_phase4_content_indexes` for flashcard
  media/list and question media/list query paths.
- Updated README, architecture, API, OpenAPI, security, testing, implementation plan,
  and phase status to match implemented behavior.

## Primary files, routes, and migration

- `features/flashcards/`, `features/questions/`
- `components/flashcards/`, `components/questions/`, `components/admin/bulk-action-form.tsx`
- `app/(admin)/flashcards/`, `app/(admin)/questions/`, `app/(admin)/phase4-actions.ts`
- `app/api/v1/admin/flashcards/`, `app/api/v1/admin/questions/`
- `app/api/v1/topics/[id]/flashcards/`, `app/api/v1/flashcards/[id]/progress/`
- `prisma/migrations/20260713024000_add_phase4_content_indexes/migration.sql`

No application code, migrations, dependencies, environment files, or secrets were
changed by the Phase 4 documentation task.

## Authentication, origin, audit, and errors

- Admin UI/APIs require verified Supabase identity plus active database `ADMIN`; learner
  flashcard routes require any active profile. Role, actor, and progress owner are
  always server-derived.
- Cookie mutations require safe same-origin headers; bearer clients do not depend on
  Origin. CORS is not authorization.
- Phase 4 mutation and audit writes share Prisma transactions. Audits record actor,
  request ID, action, before/after snapshots, and API user agent where supplied. No-op
  status/activity operations avoid duplicate audit entries.
- Strict Zod failures are `400`; missing/inactive identity `401`; role or unsafe origin
  `403`; absent/inaccessible records `404`; lifecycle/parent/idempotency conflicts
  `409`; parent/media/option-reference and aggregate domain failures `422`; unexpected
  or invalid stored aggregate failures are safe generic `500` responses.

## Final verification record

| Command | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 37 files, 117 tests |
| `npm run db:seed` | Passed |
| `npm run prisma:deploy` | Passed; applied `20260713024000_add_phase4_content_indexes` |
| `npm run build` | Passed: 68 listed routes; 45 generated static-page units |
| `npm run test:e2e` | Passed: 3 passed, 1 skipped |
| OpenAPI structural validation | Passed |

The documentation task structurally revalidated `docs/openapi.yaml`; the other exact
results above are the final Phase 4 implementation verification record supplied for
this update.

## Phase 4 residual limitations and risks (historical record)

The following statements describe the Phase 4 close and are superseded where Phase 7
completion above records later work.

1. No database/provider integration or race suite proves real PostgreSQL transactions,
   Supabase Storage/signed URLs, publication/selection visibility, option replacement,
   bulk atomicity, progress concurrency/idempotency, audit persistence, or media archive
   locking.
2. There is no authenticated CRUD E2E coverage for content, media, flashcards,
   questions, lifecycle, or audit workflows; current Playwright coverage is shell/auth
   focused.
3. Direct file upload replacement is implemented for content, flashcard, question, and
   option forms; the Media Library remains available for asset management.
4. There is no public question API by design. Questions are reserved for internal
   assessment selection and the Phase 5 attempt engine.
5. The rate limiter remains in-memory/process-local and unsuitable as a distributed
   production control. Phase 3/4 content routes have no dedicated rate-limit hook.
6. The lesson editor remains a validated JSON textarea; published DTOs still require
   separate authenticated media resolution for managed IDs.
7. Admin list UIs expose useful but not every API filter/sort; question list UI does not
   expose organ-system/concept-tag filters even though the API supports them.

## Phase 4 continuation point (historical record)

**Phase 5: Assessment engine and progress.** Implement multi-topic quiz/test starts,
randomized stable question snapshots, answers, server expiry, idempotent submission and
scoring, results, retakes, attempt lists/details, derived topic progress, strengths/
weaknesses, and the personal dashboard API according to the authoritative plan.
