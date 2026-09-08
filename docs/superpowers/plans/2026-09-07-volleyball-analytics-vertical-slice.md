# Volleyball Analytics Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real Sites-native V1 vertical slice from Program Setup through roster, schedule, match-data ingestion, canonical storage, deterministic analytics, Match Summary, and a basic Coach's Edge query experience.

**Architecture:** Use the official OpenAI Sites Vinext starter as a modular monolith with Sites-managed D1 for canonical relational data and searchable source metadata, R2 for original evidence files/source snapshots, and server-side ChatGPT identity headers for authorization. Imported evidence is never written directly as analytics: adapters emit source observations, reconciliation selects canonical facts, versioned pure analytics calculate results, and Coach's Edge only interprets structured results returned by the deterministic query service.

**Tech Stack:** Node.js >=22.13, TypeScript, Vinext/Vite, React server/client components, OpenAI Sites Vite plugin, D1, R2, Drizzle ORM, shadcn/ui, Vitest, Testing Library.

**Spec:** `College_Athletics_Consulting_Volleyball_V1_Design_Spec_2026-09-07.md`

## Global Constraints

- Product principles are **FAST. EASY. EFFICIENT.**
- Sources are evidence, not truth; canonical database values are the program working truth.
- The language model must not calculate or invent statistics.
- Missing evidence remains missing; unsupported capabilities must not render fake detail.
- A public box score, official XML, and VolleyMetrics evidence for the same contest enrich one canonical match rather than creating duplicates.
- Staff correction outranks imported source conflicts and remains sticky across re-imports.
- Raw source evidence and provenance must remain preserved underneath canonical values.
- Initial slice is limited to Program Setup → Roster → Schedule → Matches → match-data upload/ingestion → canonical match storage → deterministic match analytics → Match Summary → basic Coach's Edge.
- Use Sites-native D1/R2/auth/hosting; no Firebase, Supabase, GitHub, Vercel, or other external infrastructure.
- Do not implement background schedule polling in this slice; expose an explicit Refresh Schedule action.
- Keep the Site private/owner-only during implementation; save a reviewable version before any production audience expansion.

---

## File Structure

```text
.openai/hosting.json                 Sites D1/R2 binding declaration
app/
  layout.tsx                         Application shell
  page.tsx                           Redirect/landing based on setup state
  globals.css                        Global design tokens
  setup/page.tsx                     Program Setup workflow
  roster/page.tsx                    Roster review and refresh
  schedule/page.tsx                  Schedule review and refresh
  matches/page.tsx                   Season match list + Add Match Data
  matches/[matchId]/page.tsx         Match Summary
  coaches-edge/page.tsx              Basic structured Coach's Edge UI
  api/program/route.ts               Program setup endpoint
  api/roster/import/route.ts         Roster URL ingestion endpoint
  api/schedule/import/route.ts       Schedule URL ingestion endpoint
  api/matches/import-url/route.ts    Public match URL ingestion endpoint
  api/matches/import-file/route.ts   File upload ingestion endpoint
  api/coaches-edge/query/route.ts    Deterministic query endpoint
components/
  app-shell.tsx                      Persistent navigation/season context
  program-setup-form.tsx             Setup form
  roster-table.tsx                   Roster review table
  schedule-table.tsx                 Schedule review table
  match-import-drawer.tsx            URL/file upload UI
  match-summary.tsx                  Match analysis presentation
  coaches-edge-input.tsx             Question input and answer card
db/
  schema.ts                          Canonical D1 schema
  client.ts                          Single D1/Drizzle access boundary
  repositories/                      Focused persistence interfaces
    programs.ts
    roster.ts
    schedule.ts
    matches.ts
    sources.ts
    analytics.ts
  migrations/                        Generated schema migrations
lib/
  auth/current-user.ts               Sites identity header parsing
  ids.ts                             Stable ID/UUID helpers
  ingestion/types.ts                 Adapter contracts and EvidenceEnvelope
  ingestion/source-family.ts         Source detection + lineage helpers
  ingestion/fetch-source.ts          Safe server-side URL fetch helper
  ingestion/roster/sidearm.ts        Official roster page parser
  ingestion/schedule/sidearm.ts      Official schedule page parser
  ingestion/match/public-boxscore.ts Public box-score parser
  ingestion/match/xml.ts             Conservative NCAA/official XML detector/parser
  ingestion/match/resolve-match.ts   Canonical match matching score
  ingestion/reconcile.ts             Field-level canonical reconciliation
  capabilities/detect.ts             Capability calculation from evidence
  analytics/types.ts                 Versioned deterministic metric types
  analytics/hitting.ts               Hitting calculations
  analytics/contribution.ts          Locked Contribution model
  analytics/match.ts                 Match metric orchestration
  analytics/findings.ts              Deterministic impact finding ranker
  coaches-edge/types.ts              Structured query types
  coaches-edge/resolve.ts             Basic text → structured query parser
  coaches-edge/execute.ts             Structured query → stored metric answer
  validation/url.ts                  Allowed URL validation and SSRF defense
  validation/upload.ts               Upload type/size validation
tests/
  fixtures/                          Sanitized HTML/XML fixture evidence
  db/schema.test.ts
  ingestion/roster-sidearm.test.ts
  ingestion/schedule-sidearm.test.ts
  ingestion/match-public-boxscore.test.ts
  ingestion/match-resolver.test.ts
  ingestion/reconcile.test.ts
  capabilities/detect.test.ts
  analytics/hitting.test.ts
  analytics/contribution.test.ts
  analytics/match.test.ts
  analytics/findings.test.ts
  coaches-edge/resolve.test.ts
  coaches-edge/execute.test.ts
  e2e/vertical-slice.test.ts
```

