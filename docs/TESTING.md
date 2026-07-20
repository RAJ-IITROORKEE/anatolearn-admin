# AnatoLearn Testing

## Current stack

- Vitest for unit tests
- React Testing Library and user-event for components
- Playwright desktop/mobile Chromium projects for browser checks
- Rollback-only assessment and direct-role PostgreSQL suites run only when
  `TEST_DATABASE_URL` points to a database different from `DATABASE_URL`; provider/auth
  and signed-URL tests remain mocked

Vitest ignores `e2e/`; Playwright owns that suite. The repository uses npm scripts:

```bash
npm run lint
npm run typecheck
npm run test
npm run test:watch
npm run test:e2e
npm run build
```

Install Chromium once with `npx playwright install chromium`.

## Implemented coverage through Phase 7

### Platform/auth/foundation

- public/server environment schema behavior, including the cron-isolation regression:
  shared runtime accepts an invalid cron-only value while `cronEnvSchema` rejects it
- API success/error envelopes and request IDs
- permission checks and recovery-token claims
- exact configured-origin validation, including missing/malformed/spoofed origins
- nonce CSP, global security headers, production-only HSTS, robots/metadata
- request-ID correlation, private no-store/Vary defaults, and explicit public cache rules
- structured logging redaction (no supplied body/password/token/exception text)
- Upstash adapter behavior, paired production environment validation, bounded memory
  fallback, fail-closed errors, and separate client/account auth quotas
- authentication and profile request schemas
- non-enumerating OTP registration/resend, strict six-digit verification, deferred profile
  provisioning, server-owned marker writes, immediate-session deletion compensation,
  session-token omission, marked-only missing-profile repair, validated name fallback,
  provider transient/error classification, and invalid/expired OTP behavior
- shared empty and confirmation UI states
- anonymous protected-page redirect and narrow-screen login controls

### Content administration

- strict mutation schemas reject unknown fields and empty updates
- every supported lesson block is accepted
- raw HTML and malformed image blocks are rejected
- rich lesson documents enforce allowlisted nodes/marks/attributes, bounded depth/node/
  text limits, exact generated legacy fallbacks, and managed-media extraction
- rich text color and highlight enums stay synchronized with OpenAPI, and arbitrary color
  values remain rejected
- black-box admin lesson POST/PATCH coverage resolves stable rich `uploadId` multipart
  files, strips pending IDs, regenerates untrusted fallback data, and dispatches only
  validated managed-media UUIDs
- page-size cap and unique reorder IDs
- draft/published transitions and recoverable Trash behavior
- published-state invariant validation for systems, topics, and lessons
- collision-safe canonical lesson lookup across system/topic/lesson slugs, canonical list
  links, UUID compatibility redirects, and operational-error propagation
- parent-list create redirects for systems, global/scoped topics, lessons, flashcards, and
  quiz/test questions; scoped topic creation overrides submitted parents and compensates
  uploads when the server-resolved parent is unavailable

### Media and audit

- direct resource uploads validate image files and optional alt text, retain or clear existing media on edit, and compensate newly created assets when the parent mutation fails
- rich lesson uploads are sequential and compensate completed assets after a later upload
  or parent mutation failure; invalid generated fallbacks are rejected before upload

- media pagination/filter normalization and page-size cap
- non-empty alt-text updates
- server-owned storage path construction independent of client filename
- media `BigInt` byte-size serialization as a decimal DTO string
- full Sharp decode of PNG, JPEG, and WebP plus malformed, truncated, unsupported,
  and over-dimension image rejection
- eligible published-media reference detection
- audit pagination/action/entity/actor/date schema parsing

### Component behavior

- a destructive inline action can be cancelled through confirmation
- pagination changes only `page` and retains active query filters
- unexpected server-action exception messages are replaced by a safe generic message
- seven-block lesson editing, validated preview, copy/reorder/confirmation/dirty guard
- continuous lesson-canvas rendering, accessible dialog preview, image insertion/drop
  between blocks, pending local-image preview, and independent object-URL cleanup
- accessible named text/highlight swatch menus, strict persisted marks, a single-row sticky
  formatting toolbar, emphasized Preview, and replace-versus-push navigation semantics
- direct image inputs, local previews, existing-media retention/clear controls, and
  indexed lesson/question upload fields, including compact preview mode
- password visibility without field replacement/value loss; dialog focus, table labels,
  overflow, responsive pagination, breadcrumbs, and mobile-shell regressions

### Flashcards and questions

- strict flashcard/question schemas, list filters, option cardinality, exactly-one-
  correct validation, unique bulk/reorder IDs, and progress event IDs
