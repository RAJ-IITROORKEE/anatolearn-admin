# AnatoLearn Security

## Status and trust boundaries

This document describes controls implemented through Phase 7. Browsers, API clients,
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
  flashcard, question, attempt, dashboard, user-management, feedback-triage, and campaign
  APIs require an active `ADMIN` profile.
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
- Cookie-authenticated mutations require a present, parseable `Origin` whose exact origin
  matches the parsed `NEXT_PUBLIC_APP_URL`. Host headers are not trusted as the policy
  source. Native bearer clients are not required to send Origin and do not need browser
  CORS; the removed CORS environment setting is not part of authorization.
- Responses use consistent safe envelopes and generated request IDs. Unexpected API
  errors return a generic `500` message, and unexpected Phase 3-5 server-action errors
  return a generic form message; exception details and stack traces are not exposed.
- Unique, foreign-key, not-found, state, and media failures map to explicit safe
  statuses. Inaccessible published content returns `404` rather than exposing draft or
  parent lifecycle state.
- Rate limits use an adapter: atomic Upstash Redis REST counters when the credential pair
  is configured and a bounded process-local fallback only in development/test.
  Production requires Upstash and fails closed when it is missing/unavailable. Login,
  registration, and forgot-password use separate SHA-256-derived client/account keys;
  reset/change-password, feedback, and device-token limits use server-derived identifiers.
  A `429` response includes integer-seconds `Retry-After`.

## Browser and transport hardening

- Every matched dynamic request receives a fresh CSP nonce. Script policy uses self,
  nonce, and `strict-dynamic`; only development adds `unsafe-eval`. Object loading and
  framing are denied, base/form targets are self-only, and Supabase origins are narrowly
  admitted for images/connections. Inline styles remain allowed for current Next/Tailwind.