---

### Task 1: Create the official Sites project and local verification harness

**Files:**
- Create: official Sites starter output in repository root
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: official `@openai/create-sites` generator.
- Produces: a buildable Sites project with logical bindings `DB` and `BUCKET`, ChatGPT auth helpers, shadcn/ui, and `npm test`, `npm run typecheck`, `npm run build` commands.

- [ ] **Step 1: Scaffold the first-party Sites starter**

Run:

```bash
npx --yes @openai/create-sites@latest . --yes --add-ons d1,r2,auth,shadcn --install
```

Expected: `.openai/hosting.json`, `app/`, `db/schema.ts`, worker-compatible Vite config, and dependencies are created without a `project_id`.

- [ ] **Step 2: Add a failing smoke test**

Create `tests/setup.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("Sites project", () => {
  it("runs the test harness", () => {
    expect(true).toBe(true);
  });
});
```

Run: `npm test -- --run tests/setup.test.ts`
Expected: FAIL because the test script/Vitest configuration does not yet exist.

- [ ] **Step 3: Add Vitest scripts and configuration**

Add scripts:

```json
{
  "test": "vitest",
  "typecheck": "tsc --noEmit"
}
```

Create `vitest.config.ts` using Node environment and `tests/setup.ts`.

- [ ] **Step 4: Verify the starter**

Run:

```bash
npm test -- --run tests/setup.test.ts
npm run typecheck
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "chore: scaffold Sites volleyball analytics app"
```

---

### Task 2: Create the canonical D1 schema and server authorization boundary

**Files:**
- Modify: `db/schema.ts`
- Create: `db/client.ts`
- Create: `lib/auth/current-user.ts`
- Create: `tests/db/schema.test.ts`
- Generate: `drizzle/*` migration files

**Interfaces:**
- Produces: `getDb()`, `getCurrentUser(headers)`, and D1 tables for programs, seasons, memberships, teams, aliases, team seasons, players, player aliases, player seasons, matches, match sets, source lineages, source artifacts, match-source links, evidence observations, canonical overrides, reconciliation issues, capabilities, team/player canonical totals, metric results, findings, and activity events.

- [ ] **Step 1: Write schema-contract tests**

Test required table exports and critical uniqueness constraints, including:

```ts
expect(schema.programs).toBeDefined();
expect(schema.players).toBeDefined();
expect(schema.playerSeasons).toBeDefined();
expect(schema.matches).toBeDefined();
expect(schema.sourceArtifacts).toBeDefined();
expect(schema.matchMetricResults).toBeDefined();
```

