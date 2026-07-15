# AnatoLearn Architecture

## Status

Phases 0-7 are implemented in the repository and all nine migrations are current in the
configured development database. Production readiness remains externally gated by cron,
Upstash, provider, authenticated-E2E, backup/restore, and deployment work. This document
describes current behavior; it does not claim a production deployment.
`MASTER_BUILD_PROMPT.md` is the authoritative product scope because no separate product
SRS is present.

## Current stack

- npm with `package-lock.json`
- Next.js 16.2.10 App Router, React 19.2.4, and strict TypeScript
- Tailwind CSS 4 semantic tokens and shadcn-compatible source components
- Prisma 6.19.3 over Supabase PostgreSQL
- Supabase Auth, SSR cookie sessions, bearer-token verification, and private Storage
- Zod 4 request/content/environment validation
- Vitest/React Testing Library and Playwright

## System boundary

```text
Admin browser (SSR cookie)       API client (Supabase bearer token)
             |                                 |
             +--------- Next.js server --------+
                       |              |
              protected RSC UI    /api/v1 handlers
                       |              |
                       +-- auth/validation --+
                                  |
                         feature services
                         /       |       \
                    Prisma   Storage   Supabase Auth
                       |         |           |
                  PostgreSQL  private bucket identity provider
```

The Next.js server is the application authorization boundary. Browser and API clients
do not query application tables through Supabase Data APIs. Prisma is the application
data-access layer; Supabase clients are limited to Auth, sessions, Storage, and
privileged server-only Auth operations.

## Authentication and authorization flow

- The protected `(admin)` layout calls `requireAdminPage()` before rendering. Missing
  sessions redirect to `/login?reason=session-required`; inactive or non-admin
  profiles redirect to `/login?reason=admin-required`.
- API identity resolution accepts a Supabase bearer token when `Authorization` is
  present, otherwise it uses the SSR cookie session. It then loads the matching
  active `Profile`; role is never accepted from request data.
- Published-content APIs require any active profile. Admin resource and audit/media
  APIs require an active `ADMIN` profile.
- Cookie-authenticated mutations require an `Origin` whose exact parsed origin matches
  `NEXT_PUBLIC_APP_URL`. Missing/malformed origins fail closed; bearer requests do not
  depend on browser Origin headers.

## Phase 7 platform hardening

- `proxy.ts` creates a per-request nonce and applies a dynamic CSP to request and response
  processing. Scripts use `'nonce-…'` plus `'strict-dynamic'`; development alone permits
  `'unsafe-eval'`. Objects and framing are denied, form/base origins are constrained, and
  Supabase is allowlisted only for image/connect needs. Inline styles remain allowed for
  current Next/Tailwind behavior.
- Global headers add frame, MIME-sniffing, referrer, and feature restrictions. HSTS
  (`max-age=31536000; includeSubDomains`) is emitted only in production.
- JSON responses carry `X-Request-ID`. The default/error policy is `private, no-store`
  with `Vary: Authorization, Cookie`; health and meta explicitly opt into public 30s/300s
  caching without `Vary`.
- Unexpected API errors produce a single structured JSON log containing only level,
  request ID, safe code/status, and optional route. Request bodies, credentials, provider
  messages, stack traces, and arbitrary exception text are not logged.
- The rate-limit interface uses an atomic Upstash Redis REST script when both credentials
  are configured. Production environment validation requires the pair and fails closed
  if limiting is unavailable. Development/test may use a bounded 10,000-key memory
  adapter. Authentication checks separate hashed client and normalized-account keys;
  trusted client addresses come only from Vercel's forwarded header in Vercel runtime.

## Feature organization through Phase 7

