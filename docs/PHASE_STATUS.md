# AnatoLearn Phase Status

## Current phase

**Phase 7: Hardening and delivery — repository implementation complete; external gates open**

Date: 2026-07-16

Phases 0-7 are implemented and all fourteen migrations are current in the configured
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
- Replaced link-based immediate profile creation with non-enumerating signup OTP initiation,
  six-digit verification, resend, deferred idempotent profile provisioning, and confirmed-
  login repair. Login remains password-only.
- Added a server-controlled `app_metadata.signup_otp_verified` marker after `verifyOtp`;
  password login repairs only a missing, marked profile. Immediate signup sessions trigger
  best-effort new-identity deletion, and malformed Auth names fall back to `Learner`.
- Classified signup Auth transport/`429`/`5xx` failures as `AUTH_UNAVAILABLE`, kept account-
  dependent registration/resend 4xx outcomes enumeration-safe, and distinguished transient
  verification failures from invalid/expired OTPs. Recovery initiation's later reviewed
  provider-`429` exception is recorded in the 2026-07-22 follow-up below.
- Kept `email_not_confirmed` classification so pending users receive no tokens.
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
- Made image files and alt text optional in resource forms, added signed cover/icon/image
  previews to parent lists, and added accessible inline plus Sonner success/error feedback
  for create, update, upload, lifecycle, and bulk actions.
- Exposed published organ-system cover/icon media IDs so authenticated Android/iOS clients
  can resolve replaced private assets rather than relying on stale legacy URLs.
- Completed accessibility/responsive fixes across password toggles, pagination, dialogs,
  breadcrumbs, tables, labels, overflow, metadata, and robots; established axe-enabled
  public and credential-gated authenticated Playwright coverage.
- Reconciled OpenAPI to all 110 implemented route operations with unique IDs, strict
  empty-body, rate-limit, privacy, response-header, and route-parity tests.
- Made canonical seeding create-if-missing/non-destructive and added tested bootstrap
  find/create/compensation/redaction behavior. Seeded anatomy content remains draft by
  default. Added an explicit, idempotent `db:publish-demo` transaction that publishes only
  validated canonical IDs for demo/MVP environments and leaves unrelated drafts untouched.
- Added recoverable Trash for seven resource types, database-clock 30-day restore windows,
  DRAFT restore for publishable content, status-preserving feedback restore, Settings >
  Trash, leaf-first dependency-aware purge, protected
  daily cron, and retrying `MediaPurgeJob` storage cleanup. Attempts, progress, audits,
  and notification evidence are preserved; legacy ARCHIVED rows without Trash metadata
  are not auto-purged. Normal editor block deletion remains separate and confirmed.
- Updated final README, setup, architecture, API, security, testing, plan, status, and
  machine-readable contract documentation from inspected code and diffs.

### Admin UX follow-up (2026-07-20)

- Made `/organ-systems/{systemSlug}/topics/{topicSlug}` the canonical browser editor
  route. The compatibility `/topics/{id}` UUID page resolves the topic and redirects to
  that readable route; `/topics/new` provides global topic creation with organ-system
  selection. REST topic routes remain UUID-based.
- Unified lesson editing into one structured canvas with image insertion/drop points
  between blocks, local and existing-image previews, and an accessible learner-preview
  dialog. Topic, lesson, flashcard, question, and option forms use compact media previews
  where appropriate while retaining the existing direct-upload validation and storage flow.
- Replaced the flashcard and quiz/test card grids with responsive semantic desktop tables
  and equivalent mobile rows. Lists now show topic title, stable page-relative numbering,
  status/activity, difficulty, update time, and explicit edit/confirmed Trash actions.
- Added select-all/clear controls and confirmed bulk Publish, Draft, and Delete actions.
  Bulk Delete now moves all selected flashcards or questions to recoverable Trash in one
  transaction: rows are locked deterministically, the complete selection is validated
  before mutation, and each item receives a Trash audit. Any unavailable item rolls back
  the whole operation.
