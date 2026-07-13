# SETUP_GUIDE.md — AnatoLearn Admin and Backend

## 1. Create the Next.js project

If the project already exists, skip project creation and work inside it.

Recommended creation settings:

- TypeScript
- ESLint
- Tailwind CSS
- `src/` directory optional, but remain consistent
- App Router
- Import alias `@/*`

Then copy these files into the repository root:

- `MASTER_BUILD_PROMPT.md`
- `DESIGN.md`
- `AGENTS.md`
- `.env.example`

Paste the master prompt into Claude Code/OpenCode from the repository root.

---

## 2. Create a Supabase project

Create one Supabase project for development.

Collect:

- Project URL
- Anon/publishable key
- Service-role key
- Database password
- Pooled connection string
- Direct/session connection string

Use:

- Pooled URL as `DATABASE_URL`
- Direct/session URL as `DIRECT_URL`
- Service-role key only on the server

Do not put the service-role key in a variable beginning with `NEXT_PUBLIC_`.

---

## 3. Configure authentication

In Supabase Authentication:

1. Enable email/password authentication.
2. Set the local site URL to `http://localhost:3000`.
3. Add local redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
4. Later add the production Vercel domain.
5. Configure email templates and SMTP only when branded production email is needed.

The admin panel should use secure SSR cookies. The future Expo app can send a Supabase access token in the API Authorization header.

---

## 4. Create storage

Create a bucket named:

`anatomy-media`

Recommended MVP settings:

- Public bucket only for approved educational images
- Maximum upload size 8 MB
- Accept PNG, JPEG and WebP
- Require alt text in the application
- Restrict uploads to admins
- Do not permit arbitrary file types

If private media is required, switch to signed URLs and adjust the implementation consistently.

---

## 5. Prepare environment variables

Copy:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Fill all required values:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `CRON_SECRET`

Optional integrations can remain empty during early development.

---

## 6. Install and initialize

The agent should install packages and create scripts, but the expected workflow is similar to:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run admin:bootstrap
npm run dev
```

Use the repository's actual package manager.

Never run a destructive reset against production.

---

## 7. Bootstrap the first administrator

The implementation should create:

`scripts/bootstrap-admin.ts`

Run it explicitly after migrations and environment configuration.

The script should:

- Create/find the Supabase Auth account
- Upsert the `Profile` as `ADMIN`
- Be idempotent
- Avoid printing the password
- Encourage password rotation

After first login:

1. Change the temporary password.
2. Remove `ADMIN_BOOTSTRAP_PASSWORD` from production environment variables.
3. Keep only a documented recovery process.

---

## 8. Seed data

The seed should add:

- Eleven organ systems
- Demo circulatory topics
- Sample lesson content
- Sample flashcards
- Sample quiz/test questions

Run the seed repeatedly without duplicates.

Sample educational content is for demonstration and must be reviewed by the client before production use.

---

## 9. Local verification

Expected checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Then manually verify:

- Login
- Dashboard
- Organ-system CRUD
- Topic CRUD
- Content editor and preview
- Media upload
- Flashcard CRUD
- Quiz/test question CRUD
- Feedback workflow
- Role protection
- API health endpoint

---

## 10. Vercel deployment

1. Push the repository to the approved Git provider.
2. Import it into Vercel.
3. Add environment variables separately for Development, Preview and Production.
4. Use production Supabase URLs and keys.
5. Run migrations through a controlled deployment step or manually with:
   `prisma migrate deploy`
6. Add the production domain to Supabase Auth redirect allowlist.
7. Redeploy after changing environment variables.
8. Verify `/api/health`.
9. Test admin login and a read/write workflow.
10. Confirm service-role keys are not present in browser bundles.

For scheduled jobs, protect cron routes using `CRON_SECRET`.

---

## 11. Mobile integration later

The Expo app will use:

- Supabase Auth for sign-up/login/session
- REST API base URL from the deployed Next.js project
- `Authorization: Bearer <access-token>`
- Published content endpoints
- Assessment endpoints
- Feedback endpoint
- Device-token endpoint for push notifications

Do not put server secrets in the Expo application.

---

## 12. Required third-party services

Required:

- Supabase: PostgreSQL, Auth and Storage
- Vercel: Next.js deployment
- GitHub/GitLab/Bitbucket: source control and deployment integration

Required later for iOS mobile delivery:

- Expo/EAS
- Apple Developer account

Optional:

- Sentry: error monitoring
- Resend: custom transactional email
- Upstash Redis: stronger serverless rate limiting
- Expo Push Service: push notifications

Do not add optional services before the core MVP works.