```text
app/(admin)/                    protected Server Component pages and server actions
app/api/v1/admin/              admin resource, media, and audit handlers
app/api/v1/{organ-systems,topics,media}/  authenticated published-content handlers
app/api/v1/{assessments,attempts,progress,dashboard}/ learner assessment/progress handlers
app/api/internal/attempts/expire/ secret-authenticated GET/POST expiry worker
app/api/internal/notifications/process/ secret-authenticated GET/POST delivery worker
app/api/internal/trash/purge/             secret-authenticated daily Trash/storage worker
components/phase3/             list cards, forms, statuses, and action feedback
components/{flashcards,questions,admin}/ Phase 4 forms, previews, lists, bulk actions
components/lessons/             seven-block visual editor and learner preview
components/media/               private managed-media picker and upload controls
features/content/              schemas, DTOs, lifecycle rules, services, handlers
features/media/                image inspection, upload/storage, DTOs, schemas
features/audit/                audit query schema and read service
features/flashcards/           admin/public/progress schemas, DTOs, services, handlers
features/questions/            admin services plus internal assessment selection
features/assessments/          snapshots, attempt lifecycle, finalization, admin reads
features/progress/             lesson progress, authoritative reports, cached projection
features/admin-dashboard/      real aggregate dashboard queries and DTOs
features/users/                learner directory, detail, and active-state management
features/feedback/             learner submission/history and admin triage
features/notifications/        tokens, campaigns, provider adapter, delivery worker
lib/api/                       envelopes, admin guard, centralized error mapping
lib/auth/                      cookie/bearer identity and page guards
```

Admin Server Components and REST handlers call the same feature services. Route
handlers remain responsible for authentication, origin checks, parsing, and
envelope/status mapping.

## Phase 4 learning-item flows

### Flashcards

Admin handlers and Server Components share the flashcard service. Admin lists are
paginated and filter by search text, status, difficulty, topic, and organ system. The
service provides create/read/update, scoped reorder, individual and bulk status
   changes, and recoverable Trash. Publishing requires a published topic beneath a
published active organ system and unarchived referenced media.

`GET /api/v1/topics/{id}/flashcards` is an authenticated learner read, not an anonymous
route. It returns all eligible published cards ordered by display order and ID with the
requesting user's progress or `null`. `PUT /api/v1/flashcards/{id}/progress` uses a
client UUID `eventId`: a new event increments `viewedCount` once and optionally updates
difficult/mastered flags; replay for the same user/card returns current progress, while
reuse for another card returns `409`. The serializable transaction retries transaction
conflicts up to three times.

### Questions and strict option aggregate

Questions are an admin-only aggregate. Create and option replacement happen in one
transaction. Every accepted aggregate contains 2-6 options and exactly one correct
option. Existing option IDs are accepted only when they belong to that question;
retained options preserve stable IDs and answer keys, while all options are relabeled
`A` onward with contiguous one-based display order. DTO construction revalidates the
stored cardinality, correct-answer count, labels, and ordering and fails closed.

Question operations include filtered/paginated list, create/read/update, publish/draft,
recoverable Trash, active/inactive, duplicate as a new active draft with new option
IDs/keys, and transactional bulk status. There is deliberately no learner/public
question-bank route.

`features/questions/selection-service.ts` is the internal Phase 5 boundary. It selects
by assessment type, organ system, optional topics/difficulty in stable ID order, then
retains only published active questions under a published topic/active published
system with 2-6 options, one correct answer, and no archived question/option media.

## Phase 5 assessment engine

### Start and immutable snapshot flow

`POST /api/v1/assessments/start` derives the owner from the active cookie or bearer
identity. Its strict body chooses `QUIZ` or `TEST`, one organ system, 5-50 questions,
and optionally 1-100 unique topic IDs. An omitted topic list means all published topics
under the requested published, active system. Supplied topics must all be published and
belong to that system.

The serializable start transaction:

1. share-locks and validates the system/topic scope;
2. reads eligible questions through the internal selection service;
3. Fisher-Yates shuffles and selects the requested count, then locks and revalidates
   those source questions;
4. reads PostgreSQL `clock_timestamp()` and snapshots question text, explanation,
   question/option legacy image fields and managed media IDs, topic/system names and
   IDs, difficulty, concept tag, options, and the correct option;
5. gives every shuffled snapshot option a new UUID key and stores question order once;
6. creates the attempt, topic links, and question snapshots atomically.

