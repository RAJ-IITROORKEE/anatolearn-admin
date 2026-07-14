# AnatoLearn Admin

AnatoLearn is a Next.js admin application and versioned REST API for managing
anatomy-learning content. The application uses Supabase Auth and private Storage,
Prisma, and PostgreSQL.

## Current status

Phases 0-7 are implemented in the repository. All seven migrations are current in the
configured development database, including the two Phase 7 direct-database-access
hardening migrations. Production deployment readiness is still externally gated; this
is not a claim that the product is deployed. The current application includes:

- Supabase cookie and bearer authentication with active-profile and admin-role checks
- Prisma 6.19.3 schema and migrations, a non-destructive create-if-missing seed, and a
  tested explicit administrator bootstrap script
- Protected admin pages for organ systems, topics, structured lessons, private media,
  audit logs, profile, and password settings
- Admin CRUD/lifecycle APIs and authenticated published-content APIs under `/api/v1`
- Flashcard administration, authenticated published flashcard reads, and idempotent
  per-user view/mastery/difficulty progress updates
- Quiz/test question administration with atomic 2-6 option sets, exactly one correct
  answer, duplicate/activity/lifecycle/bulk workflows, and no public question-bank API
- Ownership-scoped quiz/test attempts with randomized immutable snapshots, answer
  updates, one-minute-per-question test expiry, idempotent scoring/submission, fresh
  retakes, history, and result-only answer disclosure
- Learner lesson/progress/dashboard APIs plus read-only admin attempt and user-progress
  pages backed by submitted snapshot history and current published content
- A real admin dashboard with 7/30/90-day attempt trends, learner/content/feedback
  counts, question-weighted quiz/test accuracy, explicit content-readiness metrics, and
  bounded recent registrations, feedback, and redacted audit activity
- Learner-only user management with paginated list/detail, activate/deactivate, preserved
  learning history, device-token shutdown, pending-delivery cancellation, and audits
- Learner feedback submission/history plus admin triage, internal notes, review/resolve
  attribution, privacy-separated DTOs, redacted audits, and distributed-ready limits
- Notification drafts, scheduling/cancellation/send queueing, immutable one-time audience
  materialization, recipients/deliveries, learner reads, device-token ownership, provider
  readiness, receipt polling, leases/retries, and a cron worker
- A secret-authenticated expiry job at `/api/internal/attempts/expire`, scheduled every
  minute by `vercel.json`, with bounded batches and lazy expiry on relevant reads
- A secret-authenticated notification worker at `/api/internal/notifications/process`,
  also scheduled every minute; provider tickets remain `TICKETED` until a receipt confirms
  `SENT`, and campaign outcomes distinguish `PROCESSING`, `PARTIAL`, and `FAILED`
- Validated PNG/JPEG/WebP uploads, 15-minute admin URLs, and 5-minute eligible
  published or owned historical-attempt media URLs
- Exact-origin cookie CSRF checks, nonce-based CSP, production HSTS, security headers,
  request IDs, private no-store/Vary defaults, explicit public cache policy, and
  structured redacted error logging
- Upstash REST rate-limiter support required in production, with a bounded in-memory
  fallback only in development/test; authentication uses separate client and account keys
- A seven-block visual lesson editor with validated preview, keyboard/button reordering,
  deletion confirmation, and dirty-navigation protection
- Searchable/paginated managed-media pickers integrated into system, topic, lesson,
  flashcard, question, and option forms
- Accessibility, metadata/robots, password visibility, pagination, dialog, table, and
  overflow hardening, with Vitest/RTL and axe-enabled Playwright foundations

Phase 7 repository implementation is complete. External gates remain: install and verify
deployment cron and Upstash secrets, exercise real Expo/EAS devices and Supabase Auth/
Storage, provide admin E2E credentials, perform backup/restore and production deployment,
and optionally add Sentry/monitoring. See `docs/PHASE_STATUS.md` for the exact boundary.

See `docs/PHASE_STATUS.md` for the latest verification record and known limitations.

## Local development