Run: `npm test -- --run tests/db/schema.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement normalized schema**

Use text UUID primary keys, ISO timestamps, explicit `programId`/`seasonId` tenant columns, and foreign keys. Store canonical source-neutral names separately from aliases. Add a unique source hash on `source_artifacts` per program and a unique external/source key when available.

- [ ] **Step 3: Implement server-only current-user parsing**

`getCurrentUser()` must read `oai-authenticated-user-email`; optional full name is percent-decoded only when the accompanying encoding header says percent-encoded UTF-8. Authorization must fail closed when the email header is absent for protected routes.

- [ ] **Step 4: Generate migration and verify**

Run:

```bash
npm run db:generate
npm test -- --run tests/db/schema.test.ts
npm run typecheck
```

Expected: PASS and migration SQL exists.

- [ ] **Step 5: Commit**

```bash
git add db lib/auth drizzle tests/db
 git commit -m "feat: add canonical program and evidence schema"
```

---

### Task 3: Implement Program Setup and persisted program context

**Files:**
- Create: `db/repositories/programs.ts`
- Create: `app/api/program/route.ts`
- Create: `components/program-setup-form.tsx`
- Create: `app/setup/page.tsx`
- Modify: `app/page.tsx`
- Create: `tests/program-setup.test.ts`

**Interfaces:**
- Produces: `createProgram(input, user)`, `getActiveProgramForUser(email)`, and `POST /api/program`.

- [ ] **Step 1: Write failing repository tests**

Cover creation of a program, initial season, and Owner membership in one transaction. Validate school abbreviation, mascot/team name, and primary/secondary/accent colors.

- [ ] **Step 2: Implement repository transaction**

`createProgram()` creates exactly one `program`, one current `season`, and one Owner membership tied to the authenticated email.

- [ ] **Step 3: Add protected API route**

Reject unauthenticated requests, malformed color values, blank abbreviation/name, and duplicate setup for an already-owned active program.

- [ ] **Step 4: Build the short setup UI**

Create a single fast Program Identity form. On success, route to `/roster` with the program/season persisted in D1.

- [ ] **Step 5: Verify**

Run targeted tests, typecheck, and build.

- [ ] **Step 6: Commit**

```bash
git add app components db tests
 git commit -m "feat: add persisted program setup"
