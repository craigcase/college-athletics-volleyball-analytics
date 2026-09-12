# College Athletics Consulting — Volleyball Analytics

Evidence-driven volleyball analytics for collegiate programs.

## Current migration target

This source is the portable replacement for the former ChatGPT Sites runtime:

- **Application:** Next.js App Router
- **Database:** Supabase Postgres
- **Raw evidence storage:** private Supabase Storage bucket
- **Authentication:** Supabase Auth
- **Development:** GitHub + StackBlitz
- **Hosting:** Netlify

The volleyball domain logic remains source-neutral and deterministic. The language layer may explain stored analytics but does not calculate statistics.

## Run locally / StackBlitz

1. Create a Supabase project and apply `supabase/migrations/202609090001_initial.sql` in the Supabase SQL Editor.
2. Add the four Supabase environment values using the secure StackBlitz/Netlify variable settings described in `SUPABASE_SETUP.md` (or a gitignored `.env.local` for local-only development).
3. Run:

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Open the preview, create/sign in to an account, then complete:

**Program Setup → Roster URL → Schedule URL → Matches → Add Match Data → Match Summary → Coach's Edge**

## Production build

```bash
npm run build
npm start
```

Netlify supports the Next.js App Router through its OpenNext integration. Connect the GitHub repository and add the same Supabase environment variables in Netlify.

## Important files

- `College_Athletics_Consulting_Volleyball_V1_Design_Spec_2026-09-07.md` — product/design authority
- `supabase/migrations/202609090001_initial.sql` — Postgres schema and private evidence bucket
- `SUPABASE_SETUP.md` — exact one-time setup steps
- `lib/ingestion/` — evidence adapters
- `lib/analytics/` — deterministic calculations
- `db/repositories/` — canonical persistence/reconciliation
- `tests/core/` — parser, analytics, reconciliation, migration, and vertical-slice regressions

## StackBlitz compatibility

This project intentionally runs Next.js with Webpack in development and production builds (`next dev --webpack` and `next build --webpack`). StackBlitz WebContainers load Next.js through WASM bindings, where Turbopack is unavailable.

A small root `vite.config.ts` compatibility tombstone is included only to overwrite any stale ChatGPT Sites/Vite configuration left in an older checkout. The application does not use Vite.

Use `npm run verify` for the full local gate: core tests, TypeScript typecheck, then production build.