- Added route/page/action, lesson canvas and image-drop, compact direct-image input,
  responsive flashcard/question list, bulk-action, DTO, content-service, and atomic bulk
  Trash regression tests. This follow-up added no migration or dependency.

### Feedback Trash follow-up (2026-07-20)

- Added and deployed `20260720120000_add_feedback_trash`, which gives `Feedback` the
  existing database-clock retention fields, consistency constraint, partial due index,
  hard-delete guard, and exact restore-deadline guard.
- Normal learner/admin feedback lists, detail, and updates exclude trashed rows. Restore
  preserves `NEW`, `REVIEWED`, or `RESOLVED`; it does not rewrite workflow history.
- Added confirmed row and atomic bulk Delete server actions. Bulk Trash validates the full
  unique UUID set, locks in ID order, writes all rows in one transaction, and appends one
  redacted lifecycle audit per item.
- Added synchronized desktop/mobile row selection, select-all/clear controls, confirmed
  row/bulk Delete, Feedback filtering/restoration in Settings > Trash, and Feedback-first
  purge so attachment references release before media is considered.
- No feedback DELETE API was added; the shared Trash list/filter/restore API and OpenAPI
  contract now include feedback as the seventh type and document status-preserving restore.
- Review follow-up excludes trashed feedback from dashboard NEW/recent projections and
  learner detail counts, blocks restore while an optional attachment remains trashed using
  a metadata-minimal share lock, and clears invisible bulk selections after page/filter ID
  changes while preserving responsive checkbox synchronization.
- Review follow-up verification: the dashboard/user/bulk/feedback-list set passed 19/19
  and Feedback-focused Trash service tests passed 5/5. The final integrated lint,
  typecheck, full test suite, OpenAPI validation, and production build all pass.
- Files changed are limited to the Prisma schema/new migration, Feedback service/actions/
  list/tests, shared bulk-action configuration, Trash domain/service/worker/settings/tests,
  and focused architecture/security/testing/status documentation.
- Verification: Prisma generation and schema validation passed; migration deploy/status
  passed with all 12 migrations current; focused Feedback/Trash tests passed 61 with 5
  conditional PostgreSQL tests skipped because `TEST_DATABASE_URL` is absent. Final lint,
  typecheck, full tests, OpenAPI validation, and production build passed.

### Rich lesson multipart REST review follow-up (2026-07-20)

- Extracted the v2 lesson draft parser/image resolver from the admin server action into
  `features/content/lesson-multipart.ts`, a server-only module now shared by server actions
  and REST POST/PATCH handlers. Legacy block arrays and multipart field names are retained.
- Pending rich image `uploadId` values now resolve through `lessonFile.<uploadId>` to
  managed media UUIDs in REST mutations. The resolver validates strict rich input and
  generated fallback limits before upload, resolves images sequentially, removes pending
  IDs, regenerates fallback blocks instead of trusting submitted fallback data, and
  validates the final stored v2 value. Raw HTML remains unsupported.
- REST parsing, later-upload failures, final validation failures, and parent mutation
  failures all use the existing tracked-upload compensation. Black-box route tests cover
  create, update, parent-write compensation, later-upload compensation, and validation
  before upload. Existing server-action regressions pass against the shared implementation.
- Changed implementation/test files: `features/content/lesson-multipart.ts`,
  `features/content/route-handlers.ts`, `app/(admin)/phase3-actions.ts`, and
  `app/api/v1/admin/content-lessons/routes.test.ts`. API, architecture, testing, and phase
  status documentation were synchronized. OpenAPI already advertised this multipart v2
  contract and required no shape change. No migration or dependency was added.
- TDD red step: all four initial REST regressions failed because v2 drafts reached stored-
  content validation unresolved and no upload compensation occurred. Final affected run
  passed 7 files/47 tests. `npm run typecheck`, full `npm run lint`, and
  `git diff --check` passed; `npm run openapi:validate` passed with 110 unique operations.

