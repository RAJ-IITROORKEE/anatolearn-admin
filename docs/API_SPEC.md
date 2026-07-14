# AnatoLearn API Specification

## Current contract

This document covers implemented routes through Phase 6. Routes assigned to later
phases are not part of the current API. The machine-readable equivalent is
`docs/openapi.yaml`.

- Base path: `/api/v1`, except liveness at `/api/health`
- JSON success: `{ "success": true, "data": ..., "meta"?: ... }`
- JSON error: `{ "success": false, "error": { "code", "message", "fieldErrors"?, "requestId" } }`
- List metadata: `meta.requestId` plus `meta.pagination`
- IDs are UUID strings unless a route uses a slug; timestamps are ISO 8601 strings
- List defaults are `page=1`, `pageSize=20`; maximum `pageSize=100`
- Request validation errors return `400` in the current handlers

Example list metadata:

```json
{
  "requestId": "47bc502d-671a-4e1f-bff5-5505c22fb60a",
  "pagination": { "page": 1, "pageSize": 20, "total": 45, "totalPages": 3 }
}
```

## Authentication labels

- **Public**: no identity required.
- **User**: valid Supabase bearer token or SSR cookie and a matching active profile.
- **Admin**: User whose database profile has role `ADMIN`.
- Cookie-authenticated mutations additionally require a same-origin request.

Missing/invalid/inactive identity returns `401`. An authenticated non-admin receives
`403` on admin APIs. Browser CORS policy is not authorization.

