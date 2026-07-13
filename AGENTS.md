# AGENTS.md — Repository Operating Rules

This file defines mandatory behavior for Claude Code, OpenCode, Cursor agents and human contributors working on AnatoLearn.

## 1. Read before writing

Before editing code:

1. Inspect the repository tree.
2. Identify the package manager from the lockfile.
3. Read:
   - `README.md`
   - `DESIGN.md`
   - `.env.example`
   - `docs/ARCHITECTURE.md`
   - `docs/IMPLEMENTATION_PLAN.md`
   - `docs/PHASE_STATUS.md`
   - Prisma schema and migrations
4. Review recent changes before replacing existing work.
5. Confirm which phase is currently active.

Do not reinitialize the repository, delete working code or switch frameworks without explicit approval.

---

## 2. Source of truth order

When instructions conflict, use this order:

1. Explicit current user instruction
2. Product SRS and approved scope
3. This `AGENTS.md`
4. `DESIGN.md`
5. `docs/ARCHITECTURE.md`
6. Existing established repository conventions
7. Agent preference

Document material conflicts in `docs/PHASE_STATUS.md`.

---

## 3. Working style

- Work in small, reviewable phases.
- Inspect before editing.
- Prefer focused changes over broad rewrites.
- Reuse existing utilities and components.
- Do not duplicate domain logic in UI and API layers.
- Keep route handlers thin; put business logic in services.
- Keep validation schemas reusable.
- Keep security checks server-side.
- Update documentation as the implementation changes.
- Do not claim a task is complete until verification commands pass.

When uncertain, choose the least destructive reversible approach.

---

## 4. Prohibited behavior

Never:

- Commit secrets or `.env.local`
- Print service-role keys, passwords or access tokens
- Expose server-only variables through `NEXT_PUBLIC_*`
- Disable authentication to make tests pass
- Trust a role or user ID supplied by the browser
- Use `any` as a shortcut without explanation
- Add `@ts-ignore` without a documented reason
- Swallow errors silently
- Return stack traces to clients
- Use fake data in production dashboards
- Hard-delete referenced questions or attempts
- Run destructive database reset commands without explicit approval
- Edit old migration files after they may have been applied
- Skip tests because the change “looks simple”
- Add unrelated dependencies
- Replace the design system with a template that conflicts with `DESIGN.md`
- Report a notification as sent without provider confirmation
- Store unrestricted HTML from untrusted users

---

## 5. Commands and safety

Prefer repository scripts.

Safe normal commands include:

- install dependencies
- lint
- typecheck
- unit tests
- integration tests
- Playwright tests
- Prisma generate
- Prisma migrate dev for local development
- Prisma migrate deploy for deployment
- Prisma seed
- production build

Ask before:

- `prisma migrate reset`
- dropping schemas/tables
- deleting storage buckets
- deleting large directories
- force pushes
- rewriting Git history
- changing authentication providers
- changing database providers
- rotating production credentials
- modifying production data

Never use `--force` merely to bypass dependency or migration errors.

---

## 6. Package management

- Use the package manager matching the lockfile.
- Do not create a second lockfile.
- Prefer current stable packages compatible with the installed Next.js/React version.
- Verify package purpose before installation.
- Remove unused dependencies.
- Avoid adding large UI libraries when shadcn/ui and existing components are enough.
- Record major new dependencies in `docs/ARCHITECTURE.md`.

---

## 7. Architecture rules

- Next.js App Router
- Route Handlers under `app/api/v1`
- Server Components by default
- Client Components only for interactions
- Prisma is the application data-access layer
- Supabase handles authentication and storage
- Browser/mobile clients do not directly query application tables
- Shared domain services power admin UI and REST APIs
- Zod validates all external input
- Public DTOs must not leak internal or sensitive fields
- API responses use the shared envelope
- Use a centralized error mapper
- Use feature-oriented organization
- Avoid giant files and circular dependencies

---

## 8. Authentication rules

