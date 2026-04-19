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
- **Tables**: 14 base tables (`_users`, `_companies`, `_jobs`, `_applications`, `_interview_sessions`, `_assessment_invites`, `_workflows`, `_notifications`, `_credit_transactions`, `_system_config`, `_audit_logs`, `_pricing_config`, `_promo_codes`, `_payment_transactions`)
- **Views**: camelCase views sit on top of each base table for TypeScript compatibility
- **Storage buckets**: `company-assets` (public), `candidate-documents` (private)
- **RLS**: Not enabled (development mode); enable on base tables for production
- **Secrets required**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
