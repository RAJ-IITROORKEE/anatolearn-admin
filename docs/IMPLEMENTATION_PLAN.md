# AnatoLearn Implementation Plan

## Delivery rules

- `MASTER_BUILD_PROMPT.md` is the primary product implementation instruction.
- `AGENTS.md` governs repository operations and `DESIGN.md` governs every UI.
- Work one reviewable phase at a time; preserve npm and the existing Next.js app.
- Update architecture, API, OpenAPI, security, testing, README, and phase status as
  behavior changes. Planned text must never be presented as implemented behavior.
- Run and record lint, typecheck, tests, and build before phase completion. If a phase
  is functionally delivered before final gates run, record those gates as pending.

## Phase 0: Audit and planning

**Deliverables**

- Audit package manager, stack, source tree, git state, environment template, and
  current phase.
- Read all supplied requirements and identify missing SRS material.
- Define architecture boundaries, schema plan, REST/admin route maps, security
  controls, test strategy, conflict resolutions, environment gaps, and risks.
- Create all required documents and a planned OpenAPI contract.

**Acceptance**

- Required documentation exists and clearly separates current/planned behavior.
- All master-prompt feature groups map to a phase, route, model, and test strategy.
- Multi-topic attempts and per-user notification reads have coherent data models.
- No unresolved architecture contradiction blocks Phase 1.

## Phase 1: Foundation and design system

**Work**

- Confirm package compatibility with Next.js 16/React 19, install only required
  foundation/testing dependencies, and preserve `package-lock.json`.
- Add typecheck/test scripts, Vitest/RTL/Playwright foundations, env validation
  shell, and `.env.example` tracking exception.
- Configure shadcn/ui and Lucide; implement DESIGN.md semantic CSS tokens using
  Inter, responsive shell, sidebar/drawer/top bar/breadcrumbs/profile menu.
- Add auth page layout and shared loading, empty, error, pending, confirmation,
  pagination, and feedback primitives.
- Replace only the starter UI; do not implement fake production metrics.

**Acceptance**

- Responsive shell and auth layout match DESIGN.md at mobile/tablet/desktop.
- Shared states are keyboard accessible and reduced-motion aware.
- Lint, typecheck, unit tests, and production build pass.

## Phase 2: Supabase, Prisma, and authentication

**Status: implemented.** Environment-specific seed/bootstrap commands remain explicit
operations and are not a reason to describe the repository as bootstrap-pending.

**Work**

- Confirm development Supabase project, private bucket strategy, redirect allowlist,
  pooled/direct URLs, and runtime environment schemas without printing values.
- Implement the reviewed Prisma schema, a new initial migration, client singleton,
  idempotent eleven-system/demo seed, and explicit bootstrap-admin script.
- Implement browser/server/admin Supabase clients, auth callback, cookie sessions,
  bearer verification, profile reconciliation, role/active guards, and CSRF-safe
  mutation pattern.
- Implement login, forgot/reset password, settings security/change password, logout,
  health/meta, auth, and profile routes.

**Acceptance**

- Migration/generate/seed/bootstrap work in the intended development environment.
- Admin can authenticate; non-admin/inactive identities are denied server-side.
- No secrets are exposed or printed; auth tests and all verification commands pass.

## Phase 3: Core content administration

**Status: complete.** The delivered UI uses a validated JSON lesson editor and
managed-media UUID fields. Private signed previews are available to admins, and active
authenticated users can resolve eligible published media through a dedicated
300-second signed-URL endpoint. Final lint, typecheck, unit/component tests, E2E,
build, and OpenAPI structural validation passed. Database-backed Storage/publication
integration tests from the original acceptance target are not present.

**Work**

- Organ systems, topics, structured lessons, managed media, publish/archive,
  reordering, audit service/log pages, and published mobile content APIs.
- Use private signed media reads, structured content validation, reference checks,
  and server-side domain services shared by UI and REST handlers.

**Original acceptance target**

- Complete validated CRUD with paginated/filterable lists and all UI states.
- Draft content/media remains inaccessible to normal users.
- Upload and publication audit integration tests pass.

## Phase 4: Flashcards and questions

**Status: complete.** Delivered flashcard admin CRUD/reorder/lifecycle/bulk workflows,
authenticated published reads and idempotent per-user progress; quiz/test admin CRUD,
strict transactional option aggregates, preview, duplicate/activity/lifecycle/bulk
workflows; internal eligible-question selection; sample seed expansion; media
eligibility integration; and Phase 4 indexes. There is intentionally no public question
bank. Final lint, typecheck, 37-file/117-test suite, seed, migration deploy, build,
Playwright, and OpenAPI structural checks passed. Database/provider integration,
concurrency/race tests, and authenticated CRUD E2E remain gaps.