- Use Supabase Auth; do not build custom password handling.
- Web admin uses secure SSR cookie sessions.
- Mobile APIs accept verified bearer access tokens.
- Resolve role from the database, never from request payloads.
- Protect admin routes on the server.
- Check active status for protected operations.
- Service-role key is server-only.
- Password reset redirects must be allowlisted and environment-driven.
- Auth errors shown to users must be safe and understandable.

---

## 9. Database and migration rules

- Use UUIDs.
- Use foreign keys and indexes.
- Add timestamps consistently.
- Prefer archive/soft-delete for referenced content.
- Historical attempts use immutable snapshots.
- New schema changes require a new migration.
- Migration names should describe the change.
- Seed scripts must be idempotent.
- Never rely on seed data for authorization in production.
- Use pooled connection for runtime and direct connection for migrations where configured.
- Avoid N+1 queries.
- Use transactions for multi-step writes that must remain consistent.

Before changing schema:

1. Explain the change in the phase plan.
2. Check existing relations and data.
3. Create a migration.
4. Regenerate Prisma Client.
5. Update seed, tests and API docs.
6. Run migration in the intended environment.

---

## 10. API rules

Every endpoint must define:

- Authentication requirement
- Authorization rule
- Input schema
- Output DTO
- Error cases
- Status codes
- Pagination/filter behavior
- Side effects
- Audit behavior where relevant

Use:

- `401` for missing/invalid authentication
- `403` for authenticated but unauthorized
- `404` for inaccessible or absent resources
- `409` for state conflicts
- `422` for validated input that cannot be processed, when appropriate
- `429` for rate limit
- `500` only for unexpected server failures

Do not expose whether another user’s private resource exists.

---

## 11. UI rules

Follow `DESIGN.md`.

All major pages need:

- Loading
- Empty
- Error
- Success
- Disabled/pending
- Responsive behavior
- Keyboard/focus behavior

Use semantic components. Do not create visually inconsistent one-off controls when a shared component exists.

Tables must paginate. Long forms need unsaved-change handling. Destructive actions require confirmation.

---

## 12. Testing rules

A change is not complete until relevant tests pass.

Minimum verification:

```bash
<package-manager> run lint
<package-manager> run typecheck
<package-manager> run test
<package-manager> run build
```

Add Playwright for critical user flows.

When a test fails:

1. Read the real error.
2. Fix root cause.
3. Do not weaken assertions solely to pass.
4. Document unavoidable blockers.

Never claim a command passed if it was not run.

---

## 13. Phase discipline

Use the phases in the master prompt.

At phase completion update `docs/PHASE_STATUS.md` with:

- Completed items
- Files changed
- Migrations added
- API endpoints added
- Tests added
- Commands and results
- Known risks
- Next phase

Do not begin broad work from a later phase while core dependencies from the current phase remain unstable.

---

## 14. Documentation maintenance

Update documentation whenever behavior changes.

Required documents:

- `README.md`: human setup and usage
- `docs/ARCHITECTURE.md`: technical decisions
- `docs/API_SPEC.md`: endpoint behavior
- `docs/openapi.yaml`: machine-readable API
- `docs/SECURITY.md`: trust boundaries and secrets
- `docs/TESTING.md`: test strategy and commands
- `docs/IMPLEMENTATION_PLAN.md`: phase plan
- `docs/PHASE_STATUS.md`: progress log

Documentation must match the code, not an intended future state.

---

## 15. Git behavior

- Keep commits focused when Git operations are requested.
- Do not rewrite history.
- Do not force push.
- Do not commit generated secrets or local database files.
- Respect `.gitignore`.
- Summarize changed files before commit.
- Suggested commit prefixes:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `test:`
  - `docs:`
  - `chore:`

Do not create commits unless the user asks or repository workflow explicitly requires it.

---

## 16. Definition of done

A feature is done when:

- Requirements are met
- Authorization is correct
- Input is validated
- Error states exist
- UI is responsive and accessible
- Tests exist where meaningful
- Lint/typecheck/tests/build pass
- Documentation is updated
- No secrets or sensitive data are exposed
- No unresolved critical TODO remains
