# AnatoLearn Phase Status

## Current phase

**Phase 5: Assessment engine and progress — implementation complete; configuration gate open**

Date: 2026-07-14

Phases 0-4 remain complete. Phase 6 (dashboard, feedback, and notifications) is next per
`MASTER_BUILD_PROMPT.md` and `docs/IMPLEMENTATION_PLAN.md`. Phase 5 is not deployment-
complete until a valid `CRON_SECRET` and the Vercel schedule are configured.

## Phase 5 completed implementation

- Added ownership-scoped learner routes for strict multi-topic assessment start,
  attempt list/detail, answer set/clear, idempotent submission, submitted result, and
  fresh retake. Cookie mutations enforce same origin; all owners come from verified
  active profiles, and inaccessible/other-user attempts return the same `404`.
- Added random question selection and independent option shuffling with immutable
  snapshots for prompts, explanations, fresh option keys, correct keys, topic/system
  IDs and labels, difficulty, concept, legacy images, and managed media IDs. Retakes
  preserve source scope/count but select current eligible questions into new snapshots.
- Added DTO privacy boundaries: general detail never exposes score/correctness/correct
  keys/explanations; learner lists expose scores only for submitted statuses; learner
  results and admin detail reveal immutable results only after `COMPLETED` or
  `AUTO_SUBMITTED`.
- Added database-time timing: quiz attempts are untimed; tests receive exactly 60
  seconds per requested question. Due tests auto-submit under row locks, unanswered
  items remain distinct and in the score denominator, auto duration is capped, and
  terminal submit replay is idempotent.
- Added bounded lazy expiry on learner/admin list/detail/progress paths and internal
  `GET`/`POST /api/internal/attempts/expire`. The internal worker requires bearer
  `CRON_SECRET`, claims 50 rows with `SKIP LOCKED`, runs at most 10 batches/8 seconds,
  and is scheduled every minute by `vercel.json`.
- Isolated cron-only configuration from shared runtime validation. `CRON_SECRET` is no
  longer part of `serverEnvSchema`, so absent/blank/short cron configuration does not
  crash ordinary pages or production builds. `cronEnvSchema`/`getCronEnv` validates only
  at the internal worker boundary: no/blank secret returns `503`, while a configured
  short value fails safely through the mapped validation error. `envCheckSchema` still
  rejects that short configured value as the intentional deployment gate.
- Added absolute lesson completion and current-content progress reports. Content uses
  current published lessons; flashcards use current eligible published cards; quiz/test
  accuracy uses all submitted immutable snapshots, including unanswered denominators,
  attributed by snapshot system and topic IDs. Zero denominators report `0/0` and `0%`.
- Added transactional `TopicProgress` refresh after lesson/flashcard/attempt changes,
  while reporting routes remain authoritative recomputations from source progress and
  attempt history rather than reads from the projection.
- Added `/api/v1/dashboard/me` with submitted totals, weighted accuracy, latest 10
  submitted attempts, current system/topic metrics, and up to five strength/weakness
  topics after a five-answer minimum.
- Added read-only admin attempt list/detail APIs and `/attempts`, `/attempts/[id]` UI,
  plus narrow admin user progress API and `/users/[id]` UI. Admin attempt search supports
  learner, IDs, assessment/scope/status/date filters, stable sorting, and pagination.
- Extended signed media authorization: an active learner may resolve managed media in
  an owned historical attempt snapshot (including archived assets) for 300 seconds;
  another learner receives `404`. Protected admin attempt detail batch-signs historical
  snapshot media for 900 seconds without exposing storage coordinates.
- Added and deployed migration `20260713090000_add_assessment_snapshot_guards` after
  confirming `AssessmentAttempt` count was zero. Its own preflight rejects non-empty
  attempt tables; it adds topic/system/difficulty/concept/media snapshot fields, three
  history/scope indexes, status/timing and test-expiry checks, and triggers protecting
  immutable scope/snapshots/terminal results, answer/child lifecycle, and history from
  deletion.
- Updated README, architecture, API, OpenAPI, security, testing, implementation plan,
  and phase status to reflect the inspected Phase 5 implementation.