```

---

### Task 4: Implement roster URL ingestion and player identity persistence

**Files:**
- Create: `lib/ingestion/types.ts`
- Create: `lib/ingestion/fetch-source.ts`
- Create: `lib/validation/url.ts`
- Create: `lib/ingestion/roster/sidearm.ts`
- Create: `db/repositories/roster.ts`
- Create: `app/api/roster/import/route.ts`
- Create: `app/roster/page.tsx`
- Create: `components/roster-table.tsx`
- Create: `tests/ingestion/roster-sidearm.test.ts`

**Interfaces:**
- Produces: `RosterEvidence`, `parseRosterHtml(html, sourceUrl)`, `importRoster(programId, seasonId, sourceUrl)`.
- `RosterEvidence` fields are optional except source name: name, number, officialPosition, classYear, height, hometown, previousSchool, profileUrl, imageUrl, sourcePlayerId.

- [ ] **Step 1: Add fixture and failing parser tests**

Cover a Sidearm-style roster page with player name/number/position/class/profile URL and missing optional image/hometown values.

- [ ] **Step 2: Add SSRF-safe URL validation**

Allow only `http:`/`https:` URLs; reject localhost, loopback, private/link-local IP literals, embedded credentials, nonstandard protocols, and redirects to forbidden destinations.

- [ ] **Step 3: Implement conservative roster parser**

Parse only source-supported values. Never infer class progression, position, or player identity from absent data.

- [ ] **Step 4: Persist canonical Player + PlayerSeason records**

Use normalized name plus corroborating roster history/source identifiers for high-confidence returning-player links; ambiguous matches create a `reconciliation_issue` instead of silently merging.

- [ ] **Step 5: Build roster review UI and Refresh Roster action**

Show canonical roster fields, source URL, and graceful blank states without exposing raw evidence plumbing.

- [ ] **Step 6: Verify and commit**

Run parser/repository tests, typecheck, build, then commit.

---

### Task 5: Implement schedule ingestion as the canonical season spine

**Files:**
- Create: `lib/ingestion/schedule/sidearm.ts`
- Create: `db/repositories/schedule.ts`
- Create: `app/api/schedule/import/route.ts`
- Create: `app/schedule/page.tsx`
- Create: `components/schedule-table.tsx`
- Create: `tests/ingestion/schedule-sidearm.test.ts`

**Interfaces:**
- Produces: `ScheduleEvidence`, `parseScheduleHtml(html, sourceUrl)`, `importSchedule(programId, seasonId, sourceUrl)`.
- Schedule rows preserve date/time, opponent text, home/away/neutral/unknown, location, status/result, set scores and supported links.

- [ ] **Step 1: Add fixture and failing parser tests**

Cover two matches on one date, a neutral match, an incomplete future match, result/set-score parsing, and an unknown competition designation.

- [ ] **Step 2: Implement team identity reconciliation**

Normalize aliases without using display spelling as permanent identity. Persist source aliases and link to one canonical Team/TeamSeason when confidence is high.

- [ ] **Step 3: Implement schedule upsert/review behavior**

New and changed schedule observations produce a reviewable change summary rather than silently rewriting completed canonical history.

- [ ] **Step 4: Build schedule UI**

Keep the interaction to URL import/refresh + concise changes. On completion route to `/matches`.

- [ ] **Step 5: Verify and commit**

Run tests, typecheck, build, then commit.

---

### Task 6: Implement match evidence ingestion, raw R2 preservation, and canonical match resolution

**Files:**
- Create: `lib/ingestion/source-family.ts`
- Create: `lib/ingestion/match/public-boxscore.ts`
- Create: `lib/ingestion/match/xml.ts`
- Create: `lib/ingestion/match/resolve-match.ts`
- Create: `lib/ingestion/reconcile.ts`
- Create: `lib/validation/upload.ts`
- Create: `db/repositories/sources.ts`
- Create: `db/repositories/matches.ts`
- Create: `app/api/matches/import-url/route.ts`
- Create: `app/api/matches/import-file/route.ts`
- Create: `components/match-import-drawer.tsx`
- Create: resolver/reconciliation/parser tests

**Interfaces:**
- Produces: `EvidenceEnvelope`, `detectSourceFamily`, `resolveCanonicalMatch`, `reconcileEvidence`, URL/file import APIs.
- Every source artifact has SHA-256 content hash, source family, lineage key, fetched/uploaded timestamp, R2 object key, parser version, and attached canonical match if resolved.

- [ ] **Step 1: Write failing source-detection and duplicate tests**

The same bytes imported twice must reuse/reject the duplicate source artifact rather than duplicate evidence.

- [ ] **Step 2: Store original evidence in R2 before parsing**

For URL imports, preserve fetched bytes/snapshot. For file uploads, preserve the uploaded bytes. D1 stores metadata and object key only.

- [ ] **Step 3: Implement conservative public box-score parser**

Extract match/set result, team totals, and player box-score totals only where directly present. Preserve source field/value provenance for each observation.

- [ ] **Step 4: Implement XML detector and conservative structured parser**

Identify XML source family and parse only known, schema-supported fields. Unknown XML remains preserved as source evidence with unsupported capabilities rather than being guessed.

- [ ] **Step 5: Implement canonical match resolver**

Score candidate schedule matches using teams, date/time, source IDs, home/away/neutral, set result and opponent. High-confidence results attach automatically; close/tied candidates create a `reconciliation_issue`.

- [ ] **Step 6: Implement field-level reconciliation**

Staff override wins. Otherwise use source confidence by field/data type, then independent-lineage agreement as a tiebreaker. Preserve every conflicting source observation.

- [ ] **Step 7: Build Matches import UI**

Support `+ Add Match Data`, URL paste, file input, multi-file upload, and whole-page drag target. Return a concise processed/enriched/conflict summary.

- [ ] **Step 8: Verify and commit**

Run all ingestion tests, typecheck, build, then commit.

---

### Task 7: Implement capability detection and deterministic match analytics

**Files:**
- Create: `lib/capabilities/detect.ts`
- Create: `lib/analytics/types.ts`
- Create: `lib/analytics/hitting.ts`
- Create: `lib/analytics/contribution.ts`
- Create: `lib/analytics/match.ts`
- Create: `lib/analytics/findings.ts`
- Create: `db/repositories/analytics.ts`
- Create: capability/analytics tests

**Interfaces:**
- Produces: `detectCapabilities(evidence)`, `calculateHittingPercentage`, `calculateContribution`, `calculateMatchAnalytics`, `rankMatchFindings`.
- Stored metric result includes metric code, numerator where meaningful, denominator/opportunities where meaningful, value, engine version, and canonical match revision.

- [ ] **Step 1: Write locked-definition tests first**

Examples:

```ts
expect(calculateHittingPercentage({ kills: 12, errors: 4, attempts: 32 })).toBe(0.25);
expect(calculateHittingPercentage({ kills: 0, errors: 0, attempts: 0 })).toBeNull();
```

Contribution tests must encode the spec's locked weights exactly: assisted kill hitter +0.70/setter +0.30, unassisted kill +1, attack error -1, ace +1, service error -1, solo block +1, block assist +0.50, setting/reception/BHE/direct-point blocking errors -1, fallback dig +0.19, fallback pass +0.27.

- [ ] **Step 2: Implement pure deterministic functions**

No language-model calls or prompt parsing may exist in analytics modules.

- [ ] **Step 3: Implement capability-driven metric orchestration**

Only calculate metrics whose required evidence capability is present. Unsupported metrics return absent/not-supported status, never zero.

- [ ] **Step 4: Implement deterministic Match Impact ranking**

Rank only supported findings by magnitude, sample/opportunities, reliability, and match relevance. Do not fill five slots when fewer findings clear the threshold.

- [ ] **Step 5: Persist versioned results and invalidate on canonical revision change**

A source enrichment or staff correction increments match revision; analytics for stale revisions are recalculated.

- [ ] **Step 6: Verify and commit**

Run all analytics tests plus typecheck/build, then commit.

---

### Task 8: Build Matches season spine and real Match Summary

**Files:**
- Create/Modify: `app/matches/page.tsx`
- Create: `app/matches/[matchId]/page.tsx`
- Create: `components/match-summary.tsx`
- Modify: `app/layout.tsx`
- Create: `components/app-shell.tsx`
- Create: UI tests

**Interfaces:**
- Consumes: canonical matches, capabilities, metric results, findings.
- Produces: persistent Matches-first coach landing screen and Match Summary UI.

- [ ] **Step 1: Write rendering tests**

Verify Basic/Standard/Rich/No Data Yet status, only-supported stat ribbon cells, fewer-than-five Match Impact findings, and set tabs only when set-level evidence exists.

- [ ] **Step 2: Implement persistent app shell**

Primary navigation appears in locked order: Matches, Rotations, Players, Probability, Scouting, Coach's Edge. Only Matches and Coach's Edge are active in this slice; future modules show restrained coming-later states rather than fake data.

- [ ] **Step 3: Implement Matches list**

Default authenticated staff landing page is Matches, scoped to active season.

- [ ] **Step 4: Implement Match Summary hierarchy**

Header → supported stat ribbon → Our Match Impact → Opponent Match Impact → supported Set Drilldown → tucked-away Data Details.

- [ ] **Step 5: Verify responsive behavior**

Check desktop and ~390px mobile widths; no analytics differences, only presentation changes.

- [ ] **Step 6: Commit**

Run tests/typecheck/build then commit.

---

### Task 9: Implement basic Coach's Edge over stored analytics

**Files:**
- Create: `lib/coaches-edge/types.ts`
- Create: `lib/coaches-edge/resolve.ts`
- Create: `lib/coaches-edge/execute.ts`
- Create: `app/api/coaches-edge/query/route.ts`
- Create: `app/coaches-edge/page.tsx`
- Create: `components/coaches-edge-input.tsx`
- Create: resolver/executor tests

**Interfaces:**
- Produces: `StructuredAnalyticsQuery`, `resolveCoachQuestion(text, context)`, `executeAnalyticsQuery(query)`.
- Basic supported intents: match summary, team-vs-opponent metric comparison, player match stat lookup, and evidence-availability question.

- [ ] **Step 1: Write text-to-structured-query tests**

Examples:

```ts
expect(resolveCoachQuestion("How did we hit against Mayville?", ctx)).toEqual({
  intent: "compare_metric",
  scope: { matchId: "match-1" },
  metric: "hitting_percentage",
  subjects: ["our_team", "opponent"]
});
```

Also test unsupported/ambiguous questions returning a safe clarification/unsupported result rather than a fabricated metric.

- [ ] **Step 2: Implement deterministic resolver for first vocabulary**

Use aliases, canonical team/player IDs and explicit metric synonyms. Do not call an LLM in the first resolver implementation.

- [ ] **Step 3: Implement query executor**

Read only stored canonical metric results and evidence/provenance. Never calculate arithmetic inside the explanation layer.

- [ ] **Step 4: Build concise Coach's Edge UI**

Default shape: Answer → Evidence → Confidence → Explore Deeper. Always show analytical scope.

- [ ] **Step 5: Verify**

Tests must prove that an answer cannot contain a numeric statistic absent from the executor's evidence package.

- [ ] **Step 6: Commit**

Run tests/typecheck/build then commit.

---

### Task 10: End-to-end vertical-slice regression and Sites deployment candidate

**Files:**
- Create: `tests/e2e/vertical-slice.test.ts`
- Modify: `README.md`
- Verify: `.openai/hosting.json`
- Verify: generated Drizzle migrations

**Interfaces:**
- Consumes every previous task.
- Produces a Sites-compatible, owner-only, reviewable build candidate.

- [ ] **Step 1: Add an end-to-end fixture scenario**

The test must perform:

1. create program/season;
2. ingest roster fixture;
3. ingest schedule fixture;
4. ingest public box-score fixture;
5. attach evidence to existing canonical match;
6. re-import same evidence and prove no duplicate match/source fact set;
7. calculate deterministic analytics;
8. render/read Match Summary data;
9. ask a Coach's Edge question and prove the returned number equals the persisted metric result.

- [ ] **Step 2: Add progressive-enrichment regression**

Import a second source for the same match and prove it enriches `match-1` rather than creating `match-2`, expands capabilities when supported, preserves both source artifacts, and increments canonical match revision.

- [ ] **Step 3: Add correction-stickiness regression**

Apply a staff override, re-import the conflicting source, and prove the override remains canonical while original observations remain stored.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Inspect deployment artifact**

Confirm the build includes `.openai/hosting.json`, D1 migration metadata, worker/server artifact, and client assets. Confirm no secret values or personal test data are committed.

- [ ] **Step 6: Save a Sites version without broad deployment**

Use Sites to provision project-bound D1/R2 resources and save a version. Keep owner/workspace-admin-only access until the user reviews the live candidate.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete volleyball analytics vertical slice"
```

---

## Self-Review

- **Spec coverage:** This plan intentionally covers only the approved architectural vertical slice. Rotations, Probability, full Player Analysis, Scouting, Team View, voice, PDF export, notifications, and longitudinal intelligence remain outside this implementation plan but the schema/capability/auth boundaries avoid blocking them.
- **Known analytics gate:** SOS2/EPO are not required for the Basic box-score vertical slice; their locked definitions remain untouched and must receive separate regression fixtures before sequence-level analytics are enabled.
- **Source quality:** Unknown XML/HTML is preserved but never guessed. Capability rendering degrades honestly.
- **Authorization:** identity is supplied by Sites; application role/data authorization is server-side and program-scoped.
- **Deployment:** save a reviewable Sites version before expanding access because every deployed Sites URL is production.
