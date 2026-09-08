import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('initial D1 migration contains required canonical, evidence, analytics, and audit tables', async () => {
  const sql = await readFile(new URL('../../drizzle/0000_initial.sql', import.meta.url), 'utf8');
  const required = [
    'programs','seasons','program_memberships','teams','team_aliases','team_seasons',
    'players','player_aliases','player_seasons','matches','match_sets','source_lineages',
    'source_artifacts','match_source_links','evidence_observations','canonical_overrides',
    'reconciliation_issues','match_capabilities','match_team_totals','player_match_totals',
    'match_metric_results','match_findings','activity_events'
  ];
  for (const table of required) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i'), `missing ${table}`);
  }
});

test('schema prevents duplicate source bytes per program and supports one source enriching one match', async () => {
  const sql = await readFile(new URL('../../drizzle/0000_initial.sql', import.meta.url), 'utf8');
  assert.match(sql, /UNIQUE\s*\(program_id,\s*content_hash\)/i);
  assert.match(sql, /UNIQUE\s*\(match_id,\s*source_artifact_id\)/i);
  assert.match(sql, /canonical_revision\s+INTEGER\s+NOT NULL\s+DEFAULT\s+1/i);
});

test('staff override table retains source-neutral field targeting and sticky canonical value', async () => {
  const sql = await readFile(new URL('../../drizzle/0000_initial.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS canonical_overrides/i);
  assert.match(sql, /entity_type\s+TEXT\s+NOT NULL/i);
  assert.match(sql, /field_name\s+TEXT\s+NOT NULL/i);
  assert.match(sql, /canonical_value_json\s+TEXT\s+NOT NULL/i);
  assert.match(sql, /UNIQUE\s*\(program_id,\s*entity_type,\s*entity_id,\s*field_name\)/i);
});