## Platform, authentication, and profile routes

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /api/health` | Public | Liveness only; no dependency or secret details |
| `GET /api/v1/meta` | Public | API version and safe capability flags |
| `POST /api/v1/auth/register` | Public, rate limited | Create Supabase identity and reconcile a USER profile; `201` on success |
| `POST /api/v1/auth/login` | Public, rate limited | Email/password API login and safe session DTO; admin UI uses SSR server actions |
| `POST /api/v1/auth/forgot-password` | Public, rate limited | Non-enumerating reset request with configured redirect |
| `POST /api/v1/auth/reset-password` | Recovery token | Requires provider-verified recovery AMR |
| `POST /api/v1/auth/logout` | User | Cookie sign-out or bearer-session revocation |
| `GET /api/v1/auth/session` | User | Safe session/profile summary |
| `GET /api/v1/me` | User | Authenticated profile DTO |
| `PATCH /api/v1/me` | User | Update allowlisted profile fields |
| `POST /api/v1/me/change-password` | User, rate limited | Delegates password update to Supabase |
| `POST /api/v1/me/device-tokens` | User | Strict Expo token/platform upsert; `201`; DTO omits token text |
| `DELETE /api/v1/me/device-tokens/{id}` | Owner | Deactivate an owned token and cancel its pending deliveries; inaccessible ID is `404` |

Device registration accepts exactly `{ "expoPushToken": "ExpoPushToken[...]", "platform":
"IOS"|"ANDROID" }`. Re-registering a token moves it to the current active owner; pending
deliveries for a previous owner are cancelled first. Token text is never returned.
The current meta payload reports `capabilities.notifications: true` because the Phase 6
API surface exists; it does not claim that the optional Expo provider is enabled or ready.

## Published learning-content routes

All routes below require **User** access. They return only published content beneath
a published, active organ system. Draft, archived, inactive-parent, and absent records
are indistinguishable as `404` for item/parent lookups.

| Method and path | Query | Response behavior |
| --- | --- | --- |
| `GET /api/v1/organ-systems` | `page`, `pageSize`, `q`, `sortBy`, `sortOrder` | Paginated published active systems. Effective sort is `name` only when requested; otherwise `displayOrder`, then ID. |
| `GET /api/v1/organ-systems/{slug}` | none | Published active system DTO or `404` |
| `GET /api/v1/organ-systems/{slug}/topics` | `page`, `pageSize`, `q`, `sortOrder` | Paginated published topics; always sorted by display order then ID |
| `GET /api/v1/topics/{id}` | none | Published topic whose parent is published/active, or `404` |
| `GET /api/v1/topics/{id}/content` | none | All published lessons ordered by display order then ID; not paginated |
| `GET /api/v1/topics/{id}/flashcards` | none | All eligible published flashcards ordered by display order then ID, each with this user's progress or `null`; not paginated |
| `GET /api/v1/media/{id}` | none | Minimal media DTO with a 300-second signed URL for eligible published media or media in this user's historical attempt snapshots; otherwise `404` |

The shared query parser also recognizes `status`, parent IDs, and additional `sortBy`
values, but published handlers ignore options that are not listed as effective above.
Unknown query keys fail strict validation with `400`.

Public content DTOs omit editorial status and timestamps. System/topic DTOs expose
legacy image URL fields and lesson image blocks contain managed `mediaId` values.
Clients resolve those IDs separately through `GET /api/v1/media/{id}`. Eligibility
means an eligible published system/topic/lesson reference, either side of an eligible
published flashcard, an active published question/option beneath eligible parents, or a
question/option snapshot in an attempt owned by the requesting user. Snapshot ownership
can authorize archived historical media; another user's snapshot does not.
The media response contains only `id`, `mimeType`, `width`,
`height`, `altText`, `signedUrl`, and `signedUrlExpiresIn: 300`.

## Admin content APIs

The following collections implement `GET`, `POST`, and `PATCH`; item routes implement
`GET`, `PATCH`, and `DELETE`:

- `/api/v1/admin/organ-systems`
- `/api/v1/admin/topics`
- `/api/v1/admin/content-lessons`

All require **Admin**. `POST` returns `201`; other successful operations return `200`.
`DELETE` archives and returns the updated DTO; it does not hard-delete.

### List query

| Parameter | Validation/effect |
| --- | --- |
| `page` | Integer >= 1; default 1 |
| `pageSize` | Integer 1-100; default 20 |
| `q` | Trimmed, maximum 200; system name/description or topic/lesson title/summary |
| `status` | `DRAFT`, `PUBLISHED`, or `ARCHIVED` |
| `organSystemId` | Topic parent filter |
| `topicId` | Lesson parent filter |
| `sortBy` | `displayOrder`, `name`, `title`, `createdAt`, or `updatedAt`; inapplicable name/title values are normalized to the resource equivalent |
| `sortOrder` | `asc` or `desc`; default `asc` |

Every content list adds ID in the requested direction as a stable tie-breaker. Unknown
query keys return `400 VALIDATION_ERROR`.

### Create/update schemas

All bodies are strict: unknown keys return `400`.

**Organ system create**

```json
{
  "name": "Circulatory",
  "slug": "circulatory",
  "shortDescription": "Heart and blood vessels.",
  "longDescription": null,
  "coverMediaId": null,
  "iconMediaId": null,
  "displayOrder": 0,
  "isActive": true
}
```

`name` max 120, slug max 100 and lowercase kebab-case, short description max 500,
long description max 5000, non-negative integer order. `isActive` defaults to the
database default when omitted.

**Topic create**

```json
{
  "organSystemId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "The heart",
  "slug": "the-heart",
  "summary": null,
  "coverMediaId": null,
  "displayOrder": 0
}
```

Title max 160, summary max 1000, non-negative integer order. Parent and managed-media
references must exist; media must not be archived.

**Lesson create**

```json
{
  "topicId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Heart overview",
  "slug": "heart-overview",
  "summary": "A short introduction.",
  "contentBlocks": [
    { "type": "heading", "level": 2, "text": "Overview" },
    { "type": "paragraph", "text": "Structured educational text." }
  ],
  "estimatedReadingMinutes": 4,
  "displayOrder": 0
}
```

Lesson title max 200, summary max 1000, reading time 0-600, order non-negative, and
at most 200 blocks. Every block may include an optional, trimmed `id` of 1-100
characters. Supplied block IDs must be unique within the lesson. Supported strict block
schemas:

- `{ "type":"heading", "level":2|3|4, "text":"..." }`
- `{ "type":"paragraph", "text":"..." }`
- `{ "type":"image", "mediaId":"uuid", "altText":"...", "caption":null|"..." }`
- `{ "type":"callout", "tone":"info"|"warning"|"success", "title":null|"...", "text":"..." }`
- `{ "type":"bulletList"|"numberedList", "items":["..."] }` with 1-50 items
- `{ "type":"divider" }`

Update accepts any non-empty subset of the corresponding create schema. Status is not
accepted in a normal update. The resulting state is revalidated: updates cannot make a
published system inactive or leave a published topic/lesson with an ineligible parent,
and a published lesson must remain non-empty with valid unarchived media references.

### Lifecycle item `PATCH`

Send exactly `{ "status": "DRAFT"|"PUBLISHED"|"ARCHIVED" }`. A body that does not
match this exact schema is parsed as a normal update.

- Draft and published states can move in either direction.
- Archived state is terminal; restore attempts return `409 INVALID_STATUS_TRANSITION`.
- Topic publication requires a published, active parent system.
- Lesson publication requires a published topic, published/active system, and at
  least one stored block.
- Parent publication/archive does not cascade child status.

### Collection reorder `PATCH`

```json
{
  "parentId": "550e8400-e29b-41d4-a716-446655440000",
  "ids": ["uuid-1", "uuid-2"]
}
```

`parentId` is omitted for systems and required for topics/lessons. IDs must be unique
(1-500) and all must exist in the declared parent scope. Positions become zero-based
in array order. The sequence may be a subset of siblings. Success returns `{ "ids":
[...] }`. Invalid scope returns `422 INVALID_REORDER_SCOPE`; a missing child parent ID
returns `400 VALIDATION_ERROR`.

### Content errors and audit

| Status/code | Meaning |
| --- | --- |
| `400 VALIDATION_ERROR` | Query/body shape or value failed Zod validation |
| `401 UNAUTHORIZED` | Missing, invalid, or inactive identity |
| `403 FORBIDDEN` | Active identity is not admin, or cookie mutation has unsafe origin |
| `404 NOT_FOUND` | Admin item absent |
| `409 CONFLICT` | Unique name/slug conflict |
| `409 PARENT_NOT_PUBLISHED` | Publication prerequisites are not met |
| `409 EMPTY_LESSON` | Lesson has no blocks at publication |
| `422 PARENT_NOT_FOUND` | Requested topic/system parent is absent |
| `422 INVALID_MEDIA_REFERENCE` | Managed media is absent or archived |
| `500 INVALID_STORED_CONTENT` | Stored lesson JSON no longer matches the block schema |

Creates, updates, reorders, status changes, and archive operations append audit rows
inside the content transaction.

## Flashcard APIs

Admin routes require **Admin**; the two learner routes require **User**. Admin cookie
mutations also require a safe same-origin request.

| Method and path | Input/behavior |
| --- | --- |
| `GET /api/v1/admin/flashcards` | Paginated list with `page`, `pageSize`, `q`, `status`, `difficulty`, `topicId`, `organSystemId`, `sortBy`, `sortOrder` |
| `POST /api/v1/admin/flashcards` | Strict create; returns `201` |
| `PATCH /api/v1/admin/flashcards` | Reorder selected cards within `parentId` topic; IDs 1-500 |
| `GET /api/v1/admin/flashcards/{id}` | Admin DTO |
| `PATCH /api/v1/admin/flashcards/{id}` | Strict non-empty partial update, or exact `{ "status": ... }` |
| `DELETE /api/v1/admin/flashcards/{id}` | Terminal archive; no hard delete |
| `PATCH /api/v1/admin/flashcards/{id}/status` | Exact status body |
| `POST /api/v1/admin/flashcards/{id}/archive` | Terminal archive alias |
| `PATCH /api/v1/admin/flashcards/bulk-status` | Atomic `{ "ids": [1-500 unique UUIDs], "status": ... }` |
| `GET /api/v1/topics/{id}/flashcards` | Eligible published cards plus requesting user's progress |
| `PUT /api/v1/flashcards/{id}/progress` | Idempotent learner progress update |

Create requires `topicId`, `frontText`/`backText` (1-5000 characters), and non-negative
`displayOrder`; optional fields are nullable front/back media UUIDs, `EASY|MEDIUM|HARD`
difficulty, and notes up to 5000 characters. Admin DTOs include notes, lifecycle, and
timestamps. Learner DTOs omit those fields and add progress (`viewedCount`,
`isDifficult`, `isMastered`, `lastViewedAt`) or `null`.

List search covers front, back, and notes. Sort values are `displayOrder`, `frontText`,
`difficulty`, `createdAt`, or `updatedAt`; ID is the stable tie-breaker. Reorder is
topic-scoped and rejects archived cards. Publish requires an eligible parent hierarchy
and unarchived media. Archive is terminal; individual and bulk no-op status changes do
not create another audit event.

Progress body is strict:

```json
{ "eventId": "550e8400-e29b-41d4-a716-446655440000", "isDifficult": true, "isMastered": false }
```

The flags are optional. A new `(user,eventId)` increments the card's view count once.
Replay for the same card returns current progress; reuse for another card returns
`409 IDEMPOTENCY_CONFLICT`. Cookie `PUT` requires safe origin. Draft, archived,
ineligible-parent, or archived-media cards are returned as `404`.

## Admin question APIs

Questions have no public/list-by-topic API. They are exposed to learners only as owned
immutable snapshots created by the assessment engine's internal selection service.

| Method and path | Input/behavior |
| --- | --- |
| `GET /api/v1/admin/questions` | Paginated/filterable question list |
| `POST /api/v1/admin/questions` | Create a draft question and options atomically; `201` |
| `GET /api/v1/admin/questions/{id}` | Full aggregate including correct answer/explanation |
| `PATCH /api/v1/admin/questions/{id}` | Strict non-empty partial update; supplied options replace the aggregate atomically |
| `DELETE /api/v1/admin/questions/{id}` | Terminal archive |
| `PATCH /api/v1/admin/questions/{id}/status` | `{ "status": "DRAFT"|"PUBLISHED" }` |
| `POST /api/v1/admin/questions/{id}/archive` | Terminal archive alias |
| `PATCH /api/v1/admin/questions/{id}/activity` | `{ "isActive": boolean }` |
| `POST /api/v1/admin/questions/{id}/duplicate` | New active draft with new option IDs/keys; `201` |
| `PATCH /api/v1/admin/questions/bulk-status` | Atomic status change for 1-100 unique IDs |

List filters are `q` (prompt, explanation, or concept tag), `assessmentType`, `topicId`,
`organSystemId`, `difficulty`, `status`, `isActive=true|false`, and case-insensitive
exact `conceptTag`. Sort is `questionText`, `createdAt`, or `updatedAt`, then ID.

Create requires `topicId`, `assessmentType` (`QUIZ|TEST`), question text and explanation
(1-5000 each), difficulty, and `options`; media UUID and concept tag (max 100) are
optional/nullable. Each strict option has optional existing `id` on update, required
text (1-1000), optional nullable media UUID, and `isCorrect`. The complete aggregate
must always have 2-6 options and exactly one correct option. Replacement accepts only
option IDs belonging to that question, preserves their IDs/keys, creates new IDs/keys
for new options, and relabels/reorders all options contiguously from `A`/1.

Publishing requires a published topic and active published organ system, valid strict
options, and unarchived question/option media. Archived questions cannot be edited,
reactivated, or restored. Deactivation is independent of publication but removes a
question from internal selection. Duplicate copies content/media/options to a new
active draft and records the source ID only in the create audit snapshot.

Common Phase 4 errors include `400 VALIDATION_ERROR`, `401 UNAUTHORIZED`, `403
FORBIDDEN`/`INVALID_ORIGIN`, `404 NOT_FOUND`, `409 INVALID_STATUS_TRANSITION`,
`409 ARCHIVED`, `409 PARENT_NOT_PUBLISHED`, `409 IDEMPOTENCY_CONFLICT`, `422
PARENT_NOT_FOUND`, `422 INVALID_MEDIA_REFERENCE`, `422 INVALID_OPTIONS`, `422
INVALID_OPTION_REFERENCE`, and safe `500` errors such as `INVALID_STORED_QUESTION`.
Flashcard and question mutation/audit writes share their Prisma transaction and record
actor, request ID, user agent for API requests, before/after snapshots, and action.

## Learner assessment APIs

All routes in this section require **User** access. The owner is always the verified
profile; no request accepts a user ID. Cookie mutations require a safe same-origin
request. Missing and other-user attempts are intentionally indistinguishable as `404`.
All request bodies and query strings are strict: undeclared fields/parameters return
`400 VALIDATION_ERROR`.

| Method and path | Success | Contract |
| --- | --- | --- |
| `POST /api/v1/assessments/start` | `201` safe attempt detail | Start a randomized snapshot attempt |
| `GET /api/v1/attempts` | `200` paginated list | Owned history, newest `createdAt` then ID |
| `GET /api/v1/attempts/{attemptId}` | `200` safe attempt detail | Never reveals result secrets; lazily expires a due test |
| `PUT /api/v1/attempts/{attemptId}/answers/{attemptQuestionId}` | `200` answer receipt | Set/clear one owned in-progress snapshot answer |
| `POST /api/v1/attempts/{attemptId}/submit` | `200` result | Empty body or strict `{}`; idempotent after submission |
| `GET /api/v1/attempts/{attemptId}/result` | `200` result | Available only after completed/auto-submitted state |
| `POST /api/v1/attempts/{attemptId}/retake` | `201` safe attempt detail | Empty body or strict `{}`; fresh selection/snapshot |

### Start contract and snapshot behavior

```json
{
  "assessmentType": "TEST",
  "organSystemId": "550e8400-e29b-41d4-a716-446655440000",
  "topicIds": ["6ba7b810-9dad-41d1-80b4-00c04fd430c8"],
  "questionCount": 10
}
```

- `assessmentType` is `QUIZ` or `TEST`.
- `organSystemId` is a UUID for a published, active system.
- `topicIds` is optional. When present it contains 1-100 unique UUIDs, all published
  topics in the selected system. When omitted, every published topic in the system is
  in scope.
- `questionCount` is an integer from 5 through 50. The service requires at least that
  many currently eligible questions of the chosen type and scope.

The service randomly selects questions and independently shuffles each option set, then
persists ordered immutable snapshots. Snapshot option keys are fresh UUIDs and are the
only keys accepted by answer updates. Current question edits do not change the attempt.
A quiz has `timeLimitSeconds: null` and `expiresAt: null`; a test receives exactly 60
seconds per requested question, measured from database `startedAt`.

`404 SYSTEM_NOT_FOUND` hides an unavailable system. `422 INVALID_TOPIC_SCOPE` means one
or more supplied topics are outside the published system scope; `422 NO_TOPICS` means
the effective scope has no published topics; `422 INSUFFICIENT_QUESTIONS` includes the
eligible count in its safe message. A selection that becomes unavailable while being
locked returns `409 QUESTION_UNAVAILABLE`; exhausted serialization retries return `409
TRANSACTION_FAILED`.

### Attempt DTO privacy

Safe detail data contains attempt identity/type/scope/count/timing/status/retake lineage
and ordered snapshot questions. Each question contains its snapshot prompt, legacy
image URL, managed `mediaId`, shuffled options (`key`, `label`, `displayOrder`, text,
legacy image URL, managed media ID), current answer/timing, and snapshot topic,
difficulty, concept, and system labels. It deliberately omits attempt score/counts/
duration and each question's correct key, correctness, and explanation for **every**
status. Use the result route after submission.

List items omit questions. `IN_PROGRESS` and `ABANDONED` items also omit result counts,
score, and duration; `COMPLETED`/`AUTO_SUBMITTED` items include them. Result DTOs add
`correctCount`, `incorrectCount`, `unansweredCount`, `scorePercentage`,
`durationSeconds`, and per-question `correctOptionKey`, `isCorrect`, and `explanation`.
Only the immutable snapshot is used.

### Answers, timing, submit, and retake

Answer body:

```json
{
  "answeredOptionKey": "550e8400-e29b-41d4-a716-446655440000",
  "timeSpentSeconds": 24
}
```

`answeredOptionKey` is required and may be a snapshot option UUID or `null` to clear.
`timeSpentSeconds` is optional, integer, and 0-86,400. The stored time is the maximum
ever supplied; it does not decrease. Replaying the same answer/time is a no-op. The
receipt contains only attempt-question ID, selected key, `answeredAt`, and stored time;
it does not disclose correctness. Invalid snapshot keys return `422 INVALID_OPTION`.

Expiry is effective when database time reaches `expiresAt`. An answer request at/after
expiry first auto-submits transactionally and then returns `409 ATTEMPT_EXPIRED`.
Manual submit before expiry produces `COMPLETED`; an expired test produces
`AUTO_SUBMITTED`. Scoring distinguishes incorrect and unanswered, includes unanswered
questions in the total denominator, and rounds the percentage to two decimals.
Auto-submitted duration is capped at the time limit.

Submitting an already `COMPLETED` or `AUTO_SUBMITTED` attempt returns the existing
result without a second score/progress update. `ABANDONED` returns `409
ATTEMPT_NOT_SUBMITTED`. Result before submission/after abandonment returns `409
RESULT_NOT_READY`. Retake before submission or from abandoned state returns `409
SOURCE_NOT_SUBMITTED`; a due source test is first auto-submitted. A retake preserves the
source type/system/topic scope/requested count and `retakeSourceId`, but makes a fresh
random selection from currently eligible questions and creates new snapshots.

Start/answer/submit/auto-submit/retake writes persist assessment history; finalization
also refreshes affected `TopicProgress` projection rows. These learner operations do not
append `AuditLog` rows. Database triggers protect snapshot and terminal history.

### Owned list filters

`GET /api/v1/attempts` accepts `page` (default 1), `pageSize` (default 20, maximum 100),
`assessmentType`, `status` (`IN_PROGRESS|COMPLETED|AUTO_SUBMITTED|ABANDONED`), and
`organSystemId`. Before querying it lazily finalizes at most 50 due tests for that user.
Unknown query keys return `400`; there is no caller-controlled sort.

## Learner progress and dashboard APIs

These routes require **User** access and always derive the progress owner from the
verified identity.

| Method and path | Input/response |
| --- | --- |
| `PUT /api/v1/content-lessons/{id}/progress` | Strict `{ "completed": boolean }`; absolute lesson state and timestamps |
| `GET /api/v1/progress` | All current published active systems and published topics |
| `GET /api/v1/progress/{organSystemId}` | One accessible system or `404` |
| `GET /api/v1/dashboard/me` | Submitted attempt totals, weighted accuracy, recent 10, progress, strengths/weaknesses |

Lesson progress is available only for a currently published lesson beneath a published
topic and published active system. Inaccessible IDs return `404`. Repeating `true`
preserves the first `completedAt`; either state updates `lastViewedAt`. Serializable
conflict exhaustion returns `409 TRANSACTION_FAILED`.

Lesson completion refreshes the affected `TopicProgress` projection in the same
transaction and does not append an `AuditLog` row.

Every progress metric is `{ numerator, denominator, percentage }`, rounded to two
decimals. A zero denominator returns `0/0` and `0%`; it does not mean complete. System
percentages are calculated after summing topic numerators and denominators.

- Content denominator: current published lessons; numerator: completed lessons.
- Flashcard denominator: current published cards whose side media is not archived;
  numerator: mastered cards.
- Quiz/test denominator: every immutable question snapshot in submitted attempts of
  that type, including unanswered; numerator: correct snapshots. Attribution requires
  both snapshot system ID and topic ID to match the current published hierarchy.

`TopicProgress` is refreshed as a projection after lesson/flashcard changes and attempt
finalization, but these APIs recompute from authoritative progress rows and immutable
attempt history rather than reading the projection.

Dashboard attempt totals include only `COMPLETED` and `AUTO_SUBMITTED`; recent attempts
are ordered by completion then ID descending and limited to 10. Strengths and weaknesses
use submitted snapshot history, require at least five question samples per topic, and
return up to five highest/lowest accuracy topics. The lists can overlap when few topics
qualify. Accuracy ties prefer larger samples then topic ID.

## Admin attempt and user-progress APIs

All routes require **Admin** and are read-only.

| Method and path | Behavior |
| --- | --- |
| `GET /api/v1/admin/attempts` | Paginated learner attempt search; lazily finalizes up to 50 globally due tests |
| `GET /api/v1/admin/attempts/{id}` | User plus safe snapshot detail; targeted lazy expiry; submitted results only |
| `GET /api/v1/admin/users/{id}/progress` | Narrow profile and the same dashboard/progress report for that user |

Admin attempt filters are strict: `page`, `pageSize`, trimmed `q` (1-200; user name or
email), `userId`, `assessmentType`, `organSystemId`, snapshot `topicId`, `status`,
inclusive offset-bearing ISO date-times `from`/`to` applied to `startedAt`, `sortBy`
(`startedAt|completedAt|scorePercentage|durationSeconds`, default `startedAt`), and
`sortOrder` (default `desc`). `from` must not exceed `to`; ID is the stable tie-breaker.

Admin DTOs include `{ id, fullName, email, isActive }` for the learner. Before
submission they still hide scores, correct option keys, correctness, and explanations.
The user-progress profile is limited to ID, name, email, avatar URL, active state,
creation time, and last login; it does not expose role or auth credentials.

## Phase 6 admin dashboard API

`GET /api/v1/admin/dashboard` requires **Admin**. Its strict query accepts only `days=7`,
`30`, or `90` (default `30`); duplicate or unknown parameters return `400`. Success is a
non-paginated dashboard DTO containing:

- `generatedAt` and UTC `[start,endExclusive)` range;
- learner, non-archived content, published lesson, question-type, new-feedback, and
  submitted-attempt counts;
- all-time question-weighted quiz/test `{ numerator, denominator, percentage }` accuracy;
- one gap-filled UTC trend row per selected day with quiz/test submitted-attempt counts;
- per-system readiness metrics using non-archived topics as denominator and an explicit
  `contentReadinessCriteria` contract;
- five recent learner registrations, five recent feedback rows, and ten safe recent audit
  rows. Recent audit rows contain no snapshots, email, IP hash, or user agent.

The range changes the trend only; counts and accuracy are all-time. `401`, `403`, and
safe unexpected `500` responses use the shared envelope. This read has no side effects
and writes no audit row.

## Phase 6 admin users API

All routes require **Admin** and operate only on `Profile.role=USER`; administrator IDs
are indistinguishable from absent learner IDs as `404`.

| Method and path | Input and success |
| --- | --- |
| `GET /api/v1/admin/users` | Paginated learner DTOs plus `meta.summary`; `200` |
| `GET /api/v1/admin/users/{id}` | Safe learner detail and activity counts; `200` |
| `PATCH /api/v1/admin/users/{id}` | Exact `{ "isActive": boolean }`; updated list DTO; `200` |

List query fields are `page`, `pageSize`, trimmed `q` (name/email, max 200),
`isActive=true|false`, offset-bearing `createdFrom`/`createdTo`, `sortBy=createdAt|fullName|email|lastLoginAt`,
and `sortOrder=asc|desc`. Defaults are page 1, page size 20, `createdAt desc`; ID is the
same-direction tie-breaker and date bounds are inclusive. `createdFrom` must not exceed
`createdTo`. `meta.summary` is unfiltered `{ total, active, inactive, joined30Days }`.

List/detail DTOs expose ID, name, email, avatar URL, active state, last login, and created/
updated timestamps—never role, credentials, device tokens, or notification token
snapshots. Detail additionally returns `{ attempts, submittedAttempts, feedback,
lastAttemptAt }`.

Activity changes lock the learner. A real deactivation preserves all history, disables
active device tokens, cancels their `PENDING` deliveries, and appends a redacted
`DEACTIVATE` audit; activation appends `ACTIVATE` but does not reactivate old tokens.
Replaying the current state is a no-op without another audit. Errors are `400` invalid
query/body/UUID, `401`, `403` (including unsafe cookie origin), `404`, or safe `500`.

## Phase 6 feedback APIs

| Method and path | Access | Input and success |
| --- | --- | --- |
| `POST /api/v1/feedback` | User, rate limited | Strict create; learner DTO; `201` |
| `GET /api/v1/feedback/mine` | User | Paginated owned learner DTOs; `200` |
| `GET /api/v1/admin/feedback` | Admin | Paginated admin DTOs; `200` |
| `GET /api/v1/admin/feedback/{id}` | Admin | Full admin DTO; `200` |
| `PATCH /api/v1/admin/feedback/{id}` | Admin | Review/resolve and/or notes; `200` |

Create accepts `type=GENERAL|BUG_REPORT|QUESTION_REQUEST|IMPROVEMENT`, a trimmed subject
of 1-160 characters, and a trimmed message of 1-5000. Ownership comes from verified
identity. The process-local limit is five attempts per user per 60 seconds; exhaustion
returns `429 RATE_LIMITED` and `Retry-After: 60`. This is not a distributed production
limit.

`feedback/mine` accepts standard pagination plus optional `type` and `status`. It sorts
newest first and exposes only `{ id,type,subject,message,status,createdAt,updatedAt }`.
Internal notes and review/resolve attribution are never in learner DTOs.

The admin list additionally accepts trimmed `q` (subject, message, submitter name/email),
`userId`, inclusive `createdFrom`/`createdTo`, `sortBy=createdAt|status|type`, and
`sortOrder`; ID is a stable tie-breaker. Admin DTOs add `adminNotes`, review/resolve
timestamps, and safe submitter/reviewer/resolver profile summaries.

Admin update is strict and non-empty: nullable trimmed `adminNotes` up to 5000 and/or
`status=REVIEWED|RESOLVED`. Domain transitions establish reviewer before resolver and do
not return to `NEW`. Real changes append `UPDATE`, `REVIEW`, or `RESOLVE` audits. Audit
snapshots contain only status, attribution timestamps, and whether notes changed—not
message text, notes text, or user PII. No-op updates are not audited. Common errors are
`400`, `401`, `403`, `404`, invalid-state `409`, `429` on submit, and safe `500`.

## Phase 6 notification APIs

### Campaign administration

All admin reads require **Admin**; mutations also require safe origin for cookie mode.

| Method and path | Input and success |
| --- | --- |
| `GET /api/v1/admin/notifications` | `page`, `pageSize`, optional campaign `status`; newest first |
| `POST /api/v1/admin/notifications` | Strict draft create; `201` |
| `GET /api/v1/admin/notifications/{id}` | Campaign DTO; `200` |
| `PATCH /api/v1/admin/notifications/{id}` | Non-empty partial draft update; `200` |
| `POST /api/v1/admin/notifications/{id}/schedule` | Exact `{ "scheduledAt": offset-date-time }`; `200` |
| `POST /api/v1/admin/notifications/{id}/cancel` | Body is not parsed; idempotent when already cancelled; `200` |
| `POST /api/v1/admin/notifications/{id}/send` | Body is not parsed; queue processing; `202` |
| `GET /api/v1/admin/notifications/{id}/recipients` | Paginated recipient/read/delivery-count evidence |
| `GET /api/v1/admin/notifications/{id}/deliveries` | Paginated safe delivery evidence |
| `GET /api/v1/admin/notifications/provider-status` | `{ enabled, ready }`; no credential detail |

Create requires `type=DAILY_STUDY|TEST_REMINDER|ANNOUNCEMENT`, trimmed title 1-100,
message 1-1000, and target `{ "type":"ALL_ACTIVE_USERS" }` or
`{ "type":"SELECTED_USERS", "userIds":[1..500 unique UUIDs] }`. Selected IDs must all
be active learners. Patch accepts a non-empty subset but only while `DRAFT`. Campaign
list status is `DRAFT|SCHEDULED|PROCESSING|SENT|PARTIAL|FAILED|CANCELLED`.

Scheduling is draft-only and uses database time; it must be at least 60 seconds ahead
or returns `422 SCHEDULE_TOO_SOON`. Cancellation is allowed only for draft/scheduled
campaigns and cancels any pending deliveries. Send is draft-only and first requires a
ready provider. If Expo is disabled or lacks a token, it returns `503
PROVIDER_UNAVAILABLE` before mutation. A successful `202` means **queued**, not sent.

Campaign DTOs expose ID, type, title, message, target, scheduled/sent timestamps, status,
and created/updated timestamps. Recipient DTOs expose recipient/user IDs, read time,
created time, and delivery count. Delivery DTOs expose ID, status, send/receipt attempt
counts, safe provider error code, and timestamps. No API returns device token text,
token snapshots, provider receipt IDs/messages, leases, processing tokens, or provider
credentials.

Create/update/schedule/cancel/send append campaign audits in the same transaction. Audit
snapshots include campaign type/status, target type/count, and materialized recipient
count; they omit title/message, selected IDs, tokens, receipt/provider data, and secrets.
Common errors are `400`, `401`, `403`, `404`, `409 INVALID_STATUS`, `422
INVALID_AUDIENCE`/`SCHEDULE_TOO_SOON`, `503 PROVIDER_UNAVAILABLE`, and safe `500`.

### Learner notifications

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /api/v1/notifications` | User | Paginated owned recipients for `SENT`/`PARTIAL` campaigns |
| `POST /api/v1/notifications/{recipientId}/read` | Owner | Idempotently set read time; `200` |

