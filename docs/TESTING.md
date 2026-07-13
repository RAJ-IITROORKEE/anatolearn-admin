# AnatoLearn Testing

## Current stack

- Vitest for unit tests
- React Testing Library and user-event for components
- Playwright desktop/mobile Chromium projects for browser checks
- A rollback-only assessment PostgreSQL suite exists and runs only when
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

## Implemented coverage through Phase 5

### Platform/auth/foundation

- public/server environment schema behavior, including the cron-isolation regression:
  shared runtime accepts an invalid cron-only value while `cronEnvSchema` rejects it
- API success/error envelopes and request IDs
- permission checks and recovery-token claims
- same-origin validation
- authentication and profile request schemas
- shared empty and confirmation UI states
- anonymous protected-page redirect and narrow-screen login controls

### Content administration

- strict mutation schemas reject unknown fields and empty updates
- every supported lesson block is accepted
- raw HTML and malformed image blocks are rejected
- page-size cap and unique reorder IDs
- draft/published transitions and terminal archive behavior
- published-state invariant validation for systems, topics, and lessons

### Media and audit

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

## Latest Phase 5 verification results

| Command | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run test` | Passed: 61 files, 205 tests; 4 PostgreSQL integration tests skipped |
| Migration preflight/deploy | Passed after confirming `AssessmentAttempt` count was zero; deployed `20260713090000_add_assessment_snapshot_guards` |
| Prisma migration status | Current |
| `npm run test:e2e` | Passed against the existing live development server: 3 passed, 1 skipped |
| `npm run build` | Passed without a `CRON_SECRET` process override |
| `npm run env:check` | **Failed** only for invalid `CRON_SECRET`; configuration gate remains open |
| OpenAPI structural validation | Passed |

The lint/typecheck/test/build/E2E and migration results above are the latest known Phase
5 implementation record. The four skipped tests are the conditional
`features/assessments/postgres.integration.test.ts` cases; no dedicated
`TEST_DATABASE_URL` was supplied. Do not report environment validation or Phase 5
deployment configuration as complete until a valid secret of at least 32 characters is
installed. The environment-schema regression test proves that shared runtime validation
accepts a short cron-only value while cron-boundary validation rejects it. The failed
`env:check` result is intentional because `envCheckSchema` remains the deployment gate;
it does not contradict the successful build without a secret override. OpenAPI is valid
and migration status is current.

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
- dedicated PostgreSQL concurrent attempt submission/finalization and the deployed
  assessment guards in this environment
- Supabase provider/auth behavior or actual private Storage signed-URL generation
- authenticated admin UI CRUD, media, lifecycle, audit, flashcard, and question flows
- full authenticated learner assessment start/answer/expiry/submit/result/retake E2E
- deployed cron secret injection and one-minute scheduler invocation

Most service/route transaction and provider behavior uses mocks. A conditional
PostgreSQL suite exists but was skipped (four tests) without `TEST_DATABASE_URL`, so
database guards and concurrency must not be reported as tested in the latest run.

## Required future test layers

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

### End to end

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
13. Exercise the deployed one-minute cron with a valid secret and multiple due batches.

## Completion gate

Run, in order:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run env:check
```

Record exact results in `docs/PHASE_STATUS.md`. A command is not passed unless it was
actually run; document external blockers rather than weakening assertions.