The snapshot, not current source content, is the historical authority. A retake uses
the source attempt's type, system, sorted topic scope, and originally requested count,
but performs a new eligibility query, random question/option shuffle, and snapshot. It
is therefore a fresh attempt rather than a copy of the old questions.

### Ownership, DTO privacy, and answers

All learner attempt operations scope the row lock/query by both attempt ID and the
verified profile ID. A missing attempt and another user's attempt both return `404`.
Cookie mutations require a safe same-origin request; bearer clients do not send owner
or role data.

The general attempt-detail DTO never includes score fields, `correctOptionKey`,
`isCorrect`, or explanation, even after submission. Learner list items include result
counts/score/duration only for `COMPLETED` and `AUTO_SUBMITTED`. The dedicated result
route exposes immutable result fields and explanations only for those two statuses.
Admin attempt DTOs follow the same pre-submission privacy rule and expose results only
after submission.

Answer updates accept a snapshot option UUID or `null` to clear the answer, plus an
optional integer `timeSpentSeconds` from 0 through 86,400. The selected key must belong
to that attempt question. Time spent is monotonic (the stored maximum); replaying the
same answer/time is a no-op, changing an answer records database time, and clearing it
clears `answeredAt` and correctness. The answer response does not disclose correctness.

### Timing, scoring, and expiry

Quizzes have `timeLimitSeconds`/`expiresAt` set to `null`. Tests receive 60 seconds per
requested question. Expiry uses database time and becomes effective at `now >=
expiresAt`. Submission locks the owned attempt and is idempotent: a submitted replay
returns the existing result without rescoring or refreshing progress. Unanswered
questions remain distinct from incorrect questions; all presented snapshot questions
form the score denominator. Percentages are rounded to two decimals.

Manual submission before expiry produces `COMPLETED`; submission or a lazy read at/after
test expiry produces `AUTO_SUBMITTED`. Auto-submitted duration is capped at the time
limit. An answer request that discovers expiry commits auto-submission first, then
returns `409 ATTEMPT_EXPIRED`. Abandoned attempts cannot be submitted, viewed through
the result endpoint, or retaken; this phase adds no abandon mutation route.

Expiry is both eager and lazy. Owned attempt/result reads, retakes, learner lists,
progress/dashboard reads, and admin attempt reads finalize relevant due tests before
returning. List/report paths claim at most 50 due rows per call. The internal GET/POST
worker claims 50 rows per batch using `FOR UPDATE SKIP LOCKED`, with at most 10 batches
and an 8-second loop budget. GitHub Actions invokes it approximately every ten minutes
through the protected repository workflow, while Vercel's Hobby-compatible `vercel.json`
retains only the daily Trash purge. It requires an exact `Authorization: Bearer
<CRON_SECRET>` comparison and returns `503` when no secret is configured.

`CRON_SECRET` is isolated from shared application startup. `serverEnvSchema` does not
contain it, so a missing, blank, or short cron-only value cannot crash ordinary routes or
the production build. Only the internal worker calls `getCronEnv()`, which parses
`cronEnvSchema` at that boundary. Missing/blank configuration becomes an unavailable
worker (`503`); a configured value shorter than 32 characters raises a validation error
inside the route and is returned safely by the centralized error mapper. The broader
`envCheckSchema` deliberately composes cron validation back into `npm run env:check`, so
a short configured secret remains a deployment configuration failure.

## Progress and reporting

`PUT /api/v1/content-lessons/{id}/progress` writes the authenticated user's absolute
completion state only for a currently published lesson beneath a published topic and
published, active system. Repeating `completed: true` preserves the first completion
timestamp; either state updates `lastViewedAt`. Serializable retries cover conflicts.

The `TopicProgress` table is a write-time projection refreshed in the same transaction
after lesson completion, flashcard progress, and assessment finalization. It stores four
percentages for affected user/topic pairs. It is not the authority used by the Phase 5
reporting routes: `/progress`, `/progress/{organSystemId}`, `/dashboard/me`, and admin
user progress recompute from source lesson/flashcard rows plus immutable submitted
attempt snapshots.

For current published systems/topics:

- content = completed current published lessons / current published lessons;
- flashcards = mastered current eligible published cards / current eligible published
  cards (cards with archived side media are excluded);
- quiz/test accuracy = correct snapshot questions / all snapshot questions of that type
  in `COMPLETED` or `AUTO_SUBMITTED` attempts, attributed by both snapshot system and
  topic ID. Unanswered questions remain in the denominator.

Each metric returns numerator, denominator, and a two-decimal percentage. A zero
denominator is `{ numerator: 0, denominator: 0, percentage: 0 }`; it means no eligible
data, not completion. System metrics sum numerators and denominators before calculating
the percentage, so they are weighted rather than averages of topic percentages.

`GET /api/v1/dashboard/me` reports submitted attempt totals (including auto-submitted),
weighted all-question accuracy, up to 10 recent submitted attempts, current system/topic
metrics, and snapshot-based strengths/weaknesses. A topic needs at least five submitted
snapshot questions. Strengths sort highest accuracy first and weaknesses lowest first;
both return at most five, so small eligible sets can overlap. Ties prefer more samples,
then topic ID. Historical snapshot titles are retained in those rankings.

Admin reporting consists of paginated attempt list/detail APIs and pages plus a narrow
`/users/{id}` progress API. Phase 6 extends this with a learner-only directory, safe
detail/activity data, and activate/deactivate operations; it never changes roles or
deletes history.

## Phase 6 dashboard, users, feedback, and notifications

### Admin dashboard

`GET /api/v1/admin/dashboard` and `/dashboard` share one repeatable-read aggregation.
`days=7|30|90` (default 30) controls a gap-filled UTC daily quiz/test attempt trend. The
other counts and question-weighted quiz/test accuracy are all-time. Accuracy divides
correct immutable submitted snapshots by all submitted snapshot questions, including
unanswered questions.

Content completeness is grouped by non-archived organ system and uses non-archived
topics as each metric denominator. A complete topic requires a published active system,
published topic, at least one eligible published lesson and flashcard, and at least one
eligible active published quiz and test question with a valid option aggregate and
unarchived media. The DTO states these criteria explicitly. Recent data is bounded to
five learner registrations, five feedback submissions, and ten audit events; the audit
projection excludes snapshots, email, user agent, and IP hash.

### Learner account management and feedback

`features/users` always filters `Profile.role = USER`. Lists support search, active
state, creation bounds, stable sorting, pagination, and unfiltered active/inactive/new-
30-day summary counts. Detail adds attempt/submitted-attempt/feedback counts and latest
attempt time. Activate/deactivate locks the profile, is idempotent, and audits only a
real state change. Deactivation preserves every profile/history row, disables active
device tokens, and cancels only `PENDING` deliveries; activation does not reactivate old
tokens.

Active learners submit strict typed feedback at five requests per minute through the
configured rate-limiter adapter and can list only their own rows. Learner DTOs omit `adminNotes`, reviewer,
resolver, and attribution timestamps. Admin list/detail DTOs include those fields and
support review/resolve transitions. Feedback audit snapshots contain status/timestamps
and an `adminNotesChanged` boolean, never the learner message, notes text, or submitter
PII. No-op updates create no audit event.

### Notification lifecycle and evidence

The notification environment schema is isolated from shared runtime validation.
`EXPO_PUSH_ENABLED` defaults false and an access token is optional; provider status
reports only `enabled` and `ready`. Draft creation/update and scheduling remain usable
without a provider. Send-now checks readiness before its transaction, so a disabled or
misconfigured provider returns `503` without campaign mutation. The internal worker also
returns zero counts without mutation when no provider is ready.

Drafts target all active learners or 1-500 unique selected active learner IDs. Scheduling
uses database time and requires at least 60 seconds' notice. Send-now returns `202` after
moving a draft to `PROCESSING`; it does not call that campaign delivered. Cancellation
is idempotent for `CANCELLED`, otherwise allowed only from `DRAFT`/`SCHEDULED`, and
cancels pending deliveries. Campaign mutations append redacted audits containing type,
status, target type/count, and recipient count—not title, message, user IDs, tokens, or
provider credentials.