- flashcard lifecycle/publication invariants, DTO separation, media validation before
  writes, and complete-selection-before-bulk-write behavior
- learner flashcard authentication, published list routing, cookie-origin progress
  protection, idempotency conflict behavior, and progress DTOs
- question aggregate replacement with owned option IDs, stable keys, contiguous labels/
  order, stored aggregate fail-closed validation, and publication/activity/lifecycle
- question route authorization/origin/error mapping and admin method delegation
- duplicate/bulk/audit service behavior with mocked Prisma transaction boundaries
- responsive semantic flashcard/question tables and equivalent mobile rows, topic-title
  presentation, stable page-relative numbering, explicit edit/Delete actions, selection
  controls, and confirmed bulk actions
- atomic bulk Trash locks IDs deterministically, rejects incomplete selections before
  mutation, updates the selected set in one transaction, and audits every item
- internal selection accepts only published, active, parent-eligible, media-eligible
  questions with 2-6 options and exactly one correct answer
- question option form add/remove/correct-answer interaction and safe Phase 4 action
  error handling

### Assessment lifecycle and privacy

- strict start/answer/list contracts, unique topic scope, question count, telemetry
  bounds, and empty mutation bodies
- active authentication, cookie-origin enforcement, and server-derived owner identity
- Fisher-Yates question/option ordering, fresh option keys, stable snapshot DTOs, and
  fail-closed malformed snapshot handling
- pre-submission DTO privacy for learner/admin detail and list/result disclosure only
  after `COMPLETED` or `AUTO_SUBMITTED`
- server/database time expiry, one minute per test question, untimed quiz behavior,
  scoring/rounding, unanswered counts, and capped auto-submit duration
- owned row locking, same `404` for absent/other-user attempts, terminal submission
  replay idempotency, abandoned conflicts, fresh retake behavior, and safe serialization
  retry exhaustion
- bounded `SKIP LOCKED` expiry finalization, targeted/lazy expiry, projection refresh,
  and secret-authenticated GET/POST cron batching
- migration SQL guards have a conditional rollback-only PostgreSQL suite for snapshot
  immutability, terminal-result immutability, and source-edit stability; it was skipped
  in the latest run because no dedicated database was configured

### Progress and Phase 5 admin UI

- absolute lesson completion, first-completion timestamp preservation, inaccessible
  lesson `404`, and transaction retries
- topic projection refresh after lesson, flashcard, and attempt changes
- authoritative current-content denominators, snapshot assessment attribution by both
  system/topic IDs, weighted percentages, and neutral `0/0 = 0%` semantics
- five-answer strength/weakness eligibility, deterministic ties, unanswered samples,
  and 10-item recent-attempt bound
- read-only admin attempt filters/detail disclosure, UUID page guards, labels, badges,
  answer breakdown, historical media authorization, and narrow user progress components

### Phase 5 concurrency acceptance repair

- The four rollback-only PostgreSQL cases passed separately against a migrated isolated
  schema, including real multi-client finalization.
- That run exposed raw-query serialization/deadlock errors represented by Prisma `P2010`
  with PostgreSQL SQLSTATE `40001`/`40P01`; transaction retry detection and regression
  tests now cover those forms alongside `P2034`.
- Ordinary `npm run test` skips all four database cases unless `TEST_DATABASE_URL` is
  configured and differs from `DATABASE_URL`, preventing accidental writes to the normal
  development database.

### Phase 6 dashboard, users, and feedback

- strict 7/30/90 dashboard query parsing, weighted metrics, gap-filled UTC trends,
  content-readiness calculations, recent-item bounds, and admin route authorization
- pointer and keyboard trend inspection, exact-value table fallback, zero-data behavior,
  five-row activity bounds, safe feedback detail links, and audit entity filtering
- learner-only user filters/DTOs, safe detail activity, row-locked activate/deactivate,
  no-op behavior, history preservation, device-token shutdown, pending-delivery
  cancellation, redacted audits, responsive list/detail controls, and confirmations
- strict feedback create/mine/admin schemas; owner/admin DTO privacy; adapter-backed
  submission limiting; list/detail routing; review/resolve attribution; internal-note
  behavior; no-op handling; and redacted audit snapshots

### Phase 6 notifications

- Expo token format/ownership DTO privacy, reassignment and deactivation side effects
- strict campaign/audience/list/schedule schemas and lifecycle/final-status rules
- disabled, incomplete, ticket, receipt, transient, and malformed provider behavior
- draft/update/schedule/cancel/send service authorization boundaries, provider-ready
  no-mutation behavior, immutable one-time materialization, safe audits, recipients,
  deliveries, learner list/read ownership, and evidence DTO token redaction