- Responses set `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict-
  origin referrer policy, and a restrictive permissions policy. Production alone sets
  HSTS for one year with subdomains.
- Application metadata is `noindex,nofollow`; `/robots.txt` disallows all crawling.
- JSON APIs include `X-Request-ID`. Authenticated and error responses default to
  `Cache-Control: private, no-store` and `Vary: Authorization, Cookie`; only health and
  meta opt into short public caching without `Vary`.
- Unexpected errors are logged as redacted structured JSON containing only level,
  request ID, safe code/status, and optional route. Bodies, passwords, tokens, stack
  traces, provider payloads, and arbitrary exception text are excluded.

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

The same boundary protects `GET`/`POST /api/internal/notifications/process`. Provider
configuration is parsed only after cron authorization. With a valid cron secret but no
ready provider, the route returns zero work without mutating campaign state. The worker
is bounded to five campaigns, 500 delivery operations, and eight seconds. Both internal
routes are scheduled every minute.

## Phase 6 user and feedback controls

- Admin user queries and mutations always require `role=USER`; administrator IDs are
  hidden as `404`. DTOs omit role, credentials, provider tokens, and token snapshots.
- Deactivation uses a profile row lock, preserves the profile and all learning/feedback/
  notification history, disables active device tokens, and cancels only pending
  deliveries. Activation does not silently reactivate old devices.
- Learner feedback ownership comes from the verified profile. `feedback/mine` is scoped
  by that ID and never returns admin notes, reviewer/resolver identities, or timestamps.
- Admin feedback transitions run under a row lock. Review and resolution attribution is
  server-derived from the active admin. Internal notes are never in learner DTOs.
- Feedback audits are deliberately redacted: status and attribution timestamps plus an
  `adminNotesChanged` flag are retained, while learner message text, notes text, and PII
  are excluded.

## Notification trust and privacy controls

- `EXPO_PUSH_ENABLED`/`EXPO_ACCESS_TOKEN` have a dedicated provider schema and are not
  shared-runtime dependencies. Provider status exposes only booleans. Access tokens are
  server-only and never returned or audited.
- Send-now checks readiness before opening the campaign mutation transaction. Disabled
  or incomplete provider configuration returns `503` without changing a draft. Scheduling
  is still allowed because the provider can be configured before execution.
- Selected audiences accept 1-500 unique UUIDs and are checked as active learners.
  Audience and active device-token snapshots are materialized exactly once while the
  campaign lease is owned. Later token/profile changes do not rewrite history.
- Recipient identity and delivery identity/token/platform snapshots are protected by
  database no-delete/immutability triggers. Terminal sent/cancelled deliveries cannot be
  changed. API DTOs omit token text/snapshots, provider receipt IDs/messages, lease tokens,
  and provider credentials.
- Campaign/delivery claims use row locks, `SKIP LOCKED`, opaque processing tokens, and
  expiring leases. Updates are conditional on lease ownership so stale workers cannot
  finalize another worker's claim.
- A provider push ticket is evidence of acceptance only and records `TICKETED`. `SENT`
  requires a successful receipt. Campaign `SENT`, `PARTIAL`, and `FAILED` states are
  calculated from receipt-confirmed delivery evidence, avoiding false success.
- Transient sends retry at most five times with bounded backoff. Receipt polling waits at
  least 15 seconds and fails after 20 polls or 23 hours. `DeviceNotRegistered` disables
  the affected token.
- The network boundary cannot provide exactly-once delivery. A crash after provider
  acceptance and before ticket persistence can cause a retry and duplicate notification;
  processing is therefore explicitly at-least-once in that window.
- Learner list/read operations are owner-scoped and expose only final `SENT`/`PARTIAL`
  campaigns. An absent, foreign, or non-final recipient returns the same `404`.
- HTTP 4xx (other than 429), malformed JSON, invalid provider shapes, and batch cardinality
  mismatch are permanent provider failures. Claimed deliveries fail immediately without
  retry; transient network/429/5xx failures retain bounded retries.

## Registration consistency and enumeration resistance

- Registration applies both client and account limits. Supabase's empty-identities
  existing-email response is treated as an obfuscated successful request rather than
  exposing account existence.
- Profile provisioning follows Auth signup. If provisioning fails for a newly created
  identity, the server attempts Auth-user deletion as compensation and returns a safe
  retry response. Compensation failure emits only a redacted structured event; it does
  not expose identity or provider details.

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
- Phase 6 learner activation/deactivation, feedback admin changes, and campaign admin
  transitions are audited transactionally. User audits contain active state only.
  Feedback and campaign services use feature-specific allowlisted audit snapshots; no
  learner messages/notes, campaign title/message, selected learner IDs, device tokens,
  provider receipt data, or credentials enter the audit row.
- Worker delivery/read state is operational history rather than admin audit activity.
  The database guards recipient and delivery history directly.

## Direct database access controls

- The application uses Prisma's privileged server connection; browser/mobile clients do
  not query application tables through Supabase Data APIs.
- Phase 7 migrations enable RLS on all 21 application tables, revoke table/sequence access
  for `anon` and `authenticated`, revoke direct execution/default privileges for invariant
  functions, grant schema `USAGE`, and revoke schema `CREATE` for those roles.
- The migrations are schema-scoped and refuse to alter `auth` or `storage`. Isolated tests
  switch to both client roles and prove reads/writes are denied while Prisma remains
  operational. They are deployed to configured development only, not claimed in production.

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
  for scheduled expiry and notification processing)
- `EXPO_PUSH_ENABLED`, `EXPO_ACCESS_TOKEN` (server-only provider configuration; optional
  to boot and isolated from shared runtime)
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (paired and required when
  `NODE_ENV=production`; optional together in development/test)

Environment validation does not print secret values. `envCheckSchema` intentionally
combines shared, bootstrap, and cron schemas, so `npm run env:check` rejects a configured
short `CRON_SECRET` even though shared runtime and build startup accept that cron-only
value. This is a deployment configuration gate, not a shared-runtime dependency. The
bootstrap script is explicit and idempotent and does not form part of runtime
authorization. Whether a given environment needs bootstrap is an operational deployment
concern, not a Phase 3 code completion gate.

## Verification gaps and current risks

1. The dedicated assessment PostgreSQL suite passed against a migrated isolated schema,
   including real multi-client finalization and deployed immutability guards. Broader
   database/provider integration remains incomplete.
2. Supabase provider/auth and signed-URL integration is mocked. Authenticated content/
   media/audit/flashcard/question CRUD and full learner assessment E2E are absent.
3. Scheduled expiry is not deployment-ready until a valid `CRON_SECRET` and both Vercel cron
   are configured. The current `npm run env:check` intentionally fails only on the
   invalid configured secret; ordinary runtime and production build are isolated from it.
4. Expo request/receipt handling is unit-tested but has not been verified with real
   credentials/devices. Notification leases lack a real PostgreSQL multi-worker test,
   and the documented provider-acceptance crash window is at-least-once.
5. Playwright passed 17 public/security/accessibility cases and skipped 14. Authenticated
   admin flows did not run because their two E2E credentials were absent.
6. Production Upstash credentials and behavior are not provisioned/verified. The RLS/
   revoke migrations are proven in development and an isolated database, not production.
7. Backup/restore, production deployment, real Supabase Auth email/redirect/private
   Storage, and optional monitoring remain unverified.
8. A later SRS may alter data sensitivity or retention requirements and must be
   reviewed before the affected feature phase.
