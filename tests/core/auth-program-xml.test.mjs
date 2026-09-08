import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentUserFromHeaders } from '../../.core-dist/lib/auth/current-user.js';
import { validateProgramSetup } from '../../.core-dist/lib/program/validation.js';
import { parseStructuredXml } from '../../.core-dist/lib/ingestion/match/xml.js';

test('ChatGPT auth parser fails closed without identity and decodes percent-encoded names only when declared', () => {
  assert.equal(getCurrentUserFromHeaders(new Headers()), null);
  const headers = new Headers({
    'oai-authenticated-user-id': 'user-1',
    'oai-authenticated-user-email': 'coach@example.edu',
    'oai-authenticated-user-name': 'Pat%20Coach',
    'oai-authenticated-user-name-encoding': 'percent-encoded-utf-8'
  });
  assert.deepEqual(getCurrentUserFromHeaders(headers), { id:'user-1', email:'coach@example.edu', name:'Pat Coach' });
});

test('program setup validation accepts required identity and rejects bad colors or blank names', () => {
  assert.equal(validateProgramSetup({ schoolAbbreviation:'VCSU', teamName:'VIKINGS', primaryColor:'#123456', secondaryColor:'#ffffff', accentColor:'#ABCDEF', seasonYear:2026 }).ok, true);
  assert.equal(validateProgramSetup({ schoolAbbreviation:'', teamName:'VIKINGS', primaryColor:'#123456', secondaryColor:'#fff', accentColor:'#ABCDEF', seasonYear:2026 }).ok, false);
});

test('structured XML parser extracts only explicit supported totals and rally context', () => {
  const xml = `<?xml version="1.0"?><match date="2026-09-05" opponent="Mayville State" homeAway="away"><team side="us" kills="40" errors="16" attempts="100"/><team side="opponent" kills="35" errors="20" attempts="103"/><rally index="1" servingTeam="us" scoreAfter="1-0" rotation="R1"/></match>`;
  const parsed = parseStructuredXml(xml, 'official_xml', 'upload://match.xml');
  assert.equal(parsed.match.opponentName, 'Mayville State');
  assert.equal(parsed.observations.some(x => x.entityType === 'team' && x.entityKey === 'us' && x.field === 'kills' && x.value === 40), true);
  assert.equal(parsed.observations.some(x => x.entityType === 'rally' && x.field === 'rotation' && x.value === 'R1'), true);
});

test('unknown XML shape remains valid evidence with no invented observations', () => {
  const parsed = parseStructuredXml('<mystery><foo bar="1"/></mystery>', 'official_xml', 'upload://mystery.xml');
  assert.deepEqual(parsed.observations, []);
});