The list accepts `page`, `pageSize`, and an optional campaign `status`. Because it reuses
the campaign list parser, `status` is validated but currently ignored for learner,
recipient-evidence, and delivery-evidence lists; unknown keys still return `400`. The
learner list sorts newest first and returns recipient ID,
type, title, message, campaign sent time, read time, and recipient creation time. The read
route uses the recipient ID, derives owner from identity, requires safe cookie origin,
does not parse its request body, and returns the same `404` for absent, another user's,
or non-final campaign recipients.
Read state is operational history and is not added to `AuditLog`.

### Provider evidence semantics

Provider ticket acceptance is `TICKETED`; only a successful receipt is `SENT`. Campaigns
remain `PROCESSING` while pending/ticketed work exists, then finalize `SENT` when every
recipient has a receipt-confirmed delivery, `PARTIAL` when some but not all do, or
`FAILED` when none do. Audience/token materialization happens once, so later audience or
token changes do not rewrite delivery history. Processing uses leases, five send
attempts with bounded backoff, and receipt failure after 20 polls or 23 hours. A crash
after provider acceptance but before persistence leaves an unavoidable at-least-once
duplicate-send window.

## Internal attempt-expiry job

`GET` and `POST /api/internal/attempts/expire` are outside `/api/v1`. They require
`Authorization: Bearer <CRON_SECRET>`; the configured secret must contain at least 32
characters. Missing/wrong credentials return `401`; an unset secret returns `503
CRON_UNAVAILABLE`. Success returns `{ claimed, finalized, batches }`.