### Canonical lesson and dashboard UX follow-up (2026-07-20)

- Added the collision-safe canonical lesson editor route
  `/organ-systems/{systemSlug}/topics/{topicSlug}/content/{lessonSlug}`. Lesson list reads
  include parent slugs without N+1 queries, `/content/{id}` now redirects by UUID for
  compatibility, and topic/lesson slug-changing updates replace the stale history entry.
- Organ-system, global/scoped topic, lesson, flashcard, quiz-question, and test-question
  creates now return to their parent lists for rapid entry. Scoped topic creation resolves
  and enforces its parent system server-side and compensates any completed upload when that
  parent is unavailable.
- Replaced raw hex color selectors with accessible named swatch menus for strict allowlisted
  text and highlight colors. Only the horizontally scrollable tools row is sticky beneath
  the admin header; Preview now uses the primary action treatment.
- Reorganized the dashboard around real all-time ratios, weighted accuracy, content
  inventory, inspectable quiz/test attempt trends, and grouped system-readiness bars. The
  exact-value table remains available, pointer and keyboard inspection are supported, and
  reduced-motion preferences disable the short chart/bar animation.
- Recent learners, feedback, and admin activity are each bounded to five polished rows.
  Feedback opens its detail route; audit items pass entity type and ID filters, and `Show
  all recent activities` opens `/audit-logs`.
- Final verification passed: lint, typecheck, 164 Vitest files/636 tests (3 files/14 tests
  conditionally skipped), OpenAPI validation with 110 unique operations, Prisma generation,
  the 44-unit production build including the canonical lesson route, and `git diff --check`.

Production MVP verification confirmed the canonical demo set is learner-visible through
bearer-authenticated APIs: 11 systems, 2 circulatory topics, 1 lesson, 4 flashcards across
the topics, and 20 eligible assessment questions. No user account or test data was retained.

## Final verification record

### Learner study catalog follow-up (2026-07-23)

- Added authenticated `GET /api/v1/topics` as a paginated cross-system study catalog for
  learner content/flashcard session selection. It derives the active identity only from
  the verified cookie or bearer request and accepts no user ID.
- The catalog returns only published, nontrashed topics beneath published, active,
  nontrashed systems. Rows include the required system summary and current eligible lesson
  and flashcard counts. Flashcard counts reuse the existing learner endpoint's safe
  unarchived front/back managed-media predicate. Ordering is system display order/ID then
  topic display order/ID.
- TDD red coverage first failed for the absent query schema, service, handler, and route.
  Green coverage now exercises schema bounds, service eligibility/count projection,
  authenticated handler envelopes including safe `500`, and route delegation.
- Updated `docs/API_SPEC.md`, `docs/openapi.yaml`, `docs/ARCHITECTURE.md`,
  `docs/IMPLEMENTATION_PLAN.md`, and `docs/TESTING.md`. No Prisma schema/migration,
  dependency, seed, demo, environment, or unrelated README/setup/package/image changes
  were made.
- Verification: focused Vitest passed 5 files/43 tests; `npm run lint` passed; `npm run
  typecheck` passed; and `npm run openapi:validate` passed with 115 operations and 115
  unique operation IDs. Full Vitest and production build were not run for this focused
  endpoint follow-up.

### Public legal pages follow-up (2026-07-22)

- Added unauthenticated `/privacy` and `/terms` pages in a dedicated `(legal)` route group
  outside the protected `(admin)` layout. Both pages share the existing light semantic
  theme, responsive navigation, skip link, visible focus behavior, and links to each other
  and `/login`.
- The Privacy Policy documents account/profile/avatar data, learning and assessment
  activity, feedback, notifications/device tokens, security/audit/technical data, Supabase
  Auth and private storage, service providers, constrained no-sale wording, retention,
  deletion requests, security, changes, and contact. The Terms cover the educational-only
  medical disclaimer, acceptable use, account security, content/IP, availability,
  suspension/termination, disclaimers, liability, and changes. Both state the July 22, 2026
  effective date and `rajrabidas001@gmail.com` support contact.
