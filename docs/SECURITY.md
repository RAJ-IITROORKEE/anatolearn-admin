# AnatoLearn Security

## Status and trust boundaries

This document describes controls implemented through Phase 5. Browsers, API clients,
headers, cookies, query/body data, uploads, and persisted author-authored content are
untrusted. The Next.js server is the authorization boundary.

- Supabase Auth verifies identity; PostgreSQL `Profile.role` and `isActive` determine
  application authorization.
- Prisma is the only application-table data path.
- Supabase secret keys, database URLs, bootstrap credentials, and Storage paths are
  server-only.
- CORS is not treated as authentication, authorization, or CSRF protection.

## Authentication and authorization

- Admin pages use Supabase SSR cookie sessions and are protected by the `(admin)`
  server layout. Missing identities and non-admin/inactive profiles are redirected to
  login with different safe reason codes.
- APIs accept a verified Supabase bearer token when supplied or use the SSR cookie
  session. The profile is loaded server-side; clients cannot provide role or acting ID.
- Any active profile may read published learning content, operate only its own attempt/
  lesson/flashcard progress, and read its own dashboard. Admin content, media, audit,
  flashcard, question, attempt, and user-progress APIs require an active `ADMIN` profile.
- Missing/invalid/inactive identity maps to `401`; an active non-admin maps to `403`.
- Password storage, hashing, reset, and token issuance remain in Supabase Auth.
  Recovery APIs require provider-verified recovery AMR, and forgot-password responses
  do not reveal account existence.
- Auth callback/reset redirects come from environment configuration rather than an
  arbitrary request URL.

## Request and response protections

- Zod schemas allowlist and validate external data. Content, flashcard, question,
  option, lifecycle, activity, bulk, assessment, answer, list, and progress schemas are
  strict. Empty submit/retake mutations accept only no body or `{}`.
- Cookie-authenticated mutations validate Origin/Host for same-origin intent. Native
  bearer clients are not required to send Origin.
- Responses use consistent safe envelopes and generated request IDs. Unexpected API
  errors return a generic `500` message, and unexpected Phase 3-5 server-action errors
  return a generic form message; exception details and stack traces are not exposed.
- Unique, foreign-key, not-found, state, and media failures map to explicit safe
  statuses. Inaccessible published content returns `404` rather than exposing draft or
  parent lifecycle state.
- Existing auth/password rate-limit hooks are in-memory/process-local. Content/media/
  Phase 4/5 routes do not add a separate rate limiter. Distributed production needs a
  shared store before rate limits can be considered reliable.

## Flashcard and question controls

- Learner flashcard reads require an active profile and filter status, parent
  publication/activity, and archived media server-side. Hidden records return `404`.
- Progress derives `userId` from verified identity. Client `eventId` is unique per user;
  serializable transactions, uniqueness, conflict retries, and replay checks prevent
  ordinary duplicate increments. Reusing an event for another card returns `409`.
- Questions are never exposed as a public question bank. Full prompts, correct flags,
  and explanations are admin-only until the Phase 5 assessment engine consumes the
  internal eligibility service.
- Question option sets are a transactionally replaced aggregate: 2-6 options, exactly
  one correct, owned existing IDs only, stable answer keys for retained options, and
  deterministic labels/order. Stored aggregates are revalidated before DTO output.
- Publishing flashcards/questions checks parent hierarchy and acquires shared locks on
  all referenced media. Question selection additionally requires active status and
  rejects archived question/option media.
- Archived learning items are terminal. Question activity is server-controlled;
  deactivation excludes a published question from selection without changing status.

## Assessment and progress controls

- Attempt owner IDs come only from the verified profile. Every learner attempt lock is
  scoped by attempt ID and owner ID, so another user's attempt is returned as the same
  `404` as an absent attempt. Cookie mutations additionally require safe origin.
- Start validates a published active system and published in-system topics, share-locks
  scope/source rows, rechecks eligibility after locking, and creates the attempt and all
  snapshots in one serializable transaction. Serialization conflicts retry up to three
  times and then fail safely with `409`.
