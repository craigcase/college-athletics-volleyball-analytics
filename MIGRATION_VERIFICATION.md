# Migration Verification — 2026-09-09

This document records what was actually verified before packaging the first Netlify + Supabase migration build.

## Verified in the build workspace

- The portable runtime is standard Next.js App Router, not ChatGPT Sites/Vinext/Cloudflare Workers.
- Production source paths contain no `@openai/sites`, `@cloudflare`, `cloudflare:workers`, Wrangler, Vinext, or Workerd runtime imports.
- Supabase Postgres migration contains the 23 canonical/evidence/analytics/audit tables from the Sites/D1 baseline.
- The private `volleyball-evidence` Storage bucket is created by the migration.
- Supabase Auth is wired through `@supabase/ssr`; program intelligence remains server-scoped.
- Raw imported evidence is written to Supabase Storage before canonical parser/repository writes.
- Roster, schedule, source lineage, match reconciliation, deterministic analytics, and Coach's Edge domain regressions remain covered.
- The Sidearm schedule adapter accepts an explicit canonical season year and does not depend on the runtime clock when that context is supplied.

## Automated regression gate

Command:

```bash
npm test
```

Result at packaging time: **58 tests passed, 0 failed**.

The suite includes real-world VCSU/Sidearm roster, schedule, and public box-score fixtures plus vertical-slice and richer-evidence enrichment tests.

## Static source checks

- `git diff --check`: clean.
- Production runtime scan: no Sites/Cloudflare runtime references.
- TypeScript parse/internal type consistency was checked across `app/`, `components/`, `db/`, `lib/`, `proxy.ts`, and `next.config.ts` with local declaration stubs because this build workspace cannot reach the npm registry.

## Integration checks that must run in StackBlitz

This environment cannot install the new Next.js/Supabase dependency tree from npm, so it cannot truthfully verify the dependency-backed commands below. Run them after replacing the GitHub repository contents and refreshing StackBlitz:

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

The first successful preview without Supabase variables should show the Supabase setup-required login state rather than crash. After Supabase is configured, verify sign-up/sign-in, Program Setup, the real VCSU roster import, the real VCSU schedule import, Match Data ingestion, Match Summary, and Coach's Edge.

## Package-lock note

The former lockfile described the Sites/Cloudflare dependency tree and was intentionally removed. A fresh `npm install` in StackBlitz will create the correct lockfile for the portable Next.js/Supabase runtime; commit that generated `package-lock.json` once installation succeeds.

## StackBlitz verification follow-up — v0.2.1

The first StackBlitz run of v0.2.0 established three migration issues:

- TypeScript strict-mode narrowing in `db/repositories/roster.ts`.
- A stale Sites-era `vite.config.ts` remaining in the older repository checkout.
- Next.js Turbopack is unavailable in StackBlitz WebContainers when only WASM bindings load.

v0.2.1 addresses these by using explicit local candidates for strict narrowing, shipping an inert Vite compatibility tombstone, and forcing Webpack for both `dev` and `build`.

Fresh core verification after these changes: 58 tests passed, 0 failed. Full dependency-backed typecheck/build must be rerun in StackBlitz because this packaging environment cannot download npm dependencies.


## StackBlitz compatibility hardening — v0.2.2

- Added `.stackblitzrc` with `startCommand: npm run dev` so StackBlitz does not auto-launch `npx next dev` and accidentally enable Turbopack.
- `npm run dev` and `npm run build` continue to force Webpack.
- Added webpack `resolve.extensionAlias` entries in `next.config.ts` so NodeNext-style `.js` specifiers in deterministic TypeScript modules resolve to `.ts`/`.tsx` sources during the Next.js production bundle.
- Core migration regression test now checks both StackBlitz startup configuration and webpack extension aliases.
## v0.2.3 StackBlitz CSS compatibility

Removed the stale `@import 'tailwindcss';` directive from `app/globals.css`. The migrated UI uses project-owned CSS classes and does not require Tailwind. A regression assertion now prevents reintroducing the orphaned Tailwind dependency.