Each batch claims at most 50 due in-progress tests ordered by expiry/ID with `FOR UPDATE
SKIP LOCKED`. One invocation runs at most 10 batches and stops after its 8-second budget
or a short batch. `vercel.json` schedules GET every minute (`* * * * *`); POST is kept
for authenticated operational invocation. Learner/admin reads still perform bounded
lazy expiry, so correctness does not depend solely on the cron schedule.

## Internal notification job

`GET` and `POST /api/internal/notifications/process` use the same exact bearer
`CRON_SECRET` contract and shared error behavior as attempt expiry. A ready Expo provider
processes at most five campaigns, 500 delivery operations, and eight seconds, returning
`{ campaigns, deliveries, finalized }`. It claims due campaigns/deliveries with
`FOR UPDATE SKIP LOCKED`, uses opaque expiring leases, materializes each audience once,
sends batches of at most 100, and polls tickets no sooner than 15 seconds.

If Expo is disabled or incompletely configured, an authorized call returns zero counts
with `200` and performs no campaign mutation. Missing cron configuration returns `503`,
wrong credentials `401`, invalid cron configuration a safe `400`, and unexpected worker/
provider failures a safe `500`. `vercel.json` schedules GET every minute; POST is an
equivalent authenticated operational trigger. Worker state changes are not admin audits.