- Question and option order, fresh option keys, prompt, explanation, correct key,
  topic/system labels and IDs, difficulty, concept, and legacy/managed media references
  are snapshotted. Database triggers prevent snapshot mutation. Source edits do not
  rewrite history.
- The normal attempt-detail DTO always hides score, correct option key, correctness, and
  explanation. Lists expose scores only for submitted states. The dedicated learner
  result and admin detail expose result secrets only after `COMPLETED` or
  `AUTO_SUBMITTED`.
- Answer keys must belong to the owned snapshot question. Answer responses omit
  correctness. Answers can change only while the parent attempt is in progress; a
  database trigger also enforces this. Time spent can only stay equal or increase in the
  application service.
- Tests use database time and exactly 60 seconds per question. Due tests are finalized
  under row locks; batch workers use `SKIP LOCKED`. Submission is idempotent for terminal
  submitted states, terminal results are database-immutable, and attempt history cannot
  be deleted through direct database writes covered by the migration triggers.
- Lesson progress and aggregate reports derive the user from verified identity. Reports
  use current published content plus owned immutable submitted snapshots. The
  `TopicProgress` table is only a projection, not the authorization or reporting source.
- Admin attempt/user progress endpoints are read-only. The narrow user DTO excludes role
  and authentication data; pre-submission admin attempt details retain the same answer-
  secrecy boundary as learner details.

## Scheduled expiry authentication

`GET` and `POST /api/internal/attempts/expire` do not use a user session. They require an
exact bearer `CRON_SECRET`; comparison hashes both values and uses `timingSafeEqual`.
The secret is server-only and must be at least 32 characters when configured. It is not
part of shared `serverEnvSchema`; only `cronEnvSchema`/`getCronEnv` validates it at the
internal cron boundary. An absent or blank secret disables the route with `503`. A
configured short secret raises a Zod error inside the route and is returned by the
central mapper as a safe `400 VALIDATION_ERROR`; an incorrect request bearer receives
`401`. Consequently, missing or invalid cron-only configuration cannot crash ordinary
pages or the production build.

`vercel.json` schedules the GET route every minute. A call is bounded to batches of 50,
at most 10 batches, and an 8-second loop budget. Lazy expiry on owned/admin reads limits
the impact of a delayed job, but production scheduling still requires the deployment
secret and Vercel cron configuration.

## Structured content controls

- Lessons store only a discriminated JSON block union; unrestricted HTML is rejected.
- Every block has bounded text/list sizes and rejects undeclared properties.
- Image blocks require a managed media UUID and non-empty alt text.
- Create/update verifies referenced media exists and is not archived.
- Stored lesson JSON is revalidated before it enters an API/UI DTO. Invalid stored
  content fails closed with a safe server error.
- Publishing a lesson requires at least one block and published parent hierarchy.

## Upload and private Storage controls

- Upload and admin media reads are admin-only. A separate read permits any active
  authenticated profile to access only eligible published media.
- The application supports PNG, JPEG, and WebP; SVG is not accepted.
- File size is checked against `SUPABASE_STORAGE_MAX_FILE_MB` (8 MB in the example).
- Sharp 0.35.3 fully decodes each upload with decode errors treated as failures. Input
  is limited to 12,000 pixels per axis and 40,000,000 pixels total. A non-empty
  declared MIME must equal the detected MIME, which must also be in the configured
  allowlist.
- Storage paths are generated as `media/{actorId}/{assetId}.{ext}` and do not use the
  client filename. Original filenames are retained only as bounded metadata.
- The bucket is treated as private. Admin DTOs remove bucket/path and return a signed
  URL valid for 900 seconds; `byteSize` is a decimal string rather than a JSON number.
- `GET /api/v1/media/{id}` returns a 300-second URL for an unarchived asset used by
  eligible published content, or for media preserved in an attempt snapshot owned by
  the requester. The historical path can sign an archived asset but checks attempt
  ownership; another user's, unreferenced, and absent assets fail as `404`.
- Protected admin attempt pages batch-sign snapshot media, including archived history,
  for 900 seconds. Both paths omit Storage bucket and object path.
- Required alt text is enforced by request validation and a database check.
- Physical deletion is disabled and returns `409 HARD_DELETE_DISABLED` for every
  existing asset. Archive is supported, but returns `409 REFERENCED` while eligible
  published content references the asset.