**Work**

- Flashcard CRUD/progress, quiz/test question CRUD, atomic nested options, duplicate,
  filters, preview, bulk lifecycle actions, and sample question seed expansion.
- Apply DESIGN.md purple quiz and orange test accents without color-only meaning.

**Acceptance**

- Exactly one correct answer and 2-6 options are transactionally enforced.
- Only eligible published content enters assessment selection.
- Unit/integration/UI checks and full verification pass.

## Phase 5: Assessment engine and progress

**Status: implementation complete; deployment configuration gate open.** Delivered
owned multi-topic starts, randomized immutable snapshots, strict answer updates,
database-time test expiry, idempotent submission/scoring, result privacy, fresh
retakes/history, lesson and aggregate progress, learner dashboard, read-only admin
attempt/user progress APIs and pages, historical snapshot media access, bounded cron/
lazy expiry, deployed snapshot-guard migration, and cron environment isolation. The
shared runtime schema no longer validates `CRON_SECRET`; only the cron boundary does, and
regression coverage proves shared runtime accepts a short cron-only value while the cron
schema rejects it. Latest lint, typecheck, 61-file/205-test suite, build without a
`CRON_SECRET` process override, Playwright against the existing live server (3 passed, 1
skipped), and OpenAPI validation passed; migration status is current. The default suite
passes 61 files/206 tests and conditionally skips four PostgreSQL cases. Those four tests
also passed separately against a migrated isolated schema, including real multi-client
concurrent finalization; provider/auth signed URLs and
assessment E2E remain mocked/absent. `npm run env:check` intentionally still fails for
    the configured `CRON_SECRET`; deployment completion must not be claimed until the
    deployment secret, Vercel daily cron, and GitHub Actions scheduler are configured.

**Work**

- Multi-topic start, randomized stable snapshots, answers, expiry, idempotent
  submission/scoring, results, retakes, attempt lists/details, progress projection,
  strengths/weaknesses, and personal dashboard API.
- Use transactions, server time, immutable snapshots, and ownership-safe DTOs.

**Original acceptance target**

- Complete lifecycle tests pass, including races and source edits after start.
- Tests enforce one minute per test question and no quiz time limit.
- Historical results remain stable and explanations are hidden before submission.

**Delivered acceptance note:** lifecycle/unit/component coverage passes and application
plus database guards enforce timing/snapshot behavior. The dedicated PostgreSQL suite
passes snapshot mutation rejection, terminal immutability, source-edit stability, and
multi-client concurrent finalization against a migrated isolated schema. Full
authenticated lifecycle E2E remains a Phase 7 hardening gap.

## Phase 6: Dashboard, feedback, and notifications

**Status: complete in code; external delivery hardening remains Phase 7.** Delivered the
real admin dashboard and learner-only account management; learner/admin feedback with
privacy and redacted audits; device-token ownership; campaign draft/schedule/cancel/send
queue workflows; immutable recipients/deliveries; learner list/read; isolated Expo
provider readiness; receipt-truthful worker states, leases, retries, and cron route; and
responsive accessible admin pages with dirty-form protection. The two Phase 6 migrations
are deployed after splitting enum labels from dependent structure for PostgreSQL
transaction compatibility; all five migrations were current at the Phase 6 close. The
historical Phase 6 gates were:
lint/typecheck/build passed, 319 tests passed with four conditional PostgreSQL skips, and
migration deploy passed. Playwright was not rerun for Phase 6; the prior anonymous result
    remains 3 passed/1 skipped. The local environment passes `env:check`, and real
    Expo/device delivery is not verified.

**Work**

- Real aggregated admin dashboard, accessible charts, users/progress views, feedback
  submission/review, campaigns, deliveries/reads, device tokens, and safe provider
  adapter with a disabled state.

**Acceptance**

- Dashboard contains real paginated/aggregated data and no fake analytics.
- Internal feedback notes remain admin-only.
- Notification status reflects provider evidence and never false success.

**Delivered acceptance note:** dashboard values are database-backed; learner feedback
DTOs exclude internal notes/review identities; provider tickets remain `TICKETED` until
receipt-confirmed; campaign final states distinguish `SENT`, `PARTIAL`, and `FAILED`.
Unit/route/component coverage passes. Phase 7 retains real Expo integration, notification
worker database concurrency, authenticated Phase 6 E2E, distributed rate limiting, and
existing media-picker/visual-editor gaps.

## Phase 7: Hardening and delivery

