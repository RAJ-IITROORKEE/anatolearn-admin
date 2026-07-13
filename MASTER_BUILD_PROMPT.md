# MASTER BUILD PROMPT — AnatoLearn Backend + Web Admin MVP

You are the lead full-stack engineer and autonomous implementation agent for **AnatoLearn**, an anatomy-learning product. Work inside the existing Next.js repository in the current directory. Do not delete or reinitialize a working project. Inspect the repository first, preserve the existing package manager and conventions where reasonable, then implement the system in controlled phases.

Your job is to deliver a production-minded MVP consisting of:

1. A responsive, modern web-based admin panel.
2. A versioned REST API for the future React Native Expo iOS application.
3. A PostgreSQL database hosted on Supabase.
4. Supabase email/password authentication and JWT-based authorization.
5. Supabase Storage for anatomy and question media.
6. Prisma ORM for all application database access from the Next.js server.
7. Tests, seed data, API documentation, setup instructions and deployment readiness.

Read and follow these files before changing code:

- `AGENTS.md`
- `DESIGN.md`
- `.env.example`
- The supplied product SRS documents
- Any existing `README.md`, schema or implementation notes

Create missing documentation before implementation:

- `docs/ARCHITECTURE.md`
- `docs/API_SPEC.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PHASE_STATUS.md`

Keep `docs/PHASE_STATUS.md` updated after every phase.

---

## 1. Product context

AnatoLearn helps undergraduate and college students learn Anatomy and Physiology. The mobile application will later provide:

- Email registration, login, forgot password and logout
- Eleven organ systems
- Content review with text and images
- Text/image flashcards with tap-to-flip, difficult marking and progress
- Untimed quizzes of up to 50 randomized concept-wise questions
- Timed tests of up to 50 questions at one minute per question
- Skipping and changing answers
- Auto-submission when a test expires
- Results, answer explanations and retakes
- Dashboard statistics, strengths and weaknesses
- Profile, password change, reminders and feedback

The admin panel must provide:

- Admin login, forgot password, password reset, change password and logout
- Dashboard counts and recent activity
- User management and user progress
- Organ system management
- Topic management
- Content review management
- Flashcard management
- Quiz question management
- Test question management
- Notification/reminder management
- Feedback management
- Media upload and selection
- Auditability for important admin changes

The following eleven organ systems must be included in seed data:

1. Circulatory
2. Respiratory
3. Urinary
4. Endocrine
5. Lymphatic
6. Digestive
7. Reproductive
8. Muscular
9. Integumentary
10. Nervous
11. Skeletal

---

## 2. Hard technical decisions

Use these unless the existing project has an equivalent, clearly better implementation. Record any deviation in `docs/ARCHITECTURE.md`.

### Core stack

- Latest stable Next.js with the App Router
- TypeScript with strict mode
- React Server Components by default
- Client Components only for interactive UI
- Tailwind CSS
- shadcn/ui
- Lucide icons
- PostgreSQL on Supabase
- Prisma ORM and Prisma Migrate
- Supabase Auth
- `@supabase/ssr` for Next.js server-side authentication
- `@supabase/supabase-js`
- Supabase Storage
- Zod for validation
- React Hook Form for complex forms
- TanStack Query for client-side server-state where it adds value
- TanStack Table for large interactive tables
- Recharts for admin dashboard charts
- Sonner for toasts
- date-fns for date formatting
- Vitest and React Testing Library for unit/component tests
- Playwright for critical end-to-end tests

Do not introduce a separate Express, NestJS, GraphQL or microservice backend for this MVP.

### Data-access rule

All application data access must happen on the Next.js server through Prisma. Browser and mobile clients must not query application tables directly through Supabase Data APIs.

Supabase client usage is limited to:

- Authentication
- Session handling
- Storage uploads/downloads where authorized
- Server-side administrative auth operations using the service-role key

The service-role key must never be exposed to browser code or returned through an API.

### API rule

Implement REST endpoints using App Router Route Handlers under:

`app/api/v1/...`

