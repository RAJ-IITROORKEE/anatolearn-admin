# AnatoLearn Phase Status

## Current phase

**Phase 6: Dashboard, feedback, and notifications — complete in code**

Date: 2026-07-14

Phases 0-6 are implemented and all five migrations are current. Phase 7 hardening and
delivery is next. Deployment configuration remains open: the local `CRON_SECRET` is
invalid and `npm run env:check` intentionally fails, while ordinary runtime and builds
remain isolated. Expo may be disabled or misconfigured and has not been verified with
real credentials/devices.

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
  `/api/internal/notifications/process` scheduled every minute.
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
  Both migrations repeat the empty notification-table preflight; all five migrations are
  current.
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

Only documentation files were changed by this documentation task. Application code,
packages, schema, migrations, local environment values, and secrets were not modified.
`.env.example` already accurately lists isolated placeholder-only Expo and cron variables,
so it did not require a change.

## Latest known verification and configuration record

| Command/check | Result |
| --- | --- |
| `npm run prisma:deploy` | Passed; Phase 6 enum and structure migrations deployed |
| Prisma migration status | Current: all five migrations |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 319 tests; 4 conditional PostgreSQL tests skipped in the default run |
| Dedicated Phase 5 PostgreSQL suite | Passed: 4 tests against a migrated isolated schema, including concurrent finalization |
| `npm run build` | Passed |
| `npm run test:e2e` | **Not rerun for Phase 6**; latest prior anonymous result: 3 passed, 1 skipped |
| `npm run env:check` | **Failed** only for invalid local `CRON_SECRET`; intentional deployment gate |
| OpenAPI structural validation | Passed with Swagger CLI: 75 paths, 104 operations, 104 unique operation IDs, 138 component schemas |
| `git diff --check` | Passed; line-ending conversion warnings only |

The default suite skips `features/assessments/postgres.integration.test.ts` unless
`TEST_DATABASE_URL` is set and differs from `DATABASE_URL`. Its four cases previously
passed against a migrated isolated schema. That acceptance run exposed Prisma `P2010`
wrapping PostgreSQL SQLSTATE `40001`/`40P01`; the shared transaction retry now handles
those forms alongside `P2034`. Do not infer a Phase 6 E2E run from the prior anonymous
Playwright result.

## Residual limitations and risks

1. No verified real Expo credential/device integration; provider may be disabled or
   misconfigured.
2. No real PostgreSQL multi-worker notification lease/materialization concurrency test;
   provider acceptance followed by a crash can produce an at-least-once duplicate send.
3. No authenticated Phase 6 Playwright coverage.
4. Production distributed rate limiting is missing; feedback/auth limits are process-local.
5. Managed-media picker and visual lesson editor remain absent.
6. `CRON_SECRET` is still invalid locally. Both scheduled jobs require a valid 32+
   character deployment secret and verified schedules.

## Next phase

**Phase 7: Hardening and delivery.** Verify real Expo and both deployed cron jobs, add
notification-worker PostgreSQL concurrency and authenticated Phase 6 E2E coverage,
install a distributed limiter, and finish the media-picker/visual lesson-editor gaps.

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
- Added question publish/draft, terminal archive, active/inactive, duplicate-to-active-
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

1. No database/provider integration or race suite proves real PostgreSQL transactions,
   Supabase Storage/signed URLs, publication/selection visibility, option replacement,
   bulk atomicity, progress concurrency/idempotency, audit persistence, or media archive
   locking.
2. There is no authenticated CRUD E2E coverage for content, media, flashcards,
   questions, lifecycle, or audit workflows; current Playwright coverage is shell/auth
   focused.
3. Content, flashcard, question, and option forms still accept managed media UUID text
   rather than offering a media picker.
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
