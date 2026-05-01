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

- **Routes**: `/api/healthz`, `/api/send-email` (JWT-auth), `/api/send-email-public` (session-verified), `/api/extension/*` (token/JWT-auth), `/api/ai/*` (JWT or session-verified), `/api/reference/*` (mixed: HR JWT + public token + Twilio webhook)
- **Email**: Resend SDK — templates: `assessment_invite`, `candidate_welcome`, `assessment_complete`, `hire_notification`, `rejection_notification`
- **Extension API**: `generate-token` (JWT), `validate-token` (public), `submit-gambling` (token), `submit-proctoring` (token)
- **AI API**:
  - `POST /api/ai/interview-question` — Gemini `gemini-3-flash-preview` (primary) with DeepSeek `deepseek-chat` (fallback) generates the next contextual interview question in Indonesian. Accepts `{ sessionId?, role, history, assessmentData? }`. Frontend stub `generateNextQuestion` in `services/genai.ts` calls this; on failure falls back to 5 hardcoded questions so an in-progress assessment is never blocked.
  - `POST /api/ai/fraud-analysis` — Gemini (primary) / DeepSeek (fallback) analyzes candidate fraud risk based on Fraud Triangle framework. Returns structured JSON with scores, risk level, red flags, and recommendations.
  - `POST /api/ai/parse-cv` — Mistral OCR (`mistral-ocr-latest`) extracts text from the uploaded PDF (downloaded server-side via `SUPABASE_SERVICE_KEY` from `candidate-documents`), then `mistral-small-latest` with `response_format: json_object` extracts structured `ParsedCVData` fields and writes them to `_interview_sessions.cv_parsed_data`. Frontend stub `parseCVWithMistral` in `services/supabase.ts` calls this; throws on failure so `CandidateDetail.handleParseCV` shows an error toast. Image-only / unreadable scans return 422.
- **Secrets required**: `RESEND_API_KEY`, `SESSION_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY` (fallback), `MISTRAL_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (e.g. `+14155238886`), `TWILIO_REFCHECK_CONTENT_SID` (Content Template SID with 4 vars + 2 quick-reply buttons "Ya, benar" / "Tidak, tidak pernah"), `TWILIO_CANDIDATE_FORM_CONTENT_SID` (Content Template for candidate notification, vars 1=name, 2=company, 3=formLink), optional `TWILIO_WEBHOOK_AUTH_TOKEN`, `TWILIO_WEBHOOK_STRICT` (default `true` — set `false` only for local dev when Twilio cannot validate the signature URL), `PUBLIC_APP_URL`

## Reference Check (Cek Referensi Kerja via WhatsApp) — Task #11

- **Tables (run `artifacts/fraudapp/migrations/2026-04-20-reference-checks.sql`)**: `_reference_check_requests`, `_reference_check_responses`, plus camelCase view `reference_check_requests` joining responses.
- **API**:
  - `POST /api/reference/create-request` (HR JWT) — generates token, emails + WAs candidate the form link `${PUBLIC_APP_URL}/reference/<token>`. Deducts 1 credit (best-effort).
  - `GET /api/reference/:token` (public) — form metadata.
  - `POST /api/reference/:token/submit` (public) — accepts up to 3 references, normalizes phone to E.164 (+62), inserts response rows, sends Twilio Content template per HR (vars: 1=candidateName, 2=prevCompany, 3=prevRole, 4=prevPeriod), deducts 10 credits per outgoing WA.
  - `POST /api/reference/twilio-webhook` (public, X-Twilio-Signature verified) — parses ButtonText / Body for Ya / Tidak / free-text, updates response status (`confirmed` | `denied` | `pending` | `no_response`), replies thank-you.
  - `POST /api/reference/:requestId/resend/:responseId` (HR JWT) — resends template to a specific HR (allowed only after 48h with no reply).
  - `GET /api/reference/by-session/:sessionId` (HR JWT) — list requests + nested responses.
- **Frontend**:
  - `services/referenceService.ts` — typed client.
  - `components/PublicReferenceForm.tsx` mounted at `/reference/:token` via App.tsx public-mode route.
  - `components/candidate-detail/ReferenceCheckCard.tsx` — rendered in CandidateDetail Background tab (twice — same spots as ExtensionScreeningCard). Polls every 30s; shows status badges and resend button after 48h.
  - `services/stageTracker.ts` — when stage transitions to `background_check`, auto-calls `createReferenceRequest` (best-effort, non-fatal).
- **Twilio template setup**: create a WhatsApp Content Template with body using `{{1}}` candidate name, `{{2}}` prev company, `{{3}}` prev role, `{{4}}` prev period, plus 2 quick-reply buttons titled "Ya, benar" and "Tidak, tidak pernah". Copy the resulting `HX...` SID into `TWILIO_REFCHECK_CONTENT_SID`. Twilio Console → Messaging → Inbound webhook URL must point to `${PUBLIC_APP_URL}/api/reference/twilio-webhook`.

### Task #13 — Twilio setup checklist (operator-side, in Twilio Console)

Required Replit Secrets (already requested via the Secrets tab):
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`,
`TWILIO_REFCHECK_CONTENT_SID`, `PUBLIC_APP_URL`. Optional:
`TWILIO_WEBHOOK_AUTH_TOKEN` (only if your inbound webhook uses a
separate auth token; otherwise the code falls back to
`TWILIO_AUTH_TOKEN`), `TWILIO_WEBHOOK_STRICT` (default `true`; set
`false` only for local dev when Twilio cannot validate the signature URL),
`TWILIO_CANDIDATE_FORM_CONTENT_SID` (separate template for the
candidate's form-link notification).

Steps to perform in the Twilio Console:
1. **Content Template Builder** → New WhatsApp template, body in
   Bahasa Indonesia using exactly 4 numbered variables in this order:
   `{{1}}` candidate name, `{{2}}` prev company, `{{3}}` prev role,
   `{{4}}` prev period. Add 2 Quick-Reply buttons titled exactly
   `Ya, benar` and `Tidak, tidak pernah` (the webhook parser at
   `routes/reference.ts` matches on these strings + Indonesian fuzzy
   matches like "ya"/"tidak"). Submit for WhatsApp approval.
2. After approval, copy the template's `HX...` SID into the
   `TWILIO_REFCHECK_CONTENT_SID` Replit Secret.
3. **Messaging → your WhatsApp sender → Inbound webhook**: set
   `A MESSAGE COMES IN` URL to `{PUBLIC_APP_URL}/api/reference/twilio-webhook`,
   method `HTTP POST`. Save.
4. Verify by triggering a candidate's reference flow end-to-end: HR
   creates request → candidate fills form → HR contact receives the
   approved template → HR taps `Ya, benar` → response row updates to
   `confirmed` and HR sees confirmation in the dashboard.

Operator readiness check: on api-server boot, `routes/reference.ts`
logs either `[refcheck] Twilio WhatsApp configured` (with masked
content SID + webhook URL) or `[refcheck] Twilio WhatsApp NOT fully
configured` listing missing env vars.

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
