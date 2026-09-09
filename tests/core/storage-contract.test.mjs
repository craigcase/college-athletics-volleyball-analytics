import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('match imports await R2 evidence preservation before parsing or reconciliation', async () => {
  const service = await readFile(new URL('../../lib/services/import-match.ts', import.meta.url), 'utf8');
  const repository = await readFile(new URL('../../db/repositories/sources.ts', import.meta.url), 'utf8');

  const preserve = service.indexOf('await preserveSource(');
  const parse = service.indexOf('parseMatchSource({');
  const reconcile = service.indexOf('await resolveMatchForEvidence(');
  assert.ok(preserve >= 0 && preserve < parse && parse < reconcile);

  const r2Write = repository.indexOf('await getFiles().put(');
  const artifactWrite = repository.indexOf("INSERT INTO source_artifacts");
  assert.ok(r2Write >= 0 && r2Write < artifactWrite);
});

test('an unlinked duplicate match source is parsed again so it can attach after its schedule match exists', async () => {
  const service = await readFile(new URL('../../lib/services/import-match.ts', import.meta.url), 'utf8');
  assert.match(service, /if\s*\(source\.duplicate\s*&&\s*link\?\.matchId\)/);
  assert.doesNotMatch(service, /if\s*\(source\.duplicate\)\s*\{/);
});

test('roster re-import can repair number-as-name corruption without overwriting a staff name', async () => {
  const repository = await readFile(new URL('../../db/repositories/roster.ts', import.meta.url), 'utf8');
  assert.match(repository, /canonical_name\s+GLOB\s+'\[0-9\]\*'/i);
  assert.match(repository, /UPDATE players SET canonical_name=\?/i);
  assert.match(repository, /INSERT OR IGNORE INTO player_aliases/i);
});

test('canonical match totals and deterministic analytics are written to D1 repositories', async () => {
  const matches = await readFile(new URL('../../db/repositories/matches.ts', import.meta.url), 'utf8');
  const analytics = await readFile(new URL('../../db/repositories/analytics.ts', import.meta.url), 'utf8');

  assert.match(matches, /INSERT INTO evidence_observations/i);
  assert.match(matches, /canonical_revision=canonical_revision\+1/i);
  assert.match(analytics, /INSERT OR REPLACE INTO match_team_totals/i);
  assert.match(analytics, /INSERT INTO match_metric_results/i);
  assert.match(analytics, /INSERT INTO match_findings/i);
});