## Admin media APIs

All media operations require **Admin** and return authorized DTOs without bucket/path.
DTOs include metadata and decimal-string `byteSize`. `signedUrl` and
`signedUrlExpiresIn: 900` are returned when preview signing succeeds; both are `null`
when a transient Storage signing failure makes only the preview unavailable. Upload and
metadata mutations remain successful once both the object and database transaction have
committed. Published/owned learner media delivery remains strict and fails if no signed
URL can be created.

The protected attempt-detail page also batch-signs managed question/option snapshot
media for 900 seconds, including archived historical assets. Normal users obtain a
300-second URL through `/api/v1/media/{id}` only when the asset is currently published-
eligible or appears in an attempt they own; unauthorized history returns `404`.

| Method and path | Input/behavior |
| --- | --- |
| `GET /api/v1/admin/media` | Paginated list; filters `search`, `mimeType`, `archived`, `uploadedById`; newest first |
| `POST /api/v1/admin/media` | Multipart `file` and required `altText`; returns `201` |
| `GET /api/v1/admin/media/{id}` | Asset metadata and fresh signed URL, including archived assets |
| `PATCH /api/v1/admin/media/{id}` | JSON `{ "altText": "..." }`, 1-500 trimmed characters |
| `POST /api/v1/admin/media/{id}/archive` | Idempotent archive; already archived returns current asset; eligible published references return `409` |
| `DELETE /api/v1/admin/media/{id}` | Physical deletion is deliberately disabled; an existing ID always returns `409 HARD_DELETE_DISABLED` |