Use Node.js 20.19 or newer and npm. Copy `.env.example` to `.env.local`, replace all
placeholder values, and configure the Supabase project, private `anatomy-media` bucket,
pooled/direct database URLs, and a random `CRON_SECRET` of at least 32 characters.
Never commit local environment files.

`CRON_SECRET` is cron-only configuration. It is intentionally excluded from the shared
`serverEnvSchema`, so an absent, blank, or short value does not prevent ordinary pages
or a production build from starting. The internal cron route validates it through
`cronEnvSchema`/`getCronEnv`: absent or blank disables that route with `503`, while a
configured value shorter than 32 characters fails safely through the API error mapper.
`npm run env:check` still rejects a configured short secret as an intentional deployment
configuration gate. Production validation additionally requires the paired
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; development/test may leave both
blank to use the bounded process-local fallback.

```bash
npm install
npm run env:check
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
npm run admin:bootstrap # explicit, only when an administrator must be linked/created
npm run dev
```

Open `http://localhost:3000`. Anonymous requests to protected admin pages redirect to
`/login`; active `ADMIN` profiles can access the admin application.

Migration `20260713090000_add_assessment_snapshot_guards` has been deployed in the
configured development environment after confirming the attempt count was zero. Its
preflight intentionally refuses to run against a database containing any assessment
attempt because the required historical snapshot fields cannot be synthesized safely.
Phase 6 is split across
`20260714120000_add_phase6_feedback_notification_foundation` and
`20260714121000_add_phase6_feedback_notification_structure`: PostgreSQL requires new enum
labels to commit before later statements can reference them. Both migrations repeat the
empty notification-table preflight, are deployed, and bring the repository total to five
current migrations. Phase 7 adds
`20260714130000_deny_direct_application_database_access` and
`20260714131000_restrict_application_schema_access`; both are deployed to the configured
development database. They enable RLS and revoke table/sequence/function privileges for
Supabase `anon`/`authenticated`, while retaining schema `USAGE` without `CREATE`.

## Implemented content workflows

- Organ systems, topics, and lessons support create, read, update, reorder, publish,
  draft rollback, and terminal archive workflows.
- Lesson content is JSON made from validated `heading`, `paragraph`, `image`,
  `callout`, `bulletList`, `numberedList`, and `divider` blocks. Raw HTML is rejected.
- Media uploads require non-empty alt text and valid image bytes. Client filenames do
  not determine storage paths. Sharp 0.35.3 fully decodes uploads and enforces the
  configured byte limit, a 12,000-pixel per-axis limit, and a 40-megapixel limit.
- Published-content APIs require an active authenticated profile and hide drafts,
  archived records, and content beneath an unpublished/inactive parent.
- `GET /api/v1/media/{id}` gives an active authenticated user a 300-second signed URL
  for eligible published media or media preserved in one of that user's attempt
  snapshots (including archived history). Admin media DTOs use 900-second URLs and
  serialize `byteSize` as a decimal string.
- Physical media deletion is deliberately disabled and returns `409`; archive is the
  supported lifecycle action, but media referenced by eligible published content
  cannot be archived.
- Flashcards support filtered/paginated admin CRUD, reorder, publish/draft/archive,
  bulk status changes, live preview, and grid/list views. Active users can read all
  eligible published cards for a topic and update progress with an idempotency UUID.
- Quiz and test questions have separate accented admin lists and shared create/edit/
  preview workflows. Option replacement is transactional, preserves supplied option
  IDs/keys belonging to the question, relabels options `A` onward, and enforces 2-6
  options with exactly one correct answer.
- Question lifecycle includes publish/draft, terminal archive, active/inactive,
  duplicate-to-draft, and transactional bulk status operations. Questions are exposed
  only to the internal assessment selection service; there is intentionally no public
  question-bank endpoint.
- Eligible flashcard/question media participates in published signed-media reads and
  archive-reference protection.
- Starting an assessment accepts one published active organ system, an optional unique
  list of 1-100 published topic IDs in that system, and 5-50 questions. Questions and
  options are randomized once and persisted as stable snapshots. Quiz attempts are
  untimed; tests expire after 60 seconds per requested question using database time.