Current limitations:

- Full image decoding is not malware scanning.
- Non-published references may still point to an archived asset; such assets are not
  available from the published-media route and cannot be newly referenced by updates.
- Published content DTOs require a second authenticated request to resolve a media ID;
  signed URLs are intentionally short-lived rather than embedded in content DTOs.

## Lifecycle and deletion controls

- Systems, topics, and lessons use `DRAFT`, `PUBLISHED`, and terminal `ARCHIVED`
  states. API `DELETE` archives these resources rather than removing rows.
- Topic/lesson publication checks parent publication; system active status also gates
  child visibility.
- Parent archive/deactivation does not mutate descendants but removes them from
  published reads through query constraints.
- Managed media supports archive but not physical deletion. Published-reference checks
  run transactionally before first archive.

## Audit controls

- Content and flashcard create/update/reorder/publish/archive; question create/update,
  publish/draft/archive, activity, duplicate, and bulk lifecycle; and media create/
  update/first archive append `AuditLog` rows.
- Content writes and their audit rows share one Prisma transaction. Media metadata
  changes and audit rows also share transactions; Storage itself cannot join them.
- Audit rows contain actor, action, entity, snapshots, request ID, and timestamp.
  Content/flashcard/question API mutations capture user agent when present. Current services do not
  populate `ipHash`; media mutations do not capture user agent.
- Audit APIs/UI are active-admin-only. Their DTO includes actor email and snapshots,
  so it must not be exposed to normal users.
- A PostgreSQL trigger rejects updates and deletes against `AuditLog`.
- Phase 5 learner attempt/answer/finalization/retake and lesson-progress writes do not
  create `AuditLog` rows. Attempt history instead relies on ownership, immutable
  snapshots/terminal results, and no-delete database triggers; admin reporting is
  read-only.
- Current Phase 3 snapshots contain content/resource metadata but no generic recursive
  redaction utility. Future features that handle secrets, tokens, feedback, or other
  PII must add field-level redaction before using this audit service pattern.

## Secrets and environment

Local environment files are ignored; `.env.example` contains placeholders only.
Relevant required names include:

- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_AUTH_REDIRECT_URL`, `SUPABASE_PASSWORD_RESET_REDIRECT_URL`
- `SUPABASE_STORAGE_BUCKET`, `SUPABASE_STORAGE_MAX_FILE_MB`
- `SUPABASE_STORAGE_ALLOWED_MIME_TYPES`, `SUPABASE_STORAGE_VISIBILITY`
- `ADMIN_BOOTSTRAP_EMAIL` and optional one-time `ADMIN_BOOTSTRAP_PASSWORD`
- `CRON_SECRET` (server-only; optional to boot, but at least 32 characters and required
  for scheduled expiry processing)

Environment validation does not print secret values. `envCheckSchema` intentionally
combines shared, bootstrap, and cron schemas, so `npm run env:check` rejects a configured
short `CRON_SECRET` even though shared runtime and build startup accept that cron-only
value. This is a deployment configuration gate, not a shared-runtime dependency. The
bootstrap script is explicit and idempotent and does not form part of runtime
authorization. Whether a given environment needs bootstrap is an operational deployment
concern, not a Phase 3 code completion gate.

## Verification gaps and current risks

1. The dedicated `TEST_DATABASE_URL` suite did not run; four PostgreSQL integration
   tests were skipped, including the explicit concurrent-submission placeholder. Real
   database concurrency/guard behavior therefore remains unverified in this run.
2. Supabase provider/auth and signed-URL integration is mocked. Authenticated content/
   media/audit/flashcard/question CRUD and full learner assessment E2E are absent.
3. Scheduled expiry is not deployment-ready until a valid `CRON_SECRET` and Vercel cron
   are configured. The current `npm run env:check` intentionally fails only on the
   invalid configured secret; ordinary runtime and production build are isolated from it.
4. Existing managed-media picker, visual lesson editor, and distributed rate-limiter
   gaps remain.
5. A later SRS may alter data sensitivity or retention requirements and must be
   reviewed before the affected feature phase.