- TDD red verification failed on both absent route headings. The focused green browser run
  passed 2/2. The final desktop/mobile legal and public-accessibility run passed 16/16,
  including axe serious/critical checks for both new pages. `npm run lint`, `npm run
  typecheck`, and the 47-unit production build passed; the build route manifest includes
  `/privacy` and `/terms`.
- No API, OpenAPI, setup, dependency, environment, Prisma schema/migration, seed, demo data,
  or production data change was required. Existing unrelated README, setup, package, seed,
  demo-script, and image work was preserved.

### Recovery and learner contract hardening follow-up (2026-07-22)

- Added enumeration-safe recovery initiation/resend provider mapping and strict
  `POST /api/v1/auth/verify-recovery-otp`. Supabase verification uses `type: recovery`;
  success returns only `{ accessToken, expiresAt }`, with private no-store headers.
- Recovery-AMR bearer/cookie sessions are rejected by normal application identity
  resolution. REST reset revalidates provider identity, audits an existing profile's
  password change, and requests global refresh-session revocation. The web reset action
  now requires recovery AMR; authenticated settings changes require current-password
  reauthentication and use a separate action.
- Review hardening keeps provider-returned forgot-password `429` outcomes identical to the
  absent-account generic success while reserving safe `503` for thrown transport and
  returned `5xx` failures. Once the provider updates a password, REST and web recovery both
  attempt global revocation even if profile lookup or audit persistence fails; those
  failures are redacted/logged and the completed update retains its success response.
- Review-hardening TDD verification: the red run failed on provider `429` and on profile
  rejection before REST/web revocation. The final focused run passed 2 files/15 tests;
  `npm run lint`, `npm run typecheck`, and `npm run openapi:validate` passed, with OpenAPI
  reporting 114 operations and 114 unique operation IDs.
- Added a dedicated recovery email template containing both `{{ .Token }}` and
  `{{ .ConfirmationURL }}` so native six-digit OTP and existing web-link recovery remain
  compatible. Hosted template deployment and SMTP behavior remain external acceptance.
- Extended authenticated published lesson rows with nullable owner progress
  `{ completed, completedAt, lastViewedAt }` through one owner-filtered relation include;
  legacy lesson fields and admin DTOs are unchanged.
- Added optional strict `organSystemId` to `GET /api/v1/dashboard/me`. Only server-ranked
  strengths/weaknesses are scoped; counts, weighted accuracy, recent attempts, all system
  progress, formula metadata, and evidence timestamp remain global. Inaccessible scopes
  return `404`.
- Hardened avatar PUT content-type/multipart parsing and safely maps malformed requests to
  `400`, invalid image content to `422`, and Storage unavailability to `503` without
  provider details.
- No dependency, Prisma schema, migration, seed, environment, deployment, or production
  data change was required. Task files are limited to auth/content/progress/avatar routes,
  services/actions/schemas/tests, Supabase recovery template/config, OpenAPI validation,
  and API/architecture/security/testing/plan/status documentation. Existing unrelated
  README, setup, package, seed-data, demo script/image changes were preserved untouched.
- TDD red run failed on all new boundaries as expected. The focused development run passed
  10 files/56 tests and the final targeted rerun passed 4 files/29 tests. The full final run
  passed 172 files/689 tests with 3 files/15 conditional PostgreSQL tests skipped. One
  initial full run had an unrelated existing lesson-editor five-second timeout; that file
  passed 17/17 in isolation and the complete rerun passed.
- Final verification passed: lint, typecheck, OpenAPI validation (114 unique operations),
  production build (47 static-generation units), and `git diff --check`. Prisma generate/
  validate were not run because neither schema nor migrations changed.

### Backend compatibility follow-up (2026-07-21)