- Attempt ownership always comes from the verified profile. Active-attempt/detail DTOs
  omit scores, correctness, correct option keys, and explanations. The dedicated result
  route reveals those snapshot fields only after `COMPLETED` or `AUTO_SUBMITTED`.
  Submission replays return the existing terminal result, while retakes select a fresh
  random set from the source attempt's current eligible scope.
- Lesson completion is an absolute per-user state. Progress reports use current
  published lessons and eligible flashcards as completion denominators and immutable
  submitted attempt questions as quiz/test denominators; a zero denominator is reported
  as `0/0` and `0%`, not as complete. Topic strengths/weaknesses require at least five
  submitted answers.
- `/attempts` and `/attempts/[id]` provide read-only admin history. `/users` and
  `/users/[id]` now provide learner-only search, status management, activity/device
  summaries, and the existing progress report. Deactivation preserves history, disables
  active device tokens, and cancels pending deliveries.

## Phase 6 administration and delivery

- `/dashboard` contains only database-backed values. The selected `days=7|30|90` range
  affects the UTC daily attempt trend; overall counts and weighted accuracy remain
  all-time. Completeness uses non-archived topics as the denominator and states every
  readiness condition in the API DTO.
- `/feedback` and `/feedback/[id]` provide responsive triage, filtering, internal notes,
  and explicit review/resolve actions. Learners use `POST /api/v1/feedback` and
  `GET /api/v1/feedback/mine`; learner DTOs never include admin notes or reviewer data.
- `/notifications`, `/notifications/new`, and `/notifications/[id]` support responsive
  lists/cards, provider-disabled messaging, previews, confirmation and pending states,
  paginated evidence, accessible labels, and an unsaved-change navigation guard.
- A send request queues work and returns `202`; it does not claim delivery. Expo ticket
  acceptance is `TICKETED`, while `SENT` requires a successful receipt. The worker uses
  expiring campaign/delivery leases, bounded retries, and a 23-hour/20-poll receipt limit.
  Audience and token snapshots are materialized once. A crash after provider acceptance
  but before persistence creates an unavoidable at-least-once duplicate-send window.
- Device tokens and token snapshots are never emitted by public/admin DTOs or audit
  snapshots. When Expo is disabled or incomplete, send mutations fail before campaign
  state changes; the cron worker returns zero work without mutation.

The visual lesson editor emits the same strict seven-block JSON contract used by the API.
Managed-media pickers select only unarchived assets and are integrated into content,
flashcard, question, and option forms. Published DTOs retain legacy URL fields/media IDs;
clients resolve eligible managed media through the authenticated published-media route.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run openapi:validate
```

Install Chromium once with `npx playwright install chromium`. The final Phase 7 record is:
lint, typecheck, and build passed; the default Vitest run passed 129 files (2 skipped),
412 tests (9 skipped); the isolated `TEST_DATABASE_URL` run passed 2 files/9 tests (four
assessment lifecycle and five direct-access cases); Playwright passed 17 and skipped 14.
Authenticated admin tests did **not** run because `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` were absent: the 14 skips comprise auth setup, 12 authenticated
tests, and one existing intentional skip. OpenAPI has 104 implemented, unique, parity-
checked operations. The build completed 40 static-generation units under dynamic nonce
CSP output and included all routes. All seven migrations are current in development.

`npm audit` reports zero high/critical findings. Two moderate PostCSS findings remain
through Next.js; there is no safe stable fix, and `npm audit fix --force` would downgrade
Next.js to 9, so it was not used. `npm run env:check` currently fails only because the
local `CRON_SECRET` is invalid. Real Expo delivery, authenticated admin E2E, real Supabase
provider integration, cron schedules, Upstash production credentials, backup/restore,
and production deployment remain unverified external gates.

## Project references

- `MASTER_BUILD_PROMPT.md`: authoritative product scope and phase order
- `DESIGN.md`: UI and accessibility system
- `AGENTS.md`: repository operating rules
- `SETUP_GUIDE.md`: Supabase, local, and Vercel setup sequence
- `docs/ARCHITECTURE.md`: implemented system boundaries and data flow
- `docs/API_SPEC.md`: implemented REST contract
- `docs/openapi.yaml`: machine-readable implemented API surface