**Status: repository implementation complete; production deployment externally gated.**
Delivered exact-origin CSRF checks; nonce CSP, security headers and production HSTS;
request-ID/private-cache/public-cache contracts; structured redacted logging; Upstash
distributed limiting with production-required paired credentials and development/test
memory fallback; dual client/account auth quotas; registration enumeration resistance
and compensation; permanent notification-failure handling; Prisma 6.19.3; deployed
development RLS/revoke migrations with isolated role tests; visual seven-block lesson
editing and managed-media pickers; accessibility/responsive/metadata/robots/password/
pagination/dialog/table fixes; strict 108-operation OpenAPI route parity; recoverable
Trash lifecycle and protected purge worker; non-destructive seed/bootstrap tests; and
axe/Playwright foundations.

Final gates passed: lint, typecheck, default Vitest (139 files passed, 3 skipped; 444
tests passed, 13 skipped), isolated database run (2 files/9 tests), build (42 static-
generation units with nonce dynamic CSP output), and OpenAPI validation (108 unique parity-
checked operations). Playwright was 17 passed/14 skipped; authenticated admin coverage did
not run because its two credentials were absent. Nine migrations are current in the
configured development database. `env:check` passes locally; production additionally
requires either the paired Vercel Upstash integration values or the paired self-managed
Upstash values. Trash PostgreSQL
acceptance passed 4/4 in isolation; the default database run skips it without
`TEST_DATABASE_URL`.

**Work**

- Complete accessibility, responsive, security, performance, DTO/privacy, and
  dependency reviews; finish unit/integration/E2E coverage.
- Reconcile OpenAPI/API docs with implemented routes; finalize README/setup,
  deployment/migration steps, Supabase policies, recovery, and mobile notes.

**Acceptance**

- Lint, typecheck, all tests, Playwright, and production build pass.
- No critical TODO, secret exposure, undocumented endpoint, or contract drift.
- Vercel and Supabase configuration steps are reproducible.

**Acceptance boundary:** repository checks and reproducible documentation are complete.
External acceptance remains open for valid cron secret/schedules, production Upstash,
real Expo/EAS ticket/receipt/partial/`DeviceNotRegistered` behavior, authenticated admin
E2E, real Supabase Auth email/redirect/private Storage, backup/restore, and production
deployment. Optional Sentry/monitoring is not installed. RLS is deployed to configured
development and isolated tested, not claimed in production.

## Requirement traceability

| Requirement group | Primary phases | Data/API/UI evidence |
| --- | --- | --- |
| Admin auth and role protection | 2, 7 | Profile, auth/session/me APIs, auth pages, guards/security tests |
| Dashboard and activity | 5, 6 | Attempts/progress, admin dashboard API and DESIGN.md charts |
| Users and progress | 5, 6 | Profile/progress/attempt models and admin user routes |
| Eleven organ systems | 2, 3 | OrganSystem seed and CRUD/published APIs |
| Topics and content review | 3 | Topic/ContentLesson, structured blocks, admin/mobile routes |
| Media management | 3, 7 | MediaAsset, storage adapter, upload/admin routes and security tests |
| Flashcards | 4, 5 | Flashcard/FlashcardProgress and admin/mobile routes |
| Quiz/test questions | 4 | Question/QuestionOption, admin routes, validation tests |
| Assessment lifecycle | 5 | Attempt models/routes, expiry/snapshot/idempotency tests |
| Results, retakes, strengths | 5, 6 | Result/retake/dashboard routes and derived metrics |
| Feedback | 6 | Feedback model, user/admin routes, privacy tests |
| Notifications/reminders | 6 | Campaign/Delivery/DeviceToken, user/admin routes, provider adapter |
| Auditability | 2-7 | AuditLog/service and required mutation coverage |
| Responsive accessible UI | 1-7 | DESIGN.md components/states and component/E2E checks |
| Versioned REST/OpenAPI | 0-7 | `/api/v1`, API spec, evolving `openapi.yaml` |
| Seed/bootstrap/deployment | 2, 7 | Prisma seed, bootstrap script, README/setup and Vercel checks |

## Current continuation point

Do not add another repository feature phase before external deployment acceptance. Install
a valid random 32+ character `CRON_SECRET` and verify the Vercel daily plus GitHub Actions
jobs; provision and
verify production Upstash; exercise real Expo/EAS devices; provide admin E2E credentials;
test real Supabase Auth email/redirect/private Storage; and perform backup/restore plus
production deployment. Optional monitoring may follow. These gates do not invalidate the
completed Phase 7 repository implementation, but they prevent claiming the product is
fully deployed or production-ready.
