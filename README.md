# College Athletics Consulting — Volleyball Analytics

Sites-native V1 vertical slice for program setup, roster, schedule, match evidence ingestion, deterministic analytics, Match Summary, and basic Coach's Edge.

## Sites bindings

- D1: `DB`
- R2: `FILES`
- Authentication: Sign in with ChatGPT request headers; authorization enforced server-side.

## Local development

Requires Node.js >=22.13.0. Install dependencies, then run `npm run dev`.

The current sandbox cannot resolve npm registry hosts, so dependency-free deterministic core tests can be run here with the globally available TypeScript compiler.