All endpoints must:

- Validate input with Zod
- Return a consistent JSON envelope
- Check authentication
- Check role/ownership authorization
- Avoid leaking stack traces or secrets
- Use appropriate HTTP status codes
- Include pagination for list endpoints
- Support filtering/sorting where useful
- Be documented in `docs/API_SPEC.md`
- Be represented in `docs/openapi.yaml`

Use this response shape:

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
    requestId?: string;
  };
};

type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    requestId?: string;
  };
};
```

Create shared response helpers rather than duplicating response construction.

---

## 3. Authentication and authorization

Use Supabase email/password authentication.

### Roles

- `ADMIN`
- `USER`

Create a `Profile` record keyed by the Supabase Auth user UUID.

Admin access requires both:

1. A valid Supabase session/JWT
2. `Profile.role === ADMIN` and `Profile.isActive === true`

### Admin web authentication

Implement:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/change-password`

Use secure cookie-based SSR sessions for the admin panel. Protect all admin routes at the server boundary. Do not rely only on client-side redirects.

### Mobile/API authentication

The future Expo application will send:

`Authorization: Bearer <supabase-access-token>`

Create a reusable server helper that verifies the bearer token and resolves the application profile.

### Bootstrap admin

Create a safe script:

`scripts/bootstrap-admin.ts`

It must:

- Read `ADMIN_BOOTSTRAP_EMAIL`
- Optionally read `ADMIN_BOOTSTRAP_PASSWORD`
- Create or locate the Supabase Auth user
- Upsert the profile as `ADMIN`
- Refuse to print secrets
- Be idempotent
- Clearly warn that the bootstrap password should be rotated
- Work only when explicitly invoked

Add the command to `package.json`, for example:

```json
"admin:bootstrap": "tsx scripts/bootstrap-admin.ts"
```

### Security requirements

- Never trust role information from the client
- Never accept a user ID from the client when the authenticated identity should be used
- Use server-side authorization helpers
- Prevent inactive or deleted users from using protected endpoints
- Do not store raw passwords
- Do not invent a custom JWT implementation
- Do not expose Supabase service-role credentials
- Validate upload MIME type, extension and size
- Sanitize or structurally constrain user-authored content
- Add CSRF-safe patterns for cookie-authenticated mutations
- Add request IDs and structured server logs
- Add basic rate-limiting hooks for auth and feedback endpoints
- Add an `AuditLog` record for destructive or security-relevant admin actions

---

## 4. Database design

Create a complete Prisma schema with UUID primary keys, useful indexes, foreign keys and timestamps.

Prefer soft deletion or archival for content that may be referenced by historical attempts. Do not hard-delete referenced questions or content without explicit safeguards.

### Required enums

Create suitable Prisma enums including at least:

- `UserRole`: `ADMIN`, `USER`
- `PublishStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `AssessmentType`: `QUIZ`, `TEST`
- `Difficulty`: `EASY`, `MEDIUM`, `HARD`
- `AttemptStatus`: `IN_PROGRESS`, `COMPLETED`, `AUTO_SUBMITTED`, `ABANDONED`
- `FeedbackType`: `GENERAL`, `BUG_REPORT`, `QUESTION_REQUEST`, `IMPROVEMENT`
- `FeedbackStatus`: `NEW`, `REVIEWED`, `RESOLVED`
- `NotificationType`: `DAILY_STUDY`, `TEST_REMINDER`, `ANNOUNCEMENT`
- `NotificationStatus`: `DRAFT`, `SCHEDULED`, `SENT`, `CANCELLED`
- `AuditAction`: values appropriate for create/update/archive/delete/login/security actions

### Required models

Design and implement at least these models:

#### Profile

- Supabase Auth UUID as primary key
- full name
- email snapshot
- role
- avatar URL
- active flag
- last login
- created/updated timestamps

#### OrganSystem

- name
- slug
- short description
- long description
- cover image
- icon/image metadata
- display order
- status
- active flag
- timestamps

#### Topic

- organ system relation
- title
- slug
- summary
- cover image
- display order
- status
- timestamps

Unique slug within an organ system.

#### ContentLesson

- topic relation
- title
- slug
- summary
- structured content blocks stored as JSON
- estimated reading time
- display order
- status
- timestamps

Use a validated structured block format such as:

- heading
- paragraph
- image
- callout
- bullet list
- numbered list
- divider

Do not store unrestricted HTML as the primary content representation.

#### Flashcard

- topic relation
- front text
- back text
- optional front/back image
- difficulty
- explanation or notes
- display order
- status
- timestamps

#### Question

Use one table for both quiz and test questions.

- topic relation
- assessment type
- question text
- optional image
- explanation
- difficulty
- concept tag
- status
- active flag
- timestamps

#### QuestionOption

- question relation
- option label/order
- option text
- optional image
- correct flag

Enforce at application level that a single-choice question has exactly one correct option and at least two options.

#### AssessmentAttempt

- user
- assessment type
- organ system
- optional topic scope
- requested question count
- total question count
- correct count
- incorrect count
- unanswered count
- score percentage
- duration seconds
- started/completed timestamps
- status
- retake source attempt, if any

#### AttemptQuestion

Create immutable snapshots so historical results remain accurate even if an admin edits a question later.

Store:

- attempt
- source question ID
- order
- question text snapshot
- image snapshot
- explanation snapshot
- options snapshot JSON
- correct option snapshot
- answered option
- correctness
- answered timestamp
- time spent

#### FlashcardProgress

- user
- flashcard
- viewed count
- difficult flag
- last viewed
- mastered flag

Unique by user and flashcard.

#### TopicProgress

- user
- topic
- content completion
- flashcard completion
- quiz accuracy
- test accuracy
- updated timestamp

#### Feedback

- user
- feedback type
- subject
- message
- optional attachment
- status
- reviewed by
- reviewed timestamp
- admin notes
- timestamps

#### NotificationCampaign

- type
- title
- message
- target audience or filter JSON
- scheduled timestamp
- sent timestamp
- status
- created by
- timestamps

#### DeviceToken

Prepare for later Expo push notifications:

- user
- Expo push token
- platform
- active
- last seen
- timestamps

#### MediaAsset

- storage bucket
- storage path
- public or signed URL strategy
- filename
- MIME type
- byte size
- width/height where available
- alt text
- uploaded by
- timestamps

#### AuditLog

- actor
- action
- entity type
- entity ID
- before snapshot JSON
- after snapshot JSON
- IP/user-agent where available
- timestamp

### Indexes

Add indexes for:

- Foreign keys
- Slugs
- Status and active filters
- Question assessment type/topic/difficulty
- Attempt user/type/completed date
- Feedback status/created date
- Notification status/scheduled date
- Audit actor/entity/time

### Seeds

Create `prisma/seed.ts` with:

- Eleven organ systems
- Two or more demo topics for Circulatory System
- Sample structured lesson content
- Sample flashcards
- At least 10 quiz questions
- At least 10 test questions
- Safe idempotent upserts

Do not use unverified medical claims beyond simple demonstration text. Label demo content as sample content in code comments and documentation.

---

## 5. REST API scope

Implement and document the following endpoint groups. Use route naming consistently. Add pagination, filtering and sorting to list endpoints.

### Public/health

- `GET /api/health`
- `GET /api/v1/meta`

Health output must not reveal secrets.

### Authentication

Implement thin wrappers around Supabase Auth where suitable:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/session`

For the web admin, use SSR cookie flows. For mobile, support bearer-token responses/usage without exposing privileged keys.

### Profile

- `GET /api/v1/me`
- `PATCH /api/v1/me`
- `POST /api/v1/me/change-password`
- `POST /api/v1/me/device-tokens`
- `DELETE /api/v1/me/device-tokens/:id`

### Learning content for the future mobile app