- campaign/delivery lease ownership helpers, bounded send retries, delayed receipt polls,
  receipt age/poll limits, truthful `TICKETED` versus receipt-confirmed `SENT`, and
  `PROCESSING`/`PARTIAL`/`FAILED` outcomes
- campaign editor/picker/actions/presentation, provider-disabled states, responsive
  evidence surfaces, UUID page handling, accessible confirmations, and dirty navigation/
  `beforeunload` protection
- cron authorization regression coverage applies to both internal workers; notification
  worker implementation is unit-tested with mocks, not with concurrent PostgreSQL workers
- permanent Expo request/shape failures fail claimed deliveries immediately; transient
  network/429/5xx behavior retains bounded retry coverage

### Contract and database access hardening

- OpenAPI validation discovers route methods and proves exact parity, resolvable refs,
  108 unique operation IDs, reusable response headers, strict empty-body contracts,
  documented rate limits, and representative DTO privacy
- isolated PostgreSQL role tests prove `anon` and `authenticated` cannot read or write
  application tables while the normal Prisma role remains operational
- non-destructive canonical seed; canonical-only demo publication with exact row-count
  rollback checks; and bootstrap create/find, compensation, pagination, secret-redaction,
  and exit behavior
- axe runs on public pages and is wired into authenticated desktop/mobile projects

### Recoverable Trash

- Trash schemas, DTO retention/eligibility states, restore deadline/parent checks, seven
  resource types, audit actions, purge ordering, dependency blockers, and storage retry
  semantics are covered by unit/route tests.
- Feedback-specific coverage verifies normal-list/detail exclusion, workflow-status
  preservation, deterministic full-set bulk Trash, redacted audits, row/bulk actions,
  synchronized responsive selection, and Feedback-before-media purge order.
- Follow-up regressions cover dashboard NEW/recent visibility, learner feedback counts,
  attachment share-lock/rejection without metadata leakage, and stale bulk selection
  intersection after current-page IDs change.
- The PostgreSQL Trash suite passed 4/4 in an isolated schema, covering direct-delete
  protection, the exact database-clock restore deadline, MediaPurgeJob access control,
  and a representative foreign-key blocker. The default conditional DB run skips these
  cases when `TEST_DATABASE_URL` is absent.
- The normal editor block-delete confirmation is tested separately from resource Trash.

## Final Phase 7 verification record

| Command | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| Focused signup OTP routes | Passed: 13/13 tests |
| Related focused auth set | Passed: 29/29 tests |
| Final full `npm run test` | Passed: 160 files/600 tests; 3 files/14 tests skipped |
| Isolated `TEST_DATABASE_URL` run | Passed: 2 files/9 tests (4 assessment lifecycle + 5 direct database access) |
| `npm run prisma:deploy` | Passed; the Phase 7 RLS/revoke migrations, including Prisma metadata protection, are deployed to the configured database |
| Prisma migration status | Current: all twelve migrations, including Feedback Trash and Prisma metadata protection |
| `npm run test:e2e` | 17 passed, 14 skipped |
| `npm run build` | Passed: 44 static-generation units under dynamic nonce CSP output; all routes included |
| `npm run env:check` | Passed locally; production deployment values remain an external gate |
| `npm run openapi:validate` | Passed: 110 operations and 110 unique operation IDs with exact route parity |
| `npm audit` | 0 high/critical; 2 moderate PostCSS findings through Next.js remain |
| `git diff --check` | Passed; line-ending conversion warnings only |

The later admin UX and review follow-ups have passing focused tests. Their final integrated
verification passed Prisma generation and validation, lint, typecheck, the 160-file/600-test
full suite, OpenAPI validation, the 44-unit production build, and a blocker-focused review.

Authenticated admin tests did **not** pass or run: `E2E_ADMIN_EMAIL` and
`E2E_ADMIN_PASSWORD` were absent. The 14 skips comprise auth setup, 12 authenticated
tests, and one existing intentional skip. The 17 passes cover desktop/mobile public,
security, and accessibility behavior. The two moderate audit findings are PostCSS through
Next.js; no safe stable fix exists, and forcing remediation would downgrade Next.js to 9,
so `npm audit fix --force` was not used.

