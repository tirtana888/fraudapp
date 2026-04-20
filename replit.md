# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM (API server); Supabase (FraudGuard app)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## FraudGuard App (artifacts/fraudapp)

- **Frontend**: React + Vite
- **Backend/DB**: Supabase (project: behtywhlundlfxkdesux)
- **Schema**: `artifacts/fraudapp/supabase-schema.sql` — applied to Supabase
- **Tables**: 14 base tables + `extension_tokens` (run `scripts/extension-tokens-migration.sql`)
  - `_users`, `_companies`, `_jobs`, `_applications`, `_interview_sessions`, `_assessment_invites`, `_workflows`, `_notifications`, `_credit_transactions`, `_system_config`, `_audit_logs`, `_pricing_config`, `_promo_codes`, `_payment_transactions`, `extension_tokens`
- **Views**: camelCase views sit on top of each base table for TypeScript compatibility
- **Storage buckets**: `company-assets` (public), `candidate-documents` (private)
- **RLS**: Enabled on all tables (Task #5). `extension_tokens` policies also in migration SQL.
- **Secrets required**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`

## API Server (artifacts/api-server)

- **Routes**: `/api/healthz`, `/api/send-email` (JWT-auth), `/api/send-email-public` (session-verified), `/api/extension/*` (token/JWT-auth)
- **Email**: Resend SDK — templates: `assessment_invite`, `candidate_welcome`, `assessment_complete`, `hire_notification`, `rejection_notification`
- **Extension API**: `generate-token` (JWT), `validate-token` (public), `submit-gambling` (token), `submit-proctoring` (token)
- **Secrets required**: `RESEND_API_KEY`, `SESSION_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Chrome Extension (fraudguard-extension/)

- **Location**: `fraudguard-extension/` at workspace root (load unpacked in Chrome)
- **Features**: Gambling history scanner (30 days, 50+ domains, Indonesian sites), Interview proctoring (tab switches, copy-paste, devtools, AI tools)
- **Flow**: HR generates token in dashboard → candidate installs extension, enters token → results appear in candidate's Background Check tab
- **API base**: auto-detected from page origin via content-script → works on both Replit dev domain and production
- **DB**: Requires `extension_tokens` table + `gambling_analysis`/`proctoring_data` JSONB columns on `interview_sessions` (see migration SQL)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Auth notes (FraudGuard)

- Supabase client is configured with explicit auth options (`persistSession`, `autoRefreshToken`, `flowType: 'pkce'`, custom `storageKey: 'fraudguard-auth'`) and is cached on `globalThis` to avoid duplicate `GoTrueClient` instances during Vite HMR. See top of `artifacts/fraudapp/services/supabase.ts`.
- `observeAuthState` never logs out an authenticated user on transient errors: profile-lookup failures fall back to a minimal profile derived from the auth user, and `provision_company` is only invoked on a fresh `SIGNED_IN` event (never on `INITIAL_SESSION` / `TOKEN_REFRESHED`), so returning users are not signed out by the RPC throwing "caller already belongs to a company".
- Signup (`signUpWithFirebase`) stores `full_name`, `company_name`, `phone`, `avatar_url` in Supabase `user_metadata` so provisioning can complete later. It only calls `provision_company` immediately if `auth.signUp` returns a session; otherwise (Supabase email confirmation enabled → no session) provisioning is deferred to the first `SIGNED_IN` event in `observeAuthState`, which reads the same metadata. This prevents the `provision_company: caller is not authenticated` error during registration.

- The job creation wizard's description editor uses `react-quill-new` (drop-in fork of `react-quill` that supports React 18/19). The original `react-quill@2.0.0` calls APIs removed in React 19 (`findDOMNode`) and crashes step 2 of the wizard with a blank screen. CSS import path is `react-quill-new/dist/quill.snow.css`.

## Environment notes

- `package.json` `packageManager` field must match the pnpm version available on the system (currently `pnpm@10.26.1`); a mismatch causes pnpm to repeatedly try to bootstrap the pinned version and fail with `pnpm add pnpm@<version>` errors, blocking workflow startup.
