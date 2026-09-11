# Netlify + Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current ChatGPT Sites/Cloudflare implementation into a StackBlitz-friendly Next.js application backed by Supabase Postgres, Supabase Storage, and Supabase Auth, ready for Netlify deployment without changing the volleyball product semantics.

**Architecture:** Preserve the existing App Router pages, ingestion adapters, deterministic analytics, canonical identity/reconciliation rules, and public API contracts. Replace Vinext/Sites/Cloudflare runtime dependencies with standard Next.js 16, Supabase SSR authentication, server-only Supabase administration for program-scoped repositories, and a Postgres migration/storage bucket. Netlify uses its native OpenNext support for the Next.js App Router.

**Tech Stack:** Next.js 16.3.4, React 19.2.6, TypeScript 5.9.3, @supabase/supabase-js 2.116.0, @supabase/ssr 0.12.7, Supabase Postgres/Storage/Auth, Netlify.

**Spec:** `College_Athletics_Consulting_Volleyball_V1_Design_Spec_2026-09-07.md`

## Global Constraints

- Preserve FAST, EASY, EFFICIENT product behavior.
- Sources remain evidence, not canonical truth.
- Multiple sources enrich one canonical match.
- Deterministic application code calculates statistics; Coach's Edge only interprets stored results.
- Staff corrections remain canonical across re-imports.
- Missing evidence remains missing.
- Basic public box scores remain valid; richer evidence only expands capabilities.
- No Firebase, D1, R2, Wrangler, Sites auth headers, or Sites Vite plugin remain in the migrated runtime.
- All database/storage/admin credentials stay server-only.

---

### Task 1: Runtime conversion

**Files:** `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `.env.example`, `.gitignore`, `netlify.toml`, remove `vite.config.ts`, `.openai/`, `env.d.ts`.

**Produces:** Standard Next.js dev/build/start commands and Netlify-compatible configuration.

- [ ] Replace Vinext/Sites/Cloudflare dependencies with Next.js + Supabase dependencies.
- [ ] Add migration contract test proving Sites/Cloudflare runtime dependencies are absent.
- [ ] Update TypeScript/environment configuration.

### Task 2: Supabase clients and authentication

**Files:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/proxy.ts`, `proxy.ts`, `lib/auth/current-user.ts`, `lib/auth/program-context.ts`, `app/login/page.tsx`, `components/auth-form.tsx`, `app/auth/signout/route.ts`.

**Produces:** Cookie-based Supabase Auth, server-verified current user, sign-in/sign-up UI, server-only admin client.

- [ ] Add pure auth-user mapping regression test.
- [ ] Implement SSR/browser/admin Supabase clients and Next proxy session refresh.
- [ ] Replace Sites identity header parsing with Supabase `auth.getUser()`.

### Task 3: Postgres schema and evidence storage

**Files:** `supabase/migrations/202609090001_initial.sql`, `db/schema.ts`, `db/client.ts`, `db/repositories/sources.ts`.

**Produces:** 23-table Postgres schema plus private `volleyball-evidence` Storage bucket and source-preservation implementation.

- [ ] Convert SQLite/D1 schema to Postgres while preserving constraints/indexes.
- [ ] Add schema contract tests for all canonical tables and storage bucket.
- [ ] Replace R2 writes with Supabase Storage uploads and preserve content-hash dedupe.

### Task 4: Repository port

**Files:** `db/repositories/programs.ts`, `roster.ts`, `schedule.ts`, `matches.ts`, `analytics.ts`.

**Produces:** Same exported repository interfaces backed by Supabase PostgREST instead of D1 prepared statements.

- [ ] Port program/membership creation and lookup.
- [ ] Port roster identity/reconciliation/evidence persistence.
- [ ] Port schedule identity/refresh/source-link persistence.
- [ ] Port match resolution/evidence attachment and deterministic analytics persistence.
- [ ] Port Match Summary and Coach's Edge metric retrieval.

### Task 5: Route/page integration

**Files:** all `app/api/**/route.ts`, `app/page.tsx`, `app/setup/page.tsx`, `app/roster/page.tsx`, `app/schedule/page.tsx`, `app/matches/page.tsx`, `app/matches/[matchId]/page.tsx`, `app/coaches-edge/page.tsx`, `components/app-shell.tsx`.

**Produces:** Existing UI flows using Supabase Auth/repositories without Sites headers or Cloudflare APIs.

- [ ] Replace header-auth calls with async Supabase current-user/program-context calls.
- [ ] Preserve existing response shapes and client component behavior.
- [ ] Add sign-out control.

### Task 6: Migration regression + developer handoff

**Files:** `tests/core/migration-runtime.test.mjs`, update obsolete Sites/D1 contract tests, `README.md`, `MIGRATION_NOTES.md`, `SUPABASE_SETUP.md`.

**Produces:** A GitHub/StackBlitz-ready project with explicit Supabase setup and verification commands.

- [ ] Keep deterministic/core parser/analytics tests passing.
- [ ] Replace D1-specific persistence tests with Supabase runtime contracts and repository invariants.
- [ ] Verify source tree contains no runtime Sites/Cloudflare dependencies.
- [ ] Document one-time Supabase SQL migration, environment variables, StackBlitz boot, and Netlify deployment.
- [ ] Run source hygiene, core tests, TypeScript/build where dependencies are available; record any environment-only verification gap honestly.