The default Vitest suite conditionally skips isolated database files without a distinct
`TEST_DATABASE_URL`. The separate 9-test run covered the four assessment lifecycle cases
and five `anon`/`authenticated` direct-access/Prisma-operability cases. The access-control
migrations are deployed to configured development, not production. `env:check` passes
locally; production
validation additionally requires one complete supported Upstash pair. Unit coverage accepts
both Vercel's `KV_REST_API_*` names and the self-managed `UPSTASH_REDIS_REST_*` names while
rejecting incomplete pairs.

The Phase 6 migrations are split because PostgreSQL requires newly added enum values to
commit before checks/indexes can reference them. Both repeat the empty notification-table
preflight. No real Expo integration result is recorded; the provider may be disabled or
misconfigured.

## Remaining coverage gaps

No current automated test proves the following end to end or against real providers:

- database/provider integration for admin `401`/`403`, cookie origin, and real writes
- content create/update/reorder transactions and unique conflicts
- published-only visibility beneath inactive/unpublished parents
- publication prerequisite failures
- media upload to Supabase Storage and signed URL generation
- declared MIME versus byte-signature mismatch at the service boundary
- metadata cleanup when Storage/database operations partially fail
- transactional published-reference enforcement during media archive
- audit row creation, snapshot contents, and database append-only trigger
- real flashcard/question option transactions, progress idempotency races, and internal
  selection against PostgreSQL
- Supabase provider/auth behavior or actual private Storage signed-URL generation
- authenticated admin UI CRUD, media, lifecycle, audit, flashcard, and question flows
- full authenticated learner assessment start/answer/expiry/submit/result/retake E2E
- deployed cron secret injection and GitHub Actions scheduler invocation
- real Expo push ticket/receipt behavior on devices
- notification worker leases/materialization under concurrent PostgreSQL workers
- authenticated dashboard/users/feedback/notification Playwright flows
- production Upstash credentials and deployed distributed-limiter verification

Most external provider behavior still uses mocks. Isolated PostgreSQL suites passed, but
real Supabase Auth email/redirect/private Storage, Expo/EAS devices, Vercel/GitHub cron, backup/
restore, and production deployment remain unverified.

OTP release acceptance additionally requires the hosted Supabase six-digit token template,
email-confirmation settings, expiry/rate controls, and production SMTP delivery. Mocked
route tests do not prove those hosted settings. A native client can still invoke public
Supabase signup directly; tests prove only that an unmarked identity cannot receive
missing-profile repair through the application login route.

## Remaining external test layers

### Integration

Use a dedicated non-production Supabase/PostgreSQL environment with migration parity.
Tests should create uniquely scoped data and clean it without destructive production
reset commands. Cover:

- identity-to-profile resolution and active ADMIN enforcement
- strict request validation and API status/envelope mapping
- lifecycle and parent publication constraints
- stable pagination/filter/sort behavior
- private Storage upload, signed reads, and published-reference-safe archive
- required audit events and append-only behavior

### End to end and deployment

Add authenticated fixtures without committing credentials. Critical flows are:

1. Sign in as an active administrator.
2. Create, edit, publish, and archive an organ system/topic/lesson.
3. Verify published content with a normal active bearer identity and verify draft/
   inactive content is inaccessible.
4. Reject invalid lesson JSON and invalid media.
5. Upload, preview, edit alt text, and archive media.
6. Read the resulting audit events.
7. Verify non-admin and inactive identities are denied.
8. Create/edit/preview/publish/bulk/archive flashcards and verify learner progress.
9. Create quiz/test questions, add/remove options, change the correct answer, duplicate,
   activate/deactivate, bulk transition, and verify no question-bank route exists.
10. As an active learner, start quiz/test attempts, answer/clear, observe test expiry,
    submit idempotently, read results, retake, and verify another user receives `404`.
11. Verify pre-submission DTO secrecy and historical snapshot media for owner/admin but
    not another learner.
12. Verify lesson completion, weighted/zero-denominator progress, dashboard rankings,
    admin attempt filters/detail, and narrow user progress.
13. Dispatch the deployed GitHub Actions scheduler with a valid secret and multiple due
    batches; verify the Vercel daily Trash purge separately.
14. Exercise dashboard range/accessibility, learner activate/deactivate, feedback privacy/
    triage, notification dirty guards, provider-disabled behavior, and delivery evidence.
15. Run concurrent notification workers against PostgreSQL and verify one-time audience
    materialization, lease takeover, retries, receipts, cancellation, and token redaction.

## Completion gate

Run, in order:

```bash
npm run lint
npm run typecheck
npm run test
npm run openapi:validate
npm run build
npm run test:e2e
npm run env:check
```

Record exact results in `docs/PHASE_STATUS.md`. A command is not passed unless it was
actually run; document external blockers rather than weakening assertions.
