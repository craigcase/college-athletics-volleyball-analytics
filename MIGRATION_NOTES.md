# Migration Notes — Sites/Cloudflare → Netlify/Supabase

## Baseline

This migration started from ChatGPT Sites saved version 3 / source commit `c175c5daae18dc74958de9102a509137abac795e` and preserves the existing volleyball application logic, UI, parsers, deterministic analytics, canonical identities, evidence lineage, and reconciliation rules.

## Removed runtime dependencies

The migrated runtime no longer uses:

- `@openai/sites-vite-plugin`
- `.openai/hosting.json`
- Vinext
- `@cloudflare/vite-plugin`
- `cloudflare:workers`
- Wrangler
- D1 `DB` binding
- R2 `FILES` binding
- ChatGPT Sites authentication headers

The old D1 migration is retained only for audit/reference in `docs/legacy/d1-0000_initial.sql`.

## Replacement map

| Former Sites runtime | Portable runtime |
| --- | --- |
| Vinext / Sites / Cloudflare Worker | Standard Next.js App Router |
| D1 | Supabase Postgres |
| R2 | Private Supabase Storage bucket `volleyball-evidence` |
| Sites injected ChatGPT identity | Supabase Auth cookie session |
| Cloudflare Vite plugin / Wrangler | Next.js dev/build + Netlify OpenNext |

## Preserved application contracts

- A source is evidence, not canonical truth.
- A roster, schedule, public box score, official XML, and VolleyMetrics evidence retain source lineage.
- Re-imports de-duplicate exact source bytes by `program_id + content_hash`.
- Multiple sources can enrich one canonical match.
- Staff canonical overrides remain protected during import/recalculation.
- Deterministic code calculates metrics before Coach's Edge sees them.
- Missing evidence is not fabricated.
- Richer evidence expands capabilities rather than replacing a basic match.

## Schedule parser hardening

The Sidearm schedule adapter supports nested schedule markup and visible month/day dates. The canonical season year is passed by the schedule import route and takes precedence over page/runtime inference.

## Database/data migration

The old live Sites D1 rows and R2 objects were not included in the Sites source export. They were development evidence and can be regenerated from public roster/schedule/match sources during testing. If historical Sites-only data later becomes important, it would need a separate D1/R2 export.

## Verification boundary

The repository includes deterministic/core migration tests that do not require a live Supabase project. The final persistence/auth integration test necessarily occurs against the Supabase project after its migration and environment variables are configured.