The worker claims due campaigns and deliveries with `FOR UPDATE SKIP LOCKED` and opaque
lease tokens. The audience and currently active device-token snapshots are materialized
exactly once; recipient and delivery identity/snapshots are database-immutable. Provider
ticket acceptance records `TICKETED`. Only a successful Expo receipt records delivery
`SENT`. Receipt errors become `FAILED`; `DeviceNotRegistered` also disables the token.
Transient sends retry at 30s, 60s, 5m, 15m, and 60m, for at most five attempts. Tickets
are polled after 15 seconds and fail as `RECEIPT_UNAVAILABLE` after 20 polls or 23 hours.

Campaigns remain `PROCESSING` while any delivery is pending/ticketed, then become `SENT`
only when every recipient has a receipt-confirmed delivery, `PARTIAL` when some but not
all do, or `FAILED` when none do (including an audience with no delivery). The worker is
bounded to five campaigns, 500 delivery operations, and eight seconds per invocation.
An unavoidable at-least-once window exists if the process crashes after Expo accepts a
send but before the ticket is persisted.

Learner notification lists expose only recipients for `SENT`/`PARTIAL` campaigns and
mark-read is owner-scoped and idempotent. Device tokens and immutable token snapshots are
never returned by campaign, delivery, learner, or provider-status DTOs.

## Core content data flow

### Admin mutation

1. Resolve the authenticated active admin.
2. For cookie mode, verify same-origin mutation intent.
3. Parse an allowlisted strict Zod schema.
4. In a Prisma transaction, validate parent and managed-media references, write the
   resource, and append an `AuditLog` row.
5. Return an explicit admin DTO or server-action state.

Create/update schemas do not accept status, actor IDs, timestamps, or audit fields.
Status transitions and reorder operations have separate request schemas.

### Published content read

1. Resolve an active cookie or bearer identity.
2. Require the organ system to be `PUBLISHED` and active.
3. Require child topics and lessons to be `PUBLISHED`.
4. Project a public DTO without editorial status, managed-media IDs (except image
   block references), or timestamps.

Published endpoints cover systems, a system by slug, system topics, a topic by ID, all
published lessons and flashcards for a topic, and eligible managed media by ID. Lesson
and flashcard lists are ordered by `displayOrder`, then ID; they are not paginated.

## Content model and lifecycle

- `OrganSystem`: globally unique name/slug, optional managed cover/icon, non-negative
  display order, status, and independent active switch.
- `Topic`: unique slug within an organ system, optional managed cover, display order,
  and status.
- `ContentLesson`: unique slug within a topic, validated structured JSON blocks,
  estimated reading minutes, display order, and status.
- `MediaAsset`: private storage object metadata, required alt text, image dimensions,
  uploader, and optional archive timestamp.
- `AuditLog`: actor/action/entity, snapshots, request ID, and timestamp. A database
  trigger rejects updates and deletes, making rows append-only.
- `Flashcard`: topic-scoped front/back text and optional managed media, difficulty,
  editorial notes, display order, lifecycle, per-user progress, and idempotent views.
- `Question`: quiz/test type, topic, prompt, explanation, difficulty/concept tag,
  lifecycle and activity; owns ordered `QuestionOption` rows as one strict aggregate.
- `AssessmentAttempt`: owner/type/system/scope counts, server timing, terminal result,
  status, retake lineage, topic links, and ordered immutable `AttemptQuestion` snapshots.
- `ContentLessonProgress`: absolute completion and last-view timestamps per user/lesson.
- `TopicProgress`: derived write-time percentage projection; reporting reads recompute
  from authoritative lesson, flashcard, and attempt data.

Content starts as `DRAFT`. Draft and published content may move between those states.
Trash is the recoverable lifecycle for six resource types: organ systems, topics, lessons,
flashcards, questions, and media. DELETE/archive aliases set archive state and Trash
metadata using the database clock, hide the item immediately, and set a 30-day
`purgeAfter`. Restore is allowed only before that deadline; restored content is DRAFT and
is never republished automatically. Parent restore requires an available parent.