- `GET /api/v1/organ-systems`
- `GET /api/v1/organ-systems/:slug`
- `GET /api/v1/organ-systems/:slug/topics`
- `GET /api/v1/topics/:id`
- `GET /api/v1/topics/:id/content`
- `GET /api/v1/topics/:id/flashcards`
- `PUT /api/v1/flashcards/:id/progress`
- `GET /api/v1/progress`
- `GET /api/v1/progress/:organSystemId`

Only published/active learning content should be visible to normal users.

### Assessment flow

Create a shared domain service for quizzes and tests, then expose clear endpoints:

- `POST /api/v1/assessments/start`
- `PUT /api/v1/attempts/:attemptId/answers/:attemptQuestionId`
- `POST /api/v1/attempts/:attemptId/submit`
- `GET /api/v1/attempts/:attemptId`
- `GET /api/v1/attempts/:attemptId/result`
- `POST /api/v1/attempts/:attemptId/retake`
- `GET /api/v1/attempts`
- `GET /api/v1/dashboard/me`

Start payload:

```json
{
  "assessmentType": "QUIZ",
  "organSystemId": "uuid",
  "topicIds": ["uuid"],
  "questionCount": 30
}
```

Rules:

- Minimum 5 and maximum 50 questions
- Never request more questions than available
- Randomize question selection
- Randomize options while preserving correct-answer mapping
- Snapshot every selected question
- Quiz is untimed
- Test time limit is `questionCount * 60` seconds
- Test submission after expiry must become `AUTO_SUBMITTED`
- The server, not only the client, must enforce test expiry
- Score and explanations are returned only after submission
- Idempotent submission
- Prevent answering after completion
- Calculate correct, incorrect and unanswered counts
- Retake creates a new attempt

### Feedback

- `POST /api/v1/feedback`
- `GET /api/v1/feedback/mine`

### Notifications

- `GET /api/v1/notifications`
- `POST /api/v1/notifications/:id/read`

### Admin endpoints

Place admin APIs under `/api/v1/admin`.

Required groups:

- `/dashboard`
- `/users`
- `/users/:id`
- `/users/:id/progress`
- `/organ-systems`
- `/organ-systems/:id`
- `/topics`
- `/topics/:id`
- `/content-lessons`
- `/content-lessons/:id`
- `/flashcards`
- `/flashcards/:id`
- `/questions`
- `/questions/:id`
- `/attempts`
- `/attempts/:id`
- `/feedback`
- `/feedback/:id`
- `/notifications`
- `/notifications/:id`
- `/media`
- `/media/:id`
- `/audit-logs`

Question endpoints must support `assessmentType=QUIZ|TEST`.

Admin list endpoints should support:

- `page`
- `pageSize`
- `q`
- relevant filters
- `sortBy`
- `sortOrder`

Use sensible upper limits for `pageSize`.

### Upload API

Implement a secure media upload workflow:

- Accepted image types: PNG, JPEG, WebP, SVG only if sanitized or disallowed by default
- Configurable maximum size
- Stable unique storage paths
- Store metadata in `MediaAsset`
- Return usable URL and alt-text requirement
- Prevent arbitrary file uploads
- Delete storage object only after verifying it is not referenced, or archive it

---

## 6. Admin panel routes and features

Create a responsive application shell with:

- Collapsible desktop sidebar
- Mobile drawer navigation
- Top bar
- Breadcrumbs
- Profile menu
- Global page title area
- Responsive content container
- Loading skeletons
- Empty states
- Error states
- Confirmation dialogs for destructive actions

### Route map

- `/login`
- `/forgot-password`
- `/reset-password`
- `/dashboard`
- `/users`
- `/users/[id]`
- `/organ-systems`
- `/organ-systems/new`
- `/organ-systems/[id]`
- `/organ-systems/[id]/topics`
- `/topics/[id]`
- `/content`
- `/content/new`
- `/content/[id]`
- `/flashcards`
- `/flashcards/new`
- `/flashcards/[id]`
- `/questions/quiz`
- `/questions/quiz/new`
- `/questions/test`
- `/questions/test/new`
- `/questions/[id]`
- `/attempts`
- `/attempts/[id]`
- `/notifications`
- `/notifications/new`
- `/feedback`
- `/feedback/[id]`
- `/media`
- `/audit-logs`
- `/settings/profile`
- `/settings/security`

