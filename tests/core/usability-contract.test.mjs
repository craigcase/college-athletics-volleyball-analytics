import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('primary navigation always exposes roster, schedule, and matches', async () => {
  const shell=await readFile(new URL('../../components/app-shell.tsx',import.meta.url),'utf8');
  assert.match(shell,/\['Roster','\/roster',true\]/);
  assert.match(shell,/\['Schedule','\/schedule',true\]/);
  assert.match(shell,/\['Matches','\/matches',true\]/);
});

test('match cards provide direct, explicit summary navigation', async () => {
  const page=await readFile(new URL('../../app/matches/page.tsx',import.meta.url),'utf8');
  assert.match(page,/<a className="match-row" href=\{`\/matches\/\$\{m\.id\}`\}/);
  assert.match(page,/View Summary/);
});

test('an existing roster clearly offers a refresh rather than destructive replacement', async () => {
  const page=await readFile(new URL('../../app/roster/page.tsx',import.meta.url),'utf8');
  assert.match(page,/buttonLabel=\{roster\.length\?'Refresh Roster':'Import Roster'\}/);
  assert.match(page,/Updates existing players without deleting identities, photos, or staff corrections\./);
});