Normal lesson-editor block deletion is separate from resource Trash and is confirmed
before the lesson is saved.

Publishing a topic requires its organ system to be published and active. Publishing a
lesson requires a published topic, a published/active organ system, and at least one
stored block. Archiving or deactivating a parent makes descendants inaccessible from
published APIs without rewriting child status.

Normal updates also validate the resulting state. A published system cannot be made
inactive, and updates to published topics/lessons must retain their parent-publication,
active-system, non-empty lesson, and unarchived managed-media invariants.

Collection `PATCH` performs transactional reordering. It requires a complete caller-
chosen ID sequence within the declared parent scope and assigns zero-based positions.
The service does not require the sequence to contain every sibling in that parent.

## Structured lessons

Allowed blocks are:

- heading at level 2, 3, or 4
- paragraph
- image with a managed media UUID, required alt text, and optional caption
- info, warning, or success callout
- bullet or numbered list with 1-50 items
- divider

Unknown fields and unrestricted HTML blocks are rejected. A lesson may contain at
most 200 blocks. Blocks may carry optional 1-100 character stable IDs, which must be
unique within the lesson. Managed image references must exist and be unarchived when
the lesson is created or when its blocks are updated. Stored blocks are revalidated
while building DTOs; malformed stored content produces a safe `500` response.

The admin UI now edits this contract visually rather than as raw JSON. It supports all
seven block types, validated side-by-side learner preview, duplication, button and
Alt+Up/Alt+Down reordering, confirmation before deleting non-empty content, and an
unsaved-navigation/before-unload guard. The serialized server input still passes through
the same strict schema; the editor does not broaden the API contract.

Managed-media selection is a server-action-backed, paginated/searchable dialog showing
only unarchived assets with short-lived admin previews. It is used for system covers/
icons, topic covers, lesson images, flashcard sides, questions, and question options.

## Media flow

1. An admin submits multipart `file` and `altText`.
2. The server enforces the configured byte limit and uses Sharp 0.35.3 to identify and
   fully decode PNG/JPEG/WebP input. Decoding fails on image errors and is limited to
   12,000 pixels per axis and 40,000,000 total pixels. The detected type must be
   allowlisted and must match a non-empty declared MIME.
3. The server creates `media/{actorId}/{assetId}.{ext}`; the client filename is stored
   only as metadata and is truncated to 255 characters.
4. The object is uploaded to the configured private bucket. Metadata and a `CREATE`
   audit row are then written transactionally. A database failure triggers a best-
   effort object removal.
5. Admin media DTOs omit bucket/path and serialize database `BigInt` `byteSize` as a
   decimal string. A 900-second signed URL is included when preview signing succeeds;
   a transient signing failure returns null preview fields without misreporting the
   already committed upload or metadata mutation as failed. Object compensation runs
   only when metadata/audit persistence fails.

Media listing is paginated and ordered newest first. It filters by filename/alt text,
MIME, archive state, and uploader. Alt-text updates are audited. Archive is idempotent;
an already archived asset is returned without another audit row. An unarchived asset
referenced by an eligible published system cover/icon, topic cover, or published
lesson, eligible flashcard side, active published question, or its option cannot be
archived and returns `409 REFERENCED`. The legacy physical-media DELETE endpoint remains
disabled; the media archive action is the Trash entry point. Trash purge is dependency-
aware and leaf-first, preserving attempts, progress, audits, and notification evidence;
blocked expired rows are retried later rather than deleted.

`GET /api/v1/media/{id}` requires an active cookie or bearer identity. It returns a
minimal DTO with a 300-second signed URL for either an unarchived eligible published
reference or a media ID preserved in one of the requesting owner's attempt question/
option snapshots. The historical authorization permits archived assets but does not
permit another user's snapshot; absent and unauthorized IDs return `404`. Protected
admin attempt pages batch-sign snapshot media, including archived assets, for 900
seconds without exposing bucket/path. A failed admin preview signature omits that
preview rather than failing the entire media or attempt-detail page; learner delivery
continues to require a valid signature.