List `mimeType` is one of `image/png`, `image/jpeg`, or `image/webp`; `archived` is
the string `true` or `false`. `search` matches original filename or alt text. Listing
has fixed `createdAt DESC, id DESC` sorting.

Upload enforces non-zero size and the configured MB limit. Sharp 0.35.3 fully decodes
the image with error-on-decode-failure behavior, a 12,000-pixel per-axis limit, and a
40,000,000-pixel input limit. The detected PNG/JPEG/WebP type must be configured as
allowed and must match a non-empty declared `File.type`. SVG, truncated/header-only,
oversized-dimension, and arbitrary files are rejected. Storage paths are server-owned
and do not use the client filename.

| Status/code | Meaning |
| --- | --- |
| `400 VALIDATION_ERROR` | Missing multipart image/alt text or invalid filters/update |
| `400 INVALID_FILE` | Empty/oversized/malformed/disallowed image or MIME mismatch |
| `404 NOT_FOUND` | Media metadata absent |
| `409 REFERENCED` | Archive blocked because eligible published content references the asset |
| `409 HARD_DELETE_DISABLED` | Physical deletion is disabled; use archive |
| `502 STORAGE_ERROR` | Upload or signed URL creation failed |

Upload, alt-text update, and first archive are audited. Archiving an already archived
asset does not append a duplicate event; disabled deletion produces no delete event.

