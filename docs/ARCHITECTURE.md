# AnatoLearn Architecture

## Status

Phases 0-5 are implemented. Phase 5 application code and migration are complete; the
deployment configuration remains gated on a valid `CRON_SECRET`. This document
describes current behavior; future work is called out explicitly.
`MASTER_BUILD_PROMPT.md` is the authoritative product scope because no separate product
SRS is present.

## Current stack

- npm with `package-lock.json`
- Next.js 16.2.10 App Router, React 19.2.4, and strict TypeScript
- Tailwind CSS 4 semantic tokens and shadcn-compatible source components
- Prisma 6.19.1 over Supabase PostgreSQL
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
- Cookie-authenticated mutations require a safe same-origin `Origin`/`Host` check.
  Bearer requests do not depend on browser Origin headers.

## Feature organization through Phase 5

```text
app/(admin)/                    protected Server Component pages and server actions
app/api/v1/admin/              admin resource, media, and audit handlers
app/api/v1/{organ-systems,topics,media}/  authenticated published-content handlers
app/api/v1/{assessments,attempts,progress,dashboard}/ learner assessment/progress handlers
app/api/internal/attempts/expire/ secret-authenticated GET/POST expiry worker
components/phase3/             list cards, forms, statuses, and action feedback
components/{flashcards,questions,admin}/ Phase 4 forms, previews, lists, bulk actions
features/content/              schemas, DTOs, lifecycle rules, services, handlers
features/media/                image inspection, upload/storage, DTOs, schemas
features/audit/                audit query schema and read service
features/flashcards/           admin/public/progress schemas, DTOs, services, handlers
features/questions/            admin services plus internal assessment selection
features/assessments/          snapshots, attempt lifecycle, finalization, admin reads
features/progress/             lesson progress, authoritative reports, cached projection
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
changes, and terminal archive. Publishing requires a published topic beneath a
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
terminal archive, active/inactive, duplicate as a new active draft with new option
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
and an 8-second loop budget. `vercel.json` invokes it every minute. It requires an exact
`Authorization: Bearer <CRON_SECRET>` comparison and returns `503` when no secret is
configured.

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
`/users/{id}` progress page/API. It is read-only and does not yet provide the Phase 6
general user list or account-management workflow.

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
`ARCHIVED` is terminal. API `DELETE` on systems/topics/lessons is an archive operation
and returns the archived DTO; it does not hard-delete or cascade child status.

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
archived and returns `409 REFERENCED`. Physical deletion is
deliberately disabled: `DELETE` returns `404` for an absent ID and otherwise returns
`409 HARD_DELETE_DISABLED` with guidance to archive.

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

## Known limitations

- The lesson editor is a schema-validated JSON textarea. It does not yet provide
  visual block controls, preview, drag reordering, or unsaved-change protection.
- The UI accepts managed media UUIDs as text; it has no media picker.
- Admin list pages expose only a subset of API filters/sort controls. Pagination links
  preserve the current query filters while changing the page.
- Published DTOs still expose legacy URL fields or managed media IDs rather than
  embedding signed URLs; clients must make a separate authenticated media request.
- The dedicated PostgreSQL assessment/concurrency suite was not run because
  `TEST_DATABASE_URL` was not configured; four integration tests were skipped. Unit
  tests mock transaction boundaries, and no real concurrent-submit orchestration ran.
- Supabase provider/auth and signed-URL integration is mocked. Authenticated full CRUD
  and full learner assessment browser coverage is absent.
- Cron finalization requires a deployment `CRON_SECRET` of at least 32 characters and
  the Vercel schedule to be deployed. Cron-only validation is isolated from shared
  runtime startup, and the production build passes without a `CRON_SECRET` override, but
  the current environment check intentionally fails on the invalid configured secret.
  Phase 5 is therefore implementation-complete but not configuration-complete.
- Rate limiting is process-local and development-only; production requires a shared
  store.

## Next phase

Phase 6 implements the real admin dashboard, feedback, and notifications per the
authoritative plan. Existing device-token routes predate that phase; campaign/delivery
behavior and the safe provider adapter remain future work.