Migration `20260713024000_add_phase4_content_indexes` adds reverse media indexes for
both flashcard media columns and question media, plus list indexes on flashcard status/
difficulty/update time and question type/status/activity/update time. It has been
applied with Prisma deploy.

Migration `20260713090000_add_assessment_snapshot_guards` was deployed after an explicit
zero-attempt count check. Its SQL also contains its own preflight and aborts if
`AssessmentAttempt` is non-empty because historical topic/system/media/difficulty
snapshots cannot be synthesized safely. It adds `topicIdSnapshot`,
`topicTitleSnapshot`, `difficultySnapshot`, nullable `conceptTagSnapshot`,
`organSystemIdSnapshot`, `organSystemNameSnapshot`, and nullable `mediaIdSnapshot` to
`AttemptQuestion`; adds attempt-history and snapshot scope/difficulty indexes; and adds
database checks/triggers for status/timing consistency, exact test expiry arithmetic,
immutable attempt scope/timing and terminal results, immutable snapshot columns,
answer changes only while in progress, child insertion only while in progress, and no
deletion of attempt history (or update/delete of attempt-topic links).

Phase 6 deployment is intentionally split into two migrations because PostgreSQL cannot
use a newly added enum label in later statements of the same transaction. Migration
`20260714120000_add_phase6_feedback_notification_foundation` performs empty notification-
table preflights and adds `PROCESSING`, `PARTIAL`, `FAILED`, and `TICKETED` enum labels.
After that commits, `20260714121000_add_phase6_feedback_notification_structure` repeats
the preflight and adds feedback resolution attribution, campaign/delivery leases,
retry/receipt evidence, indexes, consistency checks, foreign keys, and immutable
recipient/delivery history triggers. Both were deployed; five migrations were current at
the Phase 6 close.

Phase 7 adds `20260714130000_deny_direct_application_database_access` and
`20260714131000_restrict_application_schema_access`. The first explicitly revokes all
application-table and sequence privileges from Supabase `anon`/`authenticated`, enables
RLS on all 21 application tables, revokes direct execution of invariant trigger
functions, and establishes matching default privileges. The second grants schema
`USAGE` but revokes schema `CREATE`. Both resolve `current_schema()`, refuse `auth` or
`storage`, and are deployed only to the configured development database. Isolated role
tests prove `anon`/`authenticated` reads and writes fail while Prisma remains operational.

`20260714140000_add_trash_audit_actions` adds `TRASH`, `RESTORE`, and `PURGE` audit
actions. `20260714141000_add_safe_trash` adds retention metadata, database-clock guards,
dependency-safe purge support, and `MediaPurgeJob`. Both migrations are deployed and
current in the configured development database. The protected `GET`/`POST
/api/internal/trash/purge` worker requires the exact `Authorization: Bearer <CRON_SECRET>`
value, runs at `0 3 * * *`, and is bounded to four batches of 25 or eight seconds.
Storage removal is confirmed before a `MediaPurgeJob` is deleted; failures release the
lease and retry after one day. Legacy `ARCHIVED` rows without Trash metadata are not
automatically purged.

## Pagination, filtering, and sorting

Admin lists default to page 1 and page size 20 and cap page size at 100. Content,
flashcard, and question sorts add ID as a stable tie-breaker. Flashcards filter by text,
status, difficulty, topic, and system. Questions filter by text, type, topic/system,
difficulty, status, activity, and concept tag. Media uses `search`, `mimeType`,
`archived`, and `uploadedById` with fixed newest-first sorting. Audit uses action,
entity type/ID, actor, and inclusive ISO date bounds with fixed newest-first sorting.
Learner attempts use type/status/system filters with fixed newest-first ordering. Admin
attempts additionally filter learner search/ID, snapshot topic, inclusive started-at
bounds, and sort by started/completed time, score, or duration with ID tie-breaking.
Phase 6 users additionally filter `q`, `isActive`, and inclusive `createdFrom`/
`createdTo`, sorting by creation/name/email/last login. Feedback filters `q`, type,
status, user, and creation bounds and sorts by creation/status/type. Campaigns filter
status with newest-first ordering; recipient and delivery evidence lists are paginated.