## Admin audit API

`GET /api/v1/admin/audit-logs` requires **Admin** and is read-only.

| Parameter | Validation/effect |
| --- | --- |
| `page`, `pageSize` | Standard pagination |
| `action` | Any `AuditAction` enum value |
| `entityType` | Exact string filter, 1-100 characters |
| `entityId` | Exact string filter, 1-200 characters |
| `actorId` | Actor UUID |
| `from`, `to` | Inclusive ISO date-time bounds; `from` must not exceed `to` |

Results sort by `createdAt DESC, id DESC` and include action, entity identifiers,
before/after snapshots, request ID, timestamp, and actor ID/name/email. They omit IP
hash and user agent. Database triggers reject audit-row updates and deletes.

## Admin UI routes implemented through Phase 6

- `/organ-systems`, `/organ-systems/new`, `/organ-systems/[id]`
- `/organ-systems/[id]/topics`
- `/topics`, `/topics/[id]`
- `/content`, `/content/new`, `/content/[id]`
- `/media`
- `/audit-logs`
- `/flashcards`, `/flashcards/new`, `/flashcards/[id]`
- `/questions/quiz`, `/questions/quiz/new`
- `/questions/test`, `/questions/test/new`
- `/questions/[id]`
- `/attempts`, `/attempts/[id]`
- `/dashboard`
- `/users`, `/users/[id]`
- `/feedback`, `/feedback/[id]`
- `/notifications`, `/notifications/new`, `/notifications/[id]`