### Dashboard

Show:

- Total users
- Active users
- Organ systems
- Topics
- Published lessons
- Flashcards
- Quiz questions
- Test questions
- New feedback
- Completed quizzes/tests
- Recent registrations
- Recent feedback
- Attempts trend
- Average quiz/test accuracy
- Content completeness by organ system

Charts must have meaningful labels and accessible summaries.

### User management

- Search, filter and paginate users
- View profile
- View recent attempts
- View topic/organ-system progress
- View strengths and weaknesses
- Activate/deactivate user
- Do not allow accidental deletion of user learning history

### Organ systems and topics

- Card/grid overview with imagery
- Reordering
- Draft/publish/archive
- Create/edit forms
- Slug generation with manual override
- Image upload/selection
- Content completeness indicator

### Content editor

Implement a simple structured block editor, not a full unrestricted WYSIWYG editor.

Required blocks:

- Heading
- Paragraph
- Image with alt text and caption
- Callout
- Bulleted list
- Numbered list
- Divider

Features:

- Add/remove blocks
- Reorder blocks
- Preview
- Validation
- Draft/publish
- Unsaved-change warning
- Save status feedback

### Flashcards

- List/grid toggle
- Search and filters
- Create/edit/delete/archive
- Front/back preview
- Optional images
- Difficulty and topic mapping
- Bulk publish/archive where safe
- CSV import/export can be prepared only if time permits; do not sacrifice core CRUD

### Quiz and test questions

Use visually separate sections:

- Quiz uses purple accent
- Test uses orange accent

Editor requirements:

- Question text
- Optional image
- Topic and concept
- Difficulty
- Four options by default; allow 2–6
- Mark exactly one correct option
- Explanation
- Draft/published state
- Duplicate question action
- Preview
- Validation before publish

### Attempts/results

- Filter by user, type, organ system, date and status
- View score and timing
- View answer breakdown
- Clearly distinguish unanswered, correct and incorrect
- Historical snapshots must be used

### Notifications

- Create draft campaigns
- Choose reminder/announcement type
- Message preview
- Target audience metadata
- Schedule timestamp
- Mark sending integration as disabled until Expo credentials exist
- Never claim a message was sent unless provider response confirms it

### Feedback

- Status tabs
- Detail view
- Mark reviewed/resolved
- Add internal notes
- Show related user when available
- Never expose internal notes to mobile users

### Media library

- Upload
- Grid/list view
- Search by filename/alt text
- Copy URL
- Edit alt text
- Archive/delete safely
- Show size/type/dimensions

---

## 7. UI and UX requirements

Follow `DESIGN.md` exactly.

Core visual language:

- Modern, calm, medical-learning interface
- Clean white and soft-neutral surfaces
- Blue primary brand
- Purple quiz accent
- Orange test accent
- Green success/flashcard accent
- Rounded cards and controls
- Subtle borders and shadows
- Strong spacing and hierarchy
- Avoid excessive gradients, glassmorphism, neon colors or gimmicky motion
- Use anatomical imagery as content, not decoration
- Responsive from mobile to wide desktop
- Accessible contrast, focus states and keyboard interactions

Every data page must include:

- Page title and short description
- Primary action
- Search/filter controls when relevant
- Loading state
- Empty state
- Error state with retry
- Pagination
- Confirmation for destructive actions
- Toast feedback
- Clear form validation

Use optimistic updates only when rollback is safe. Do not hide failed operations.

---

## 8. Project structure

Use a clear feature-oriented structure. A recommended shape is:

```text
app/
  (auth)/
  (admin)/
  api/
    health/
    v1/
components/
  layout/
  shared/
  forms/
  tables/
  charts/
  content-editor/
features/
  auth/
  users/
  organ-systems/
  topics/
  content/
  flashcards/
  questions/
  assessments/
  feedback/
  notifications/
  media/
lib/
  api/
  auth/
  db/
  supabase/
  validation/
  permissions/
  storage/
  logging/
  rate-limit/
  utils/
prisma/
  schema.prisma
  seed.ts
scripts/
docs/
tests/
```

Do not create giant files. Prefer cohesive modules and reusable domain services. Avoid premature abstraction.

Create:

- `lib/db/prisma.ts` singleton
- Browser and server Supabase clients
- Auth/session helpers
- Role guard helpers
- API response helpers
- Zod schemas grouped by feature
- Domain services separate from route handlers
- Central error mapping
- Storage service abstraction
- Audit service abstraction

---

## 9. Reliability and quality

### Type safety

- Strict TypeScript
- No unexplained `any`
- No `@ts-ignore` without documented reason
- Infer types from Zod and Prisma where practical
- Keep public API DTOs separate from raw Prisma models when sensitive fields exist

### Forms

- React Hook Form + Zod resolver
- Inline errors
- Disabled/pending states
- Prevent duplicate submission
- Unsaved-change warning for long editors

### Performance

- Server Components for initial data-heavy pages
- Paginate tables
- Avoid N+1 Prisma queries
- Select only required fields
- Use image optimization where compatible
- Lazy-load heavy editors/charts
- Do not fetch dashboard data in many sequential client requests; create an aggregated endpoint
- Use pooled database connection in production

### Accessibility

- Semantic landmarks
- Proper labels
- Keyboard support
- Visible focus
- Dialog focus trapping
- ARIA only where semantic HTML is insufficient
- Alt text required for educational images
- Do not communicate status only by color
- Respect reduced motion

### Observability

Implement:

- Structured server logs
- Request IDs
- Safe error reporting adapter
- Optional Sentry wiring guarded by environment variables
- Health endpoint
- No PII in logs beyond what is necessary

### Audit trail

Write audit records for:

- Content publish/archive/delete
- Question publish/archive/delete
- User activation changes
- Feedback resolution
- Notification scheduling/cancellation
- Admin role or security changes
- Media deletion

---

## 10. Testing requirements

Create and maintain `docs/TESTING.md`.

### Unit tests

At minimum:

- Assessment scoring
- Test expiry
- Question randomization mapping
- Attempt submission idempotency
- Validation schemas
- Permission helpers
- Dashboard strength/weakness calculations

### Integration tests

At minimum:

- Admin role enforcement
- Published content visibility
- CRUD validation
- Attempt start/answer/submit lifecycle
- Feedback submission/review
- Upload validation

### E2E tests

At minimum:

1. Admin login
2. Create an organ system or demo topic
3. Create and publish a question
4. View it in the admin list
5. Submit feedback and mark it reviewed
6. Verify unauthorized access redirects or returns 401/403

Use stable test selectors only when semantic selectors are insufficient.

Before marking any phase complete, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Use the actual repository package manager. If scripts do not exist, create them.

Do not claim success if checks fail. Fix failures or document the exact blocker.

---

## 11. Development phases

Work phase by phase. At the end of each phase:

1. Update `docs/PHASE_STATUS.md`
2. List files changed
3. List commands run
4. Report test/build status
5. Note remaining risks
6. Continue automatically only when the current phase is stable

### Phase 0 — Audit and planning

- Inspect repository
- Detect package manager
- Read requirements
- Create implementation docs
- Produce route map, schema plan and risks
- Do not perform destructive changes

Acceptance:

- Documentation exists
- Plan maps all SRS requirements
- No unresolved architecture contradiction

### Phase 1 — Foundation and design system

- Configure TypeScript strictness, linting and aliases
- Install required packages
- Configure shadcn/ui
- Implement design tokens
- Build admin shell
- Add auth page layouts
- Add shared loading, empty, error and confirmation components

Acceptance:

- Responsive shell works
- Design follows `DESIGN.md`
- No placeholder UI that ignores the theme

### Phase 2 — Supabase, Prisma and authentication