List API metadata is currently nested as:

```json
{ "meta": { "requestId": "uuid", "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 } } }
```

## Audit behavior

Content and flashcard create/update/reorder/publish/archive; question create/update,
publish/draft/archive, activity, duplicate, and bulk lifecycle; and media upload/alt-
text update/first archive append audit records. Mutations capture before/after records;
media snapshots contain selected metadata. Audit APIs and UI are read-only and admin-
only. The audit response includes actor ID/name/email and snapshots, but omits IP hash
and user agent. Content, flashcard, and question API mutations store user agent when
supplied; current media mutations do not.

Phase 5 learner attempt, answer, submission/expiry/retake, and lesson-progress writes do
not append `AuditLog` rows. Their history is represented by owned attempt/progress rows
and the assessment migration's immutability/lifecycle guards. Admin Phase 5 reporting
routes are read-only.

Phase 6 audits real learner activation/deactivation, feedback admin changes, and campaign
create/update/schedule/cancel/send transitions. User snapshots contain only active state;
feedback snapshots omit message, note text, and PII; notification snapshots omit message,
title, selected IDs, device tokens, provider IDs, and credentials. Learner feedback
submission/read state and worker delivery transitions are operational history, not admin
audit events.

## Known limitations and external gates

- Reordering uses accessible up/down controls and keyboard shortcuts rather than drag and
  drop. Published clients still make a second authenticated request for signed media.
- Admin list pages expose only a subset of API filters/sort controls. Pagination links
  preserve the current query filters while changing the page.
- Published DTOs still expose legacy URL fields or managed media IDs rather than
  embedding signed URLs; clients must make a separate authenticated media request.
- The dedicated PostgreSQL assessment/concurrency suite passed against the migrated
  isolated `anatolearn_phase5_test` schema. It verifies deployed guards, source snapshot
  stability, and multi-client concurrent finalization. The run exposed Prisma raw-query
  `P2010`/SQLSTATE `40001` serialization errors, which are now retried with `P2034` and
  PostgreSQL deadlocks (`40P01`). The suite remains conditional in ordinary local runs
  without a distinct `TEST_DATABASE_URL`.
- Supabase provider/auth and signed-URL integration is mocked. Authenticated full CRUD
  and full learner assessment browser coverage is absent.
- Cron finalization requires a deployment `CRON_SECRET` of at least 32 characters, the
  Vercel daily schedule, and the GitHub Actions workflow secrets. Cron-only validation is
  isolated from shared runtime startup, and the production build passes without a
  `CRON_SECRET` override; deployment still requires configured production secrets.
  Phase 5 is therefore implementation-complete but not configuration-complete.
- Distributed limiting is implemented, but production requires provisioned and verified
  paired Upstash credentials. Development/test intentionally use process memory when the
  pair is absent.
- Expo provider behavior is unit-tested at the adapter boundary but has not been verified
  with real credentials/devices. The provider can be disabled or misconfigured.
- Notification-worker lease behavior lacks a real PostgreSQL multi-worker concurrency
  test. A provider-acceptance/persistence crash can cause at-least-once duplicate sends.
- The final Playwright run passed 17 public/security/accessibility cases and skipped 14.
  Authenticated admin tests were skipped because `E2E_ADMIN_EMAIL` and
  `E2E_ADMIN_PASSWORD` were absent; no authenticated success is implied.
- The two access-control migrations are deployed to configured development and isolated-
  role tested, not claimed in production. Real Supabase Auth email/redirect/Storage,
  backup/restore, Vercel deployment, and optional monitoring remain external gates.

## Delivery boundary

Phase 7 repository implementation is complete. Production deployment readiness remains
gated on a valid random `CRON_SECRET`, the Vercel daily schedule, and the GitHub Actions
scheduler, production Upstash credentials,
real Expo/EAS ticket/receipt/partial/device testing, authenticated admin E2E credentials,
real Supabase provider integration, and backup/restore plus deployment verification.