These are server-protected pages. Lists provide responsive cards, filters, empty
states, filter-preserving pagination, status badges, pending/success/error feedback,
safe generic handling for unexpected server-action failures, and confirmation
before archive actions. Media provides upload, signed preview, alt-text edit, and
archive controls. The lesson form edits validated JSON rather than a visual block
editor. UI error handling is supplied by the protected segment error boundary and
loading boundaries. Phase 4 adds flashcard grid/list views, filters, bulk lifecycle,
front/back preview, separate text-and-color quiz/test lists, dynamic 2-6 answer option
editing, correct-answer selection, question preview, activity, duplicate, and lifecycle
controls. These forms accept media UUID text rather than a picker. No authenticated
CRUD or full learner assessment E2E flow is present yet. Phase 5 attempt pages are
read-only, responsive, paginated/filterable, preserve immutable snapshot labels/media,
and hide results before submission. Phase 6 adds real dashboard range controls and
accessible text/chart summaries; responsive table/card lists, filters, pagination,
loading/empty/error/success/pending states; confirmation for account, feedback, and
campaign transitions; provider-disabled messaging; notification preview/evidence; and a
dirty-navigation/before-unload guard on notification editors. The user page combines
safe management/device counts with existing submitted-attempt and progress reporting.

## Not yet implemented or externally verified

Phase 7 still needs configured real Expo/device verification, a real PostgreSQL multi-
worker notification concurrency test, authenticated Phase 6 Playwright flows, a
distributed production rate limiter, media-picker UX, and a visual lesson editor. There
is no public question-bank API by design. Both internal cron endpoints require a valid
deployment `CRON_SECRET` and schedule; the local secret is currently invalid and
`env:check` intentionally fails, while ordinary runtime remains isolated.