- Added nullable half-step feedback ratings with a future-row 4.5 default; historical
  rows remain null and learner feedback DTOs remain unchanged.
- Added cross-system assessment scopes, authenticated availability, one-question-per-topic
  random selection, nullable singular system storage, mixed-safe admin presentation, and
  a deferred scope invariant without changing UUID routes or immutable snapshots.
- Extended progress with exact current inventory, latest terminal evidence per current
  source question, coverage/accuracy, transparent renormalized scoring, status,
  `formulaVersion`, `asOf`, and mixed-attempt attribution.
- Added managed avatar PUT/DELETE with strict bytes/size/multipart/auth/rate-limit controls,
  private media linking/Trash compensation, signed `/me` presentation, and batch-signed
  accessible admin user/feedback avatars.
- Added and deployed migrations `20260721120000_add_ratings_and_cross_system_assessments`
  and `20260721130000_revalidate_attempt_topic_updates` to the configured development
  database. No production data was modified.
- TDD red run failed in the expected new behavior. Prisma generate/validate and focused
  tests passed during implementation. Final verification: Prisma generate/validate,
  lint, typecheck, OpenAPI validation (113 unique operations), `git diff --check`, and the
  46-unit production build passed. Full Vitest passed 167 files/657 tests with 3 files/15
  tests skipped because no dedicated `TEST_DATABASE_URL` was configured. The new
  rollback-only mixed-scope PostgreSQL case therefore did not run locally.
- Code-review follow-up made the pending migration atomic and added deferred scope checks
  for both affected link IDs and attempt-system changes; snapshot system nullability and
  the per-topic start error now match OpenAPI. Progress dashboard reads share one
  repeatable-read transaction/snapshot. Avatar cleanup and media Trash preserve every
  profile/content/feedback/attempt reference under an asset lock. Focused tests passed
  35 with 5 conditional PostgreSQL skips; full Vitest passed 167 files/664 tests with 3
  files/15 tests skipped. Lint, typecheck, Prisma validation, and OpenAPI validation passed.
  Both migrations are deployed to configured development; PostgreSQL integration coverage
  remains conditional on a separate `TEST_DATABASE_URL`.

| Command/check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| Focused OTP tests | Passed: 13/13; related focused set passed 29/29 |
| Final full `npm run test` | Passed: 160 files/600 tests; 3 files/14 tests skipped |
| Isolated `TEST_DATABASE_URL` | Passed: 2 files/9 tests (4 assessment lifecycle + 5 direct DB access) |
| `npm run build` | Passed: 44 static-generation units under nonce dynamic CSP output; all routes |
| `npm run test:e2e` | 17 passed, 14 skipped |
| `npm run openapi:validate` | Passed: 113 operations, 113 unique operation IDs, exact route parity |
| Prisma generation, validation, deploy/status | Passed; all 14 migrations current, including ratings, cross-system assessments, and topic-scope follow-up |
| `npm audit` | 0 high/critical; 2 moderate PostCSS-through-Next findings remain |
| `npm run env:check` | Passed locally; production deployment values remain an external gate |
| `git diff --check` | Passed; line-ending notices only |

Admin UX follow-up verification: focused tests pass; Prisma generation/validation, lint,
typecheck, the full 160-file/600-test suite, OpenAPI validation, and the 44-unit production
build pass. Final blocker-focused review found no remaining issues.

The isolated PostgreSQL Trash suite passed 4/4. The default conditional database run
skips it when `TEST_DATABASE_URL` is not configured. Production gates remain external:
valid deployment `CRON_SECRET`, daily cron verification, production RLS verification,
real Supabase Storage purge, and authenticated E2E.

The OTP repository checks do not accept hosted provider configuration. Production
acceptance still requires Supabase email confirmation, the six-digit `{{ .Token }}`-only
template, configured expiry/rate controls, and verified SMTP delivery. Public native
Supabase signup remains a residual identity/email-abuse surface, but an unmarked identity
cannot obtain the application `Profile` required for authorization.

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