## Phase 5 primary files, routes, and migration

- `features/assessments/`, `features/progress/`
- `components/assessments/`, `components/progress/`
- `app/(admin)/attempts/`, `app/(admin)/users/[id]/`
- `app/api/v1/assessments/`, `app/api/v1/attempts/`
- `app/api/v1/content-lessons/[id]/progress/`, `app/api/v1/progress/`,
  `app/api/v1/dashboard/me/`
- `app/api/v1/admin/attempts/`, `app/api/v1/admin/users/[id]/progress/`
- `app/api/internal/attempts/expire/`, `vercel.json`
- `lib/env.ts`, `lib/env.test.ts`, `scripts/check-env.ts`
- `prisma/migrations/20260713090000_add_assessment_snapshot_guards/migration.sql`

Only documentation files were changed by this documentation task. Application code,
package files, migrations, environment values, and secrets were not modified.

## Phase 5 verification and configuration record

| Command/check | Result |
| --- | --- |
| Migration preflight | Passed after confirming `AssessmentAttempt` count was zero |
| `npm run prisma:deploy` | Passed; deployed `20260713090000_add_assessment_snapshot_guards` |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 61 files, 206 tests; 4 conditional PostgreSQL tests skipped in the default run |
| Dedicated assessment PostgreSQL suite | Passed: 4 tests against migrated isolated `anatolearn_phase5_test` schema, including concurrent finalization |
| `npm run build` | Passed without a `CRON_SECRET` process override |
| `npm run test:e2e` | Passed against the existing live development server: 3 passed, 1 skipped |
| `npm run env:check` | **Failed** only for invalid `CRON_SECRET` |
| OpenAPI structural validation | Passed; specification is valid |
| Prisma migration status | Current |

The default suite skips the four cases in
`features/assessments/postgres.integration.test.ts` unless `TEST_DATABASE_URL` differs
from `DATABASE_URL`. They were also run separately against a migrated isolated schema
and all four passed. That run verified snapshot and terminal immutability, source-edit
stability, and real multi-connection concurrent finalization. It exposed and fixed raw
PostgreSQL serialization failures arriving as Prisma `P2010` with SQLSTATE `40001`; the
shared assessment transaction retry now handles those alongside `P2034` and deadlock
SQLSTATE `40P01`. Environment validation and Phase 5
deployment configuration must not be reported as passing until `CRON_SECRET` is replaced
with at least 32 random characters and the deployed one-minute schedule is verified. The
regression test in `lib/env.test.ts` specifically proves that shared runtime validation
accepts an invalid cron-only value while `cronEnvSchema` rejects it. The successful build
without a process override confirms that this deployment gate is isolated from ordinary
application startup.

Post-phase verification also corrected the seeded lesson DTO failure: strict structured
blocks now accept optional bounded stable IDs, reject duplicate IDs within a lesson, and
continue rejecting unknown fields and unrestricted HTML. Focused schema and DTO
regression tests cover the persisted seed shape.

Media upload/list hardening now separates durable upload/metadata success from temporary
signed-preview availability. Storage compensation runs only when the database/audit
transaction fails; admin list, mutation, and historical-detail DTOs use null preview
fields instead of failing an entire page when signing is unavailable. Learner media
delivery remains strict. Service and DTO regression tests cover the failure paths.

## Phase 5 residual limitations and risks

1. Supabase provider/auth and private signed-URL integration remains mocked.
2. Full authenticated learner assessment CRUD/lifecycle E2E is absent, as are existing
   authenticated admin content/media/flashcard/question CRUD flows.
3. Cron processing requires deployment `CRON_SECRET` and Vercel scheduling; lazy expiry
   limits stale reads but does not configure operations.
4. Existing media-picker/lesson-editor and process-local rate-limiter gaps remain.

## Next phase

**Phase 6: Dashboard, feedback, and notifications.** Implement the real admin dashboard,
feedback submission/review, notification campaigns/delivery/reads, and safe provider
adapter according to the authoritative plan. The Phase 5 `/users/[id]` surface remains
a narrow read-only progress view, not a general user-management implementation.

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
