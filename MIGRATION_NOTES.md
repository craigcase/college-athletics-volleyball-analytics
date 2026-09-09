# Migration Notes

## Export identity

- ChatGPT Site slug: `college-athletics-volleyball-analytics`
- Site project ID: `appgprj_6a9f0acd90c081918ea468c4f80ba592`
- Exported source commit: `c175c5daae18dc74958de9102a509137abac795e`
- Current saved Site version at export: version 3
- Source commit message: `Link roster and schedule imports to persisted evidence`

This archive contains the complete source tree from the current Site repository at the commit above, plus this migration note and the requested `.env.example`. It does not contain the live D1 database contents or R2 objects.

## Current runtime and Sites-specific dependencies

The application currently targets ChatGPT Sites and Cloudflare Workers through Vinext/Vite.

- `@openai/sites-vite-plugin` and the `sites()` Vite plugin in `vite.config.ts` are Sites-specific.
- `.openai/hosting.json` is the Sites project/runtime manifest. It declares the Site project ID and logical storage bindings.
- `vinext` supplies the Next-compatible application/runtime build used by the Site.
- `@cloudflare/vite-plugin`, `wrangler`, `cloudflare:workers`, and Cloudflare Workers type definitions support the Worker runtime and local bindings.
- `vite.config.ts` creates local Miniflare/Wrangler bindings and uses a placeholder local D1 database ID.
- Hosted deployment, versioning, binding provisioning, and access policy are owned by ChatGPT Sites and are not reproduced by Netlify automatically.

## D1 dependency

- Logical binding name: `DB`
- Declared in `.openai/hosting.json`
- Typed in `env.d.ts`
- Accessed through `getDb()` in `db/client.ts`
- Queried with the Cloudflare D1 prepared-statement API throughout `db/repositories/`
- Schema definition: `db/schema.ts`
- SQL migration: `drizzle/0000_initial.sql`
- ORM dependency: `drizzle-orm`

The live D1 database contains persisted application data. At export time, the database had all 23 application tables from the included schema. Confirmed rows existed in at least `source_artifacts` and `matches`, including VCSU roster/schedule evidence and canonical schedule records. The database contents are not part of the Git/source export and therefore require a separate data export.

To retain the data, request/export the Sites D1 database separately before the Site is removed. A practical portable format is either a SQLite/SQL dump preserving schema and rows, or table-by-table JSON/CSV for all tables listed in `drizzle/0000_initial.sql`. The current Sites source-export path provides repository files but does not bundle the live D1 database.

## R2 dependency

- Logical binding name: `FILES`
- Declared in `.openai/hosting.json`
- Typed in `env.d.ts`
- Accessed through `getFiles()` in `db/client.ts`
- Written by `preserveSource()` in `db/repositories/sources.ts`

Original roster, schedule, and match evidence is written to R2 before parsing. D1 `source_artifacts.object_key` values reference those objects. At export time, D1 contained source-artifact records with R2 object keys; because the code inserts those records only after a successful R2 write, the Site has stored source evidence unless objects were removed independently. R2 objects are not included in this source archive and require a separate object export.

To retain the evidence, request/export the Sites R2 bucket separately before the Site is removed, preserving every object key exactly. Keep the exported D1 `source_artifacts.object_key` values and the R2 key paths aligned.

## Authentication and authorization dependency

Sites injects the signed-in ChatGPT identity through request headers. The application reads:

- `oai-authenticated-user-email`
- `oai-authenticated-user-id`
- `oai-authenticated-user-full-name`
- `oai-authenticated-user-full-name-encoding`

The parser is `lib/auth/current-user.ts`. Protected API routes use `lib/auth/program-context.ts`, which combines the authenticated identity with D1 program membership. Netlify will not provide these headers. Replace this boundary with Supabase Auth (or another trusted authentication provider), and ensure identity headers/claims cannot be supplied directly by an untrusted browser request.

## Environment variables and bindings

No hosted environment variables or secrets were configured in Sites at export time.

The required runtime binding names are:

- `DB` — Cloudflare D1 database binding
- `FILES` — Cloudflare R2 bucket binding

They are listed by name only in `.env.example`. They are Cloudflare runtime objects, not ordinary string-valued environment variables. A Netlify/Supabase implementation will need new connection/configuration variables chosen during migration; none exist in the current source.

`vite.config.ts` also reads `CODEX_SANDBOX`, `WRANGLER_WRITE_LOGS`, `WRANGLER_LOG_PATH`, and `MINIFLARE_REGISTRY_PATH` for local tooling behavior. These have defaults or are development-environment controls and are not hosted application secrets.

## Existing commands

Requires Node.js 22.13.0 or newer.

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

Additional existing scripts:

```bash
npm start
npm run lint
npm run format
```

`npm start` currently runs Wrangler against `dist/server/wrangler.json` and therefore remains Cloudflare-specific.

## Netlify + Supabase/Postgres replacement map

The following runtime boundaries require replacement or adaptation:

| Current component | Current dependency | Migration requirement |
| --- | --- | --- |
| `.openai/hosting.json` | Sites project, D1 and R2 provisioning | Replace with Netlify project/build configuration and Supabase/storage configuration. |
| `vite.config.ts` | Sites Vite plugin and Cloudflare Vite plugin | Remove or replace Sites/Cloudflare-only plugins after choosing the Netlify-compatible Vinext/Next deployment adapter. |
| `db/client.ts` | `cloudflare:workers`, `env.DB`, `env.FILES` | Replace with a server-only Postgres client and Supabase Storage client (or equivalent). |
| `db/repositories/*.ts` | D1 prepared statements and SQLite SQL | Port queries to Postgres/Supabase, preserving parameterization, transactions, idempotency, and program scoping. |
| `db/schema.ts` | D1/SQLite schema assumptions | Translate schema types, defaults, indexes, and constraints to Postgres. |
| `drizzle/0000_initial.sql` | SQLite/D1 migration syntax | Create a Postgres migration; do not apply this SQLite file directly to Postgres. |
| `db/repositories/sources.ts` | R2 `put()` and R2 object metadata | Replace with Supabase Storage upload/download logic while preserving content hashes and exact lineage/object references. |
| `env.d.ts` | Cloudflare binding types | Replace with the environment/configuration types used by Netlify and Supabase. |
| `lib/auth/current-user.ts` | Sites-injected ChatGPT headers | Replace with verified Supabase session/JWT identity extraction. |
| `lib/auth/program-context.ts` | Sites identity plus D1 lookup | Retain the program-membership authorization rule, backed by verified Supabase identity and Postgres. |
| API routes and server-rendered pages | Cloudflare Worker-compatible server runtime | Confirm the selected Netlify adapter supports the current route handlers, React server components, and Node/runtime APIs. |
| `package.json` `start` script | Wrangler | Replace with the chosen Netlify/local production command after migration. |

## Functionality that will not operate outside Sites without modification

- Any route or page that calls `getDb()` or `getFiles()` will fail without Cloudflare D1/R2 bindings.
- Sign-in and all protected program-scoped operations will fail without trusted Sites identity headers.
- Roster, schedule, and match imports cannot persist evidence without replacement database and object storage clients.
- Match Summary, Coach's Edge, roster, schedule, program setup, and match lists depend on the D1 repository layer and therefore need the Postgres port.
- The current production build/deployment configuration targets Sites/Cloudflare rather than Netlify.
- The live D1 rows and R2 evidence objects are not recreated by installing or building this repository.

## Source preserved in this archive

The repository includes the current frontend pages/components, API routes, roster/schedule/match adapters, canonical identity and reconciliation logic, evidence/source-lineage persistence, deterministic analytics, Match Summary, Coach's Edge structured-query code, D1 schema and migration, R2 storage code, authentication/authorization code, test suite, regression fixtures embedded in tests, package manifest and lockfile, TypeScript/Vite/Vinext/Sites configuration, design specification, and implementation plan.

No build, test, typecheck, preview, deployment, refactor, or code repair was performed as part of this export.