- Configure Supabase clients
- Implement Prisma schema
- Create migrations
- Create seed
- Implement auth/session guards
- Create bootstrap admin script
- Protect admin routes
- Implement auth pages

Acceptance:

- Admin can sign in
- Non-admin cannot enter dashboard
- Database migration and seed succeed
- No secrets exposed

### Phase 3 — Core content administration

- Organ systems
- Topics
- Structured lessons
- Media library
- Publish/archive workflows
- Audit logs

Acceptance:

- Complete CRUD flows
- Media uploads validated
- Mobile-facing published-content APIs work

### Phase 4 — Flashcards and questions

- Flashcard CRUD
- Quiz question CRUD
- Test question CRUD
- Option validation
- Filters, pagination, preview, publish/archive
- Seed sample questions

Acceptance:

- Exactly one correct answer enforced
- Published questions available to assessment service
- Quiz/test visual differentiation implemented

### Phase 5 — Assessment engine and user progress

- Start attempts
- Snapshot questions/options
- Answer updates
- Timed test expiry
- Submission and scoring
- Results and explanations
- Retakes
- User attempt/progress admin pages
- User dashboard API

Acceptance:

- Full lifecycle tests pass
- Server enforces time limit
- Historical attempts remain stable after question edits

### Phase 6 — Dashboard, feedback and notifications

- Dashboard summary endpoint and UI
- Feedback submission/admin review
- Notification campaign management
- Device token endpoints
- Sending adapter with safe disabled state when not configured

Acceptance:

- Dashboard metrics are derived from real data
- Feedback statuses work
- Notification UI never reports false success

### Phase 7 — Hardening and delivery

- Accessibility review
- Security review
- Error/loading/empty states
- Responsive testing
- Unit/integration/E2E completion
- OpenAPI spec
- README and setup guide
- Vercel deployment readiness
- Final seed/demo account instructions

Acceptance:

- Lint, typecheck, tests and production build pass
- No critical TODOs
- No secrets committed
- Admin workflow demo is complete
- API documentation matches implementation

---

## 12. Acceptance criteria

The MVP is complete only when:

- Admin authentication and role protection work
- Dashboard uses real database metrics
- Users and progress can be viewed
- All 11 organ systems are seeded
- Organ systems, topics and lessons have working CRUD
- Structured content renders and previews correctly
- Flashcards have working CRUD and filtering
- Quiz/test questions have working CRUD and validation
- Assessments can start, receive answers and submit
- Test expiry is enforced by the server
- Results and explanations are available after submission
- Feedback can be submitted and reviewed
- Notification campaigns can be drafted/scheduled
- Media uploads are validated and managed
- Mobile-facing APIs expose only published data
- API errors are consistent
- Pagination exists on large lists
- Destructive actions are confirmed and audited
- Responsive admin UI works at mobile, tablet and desktop widths
- Accessibility basics are implemented
- Seed data and bootstrap-admin script work
- OpenAPI and setup documentation exist
- Lint, typecheck, tests and build pass

---

## 13. Non-goals for this MVP

Do not add these unless all core acceptance criteria are complete:

- Social login
- Search across mobile learning content
- Notes and bookmarks
- Offline synchronization
- Leaderboards
- Achievements
- Daily challenges
- Multi-tenant organizations
- Payments/subscriptions
- AI question generation
- Real-time multiplayer quizzes
- Complex analytics warehouse
- GraphQL
- Microservices
- Kubernetes
- Unrestricted rich HTML editing

---

## 14. Final delivery report

When finished, provide a final report containing:

- Architecture summary
- Implemented features mapped to requirements
- Database migration status
- Seed/admin bootstrap steps
- Environment variables still required
- API documentation location
- Test command results
- Production build result
- Known limitations
- Vercel deployment steps
- Supabase dashboard configuration still required
- Mobile integration notes for the future Expo application
- Exact demo login creation instructions without printing a password

Begin with Phase 0. Inspect first, plan second, implement third. Do not skip documentation, security checks or tests.
