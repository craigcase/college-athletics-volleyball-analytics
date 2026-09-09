import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Execute the real routes and repositories; substitute only the Worker bindings
// and external HTTP source. SQL runs against the actual migration in SQLite.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url:'test:bindings', shortCircuit:true };
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL);
      for (const candidate of [url.href + '.ts', url.href.replace(/\.js$/, '.ts')]) {
        if (existsSync(fileURLToPath(candidate))) return {url:candidate, shortCircuit:true};
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'test:bindings') return {format:'module', source:'export const env = globalThis.__persistenceBindings;', shortCircuit:true};
    if (url.endsWith('.ts')) return {format:'module', source:stripTypeScriptTypes(readFileSync(new URL(url),'utf8')), shortCircuit:true};
    return next(url, context);
  },
});

const env = globalThis.__persistenceBindings = {};
const { POST: rosterImport } = await import('../../app/api/roster/import/route.ts');
const { POST: scheduleImport } = await import('../../app/api/schedule/import/route.ts');
const { listRoster } = await import('../../db/repositories/roster.ts');
const { listMatches } = await import('../../db/repositories/schedule.ts');

function setup() {
  const path=join(mkdtempSync(join(tmpdir(),'volleyball-persistence-')), 'test.sqlite');
  let sql=new DatabaseSync(path);
  sql.exec(readFileSync(new URL('../../drizzle/0000_initial.sql',import.meta.url),'utf8'));
  sql.exec(`INSERT INTO teams VALUES('team','VCSU','now');
    INSERT INTO programs(id,team_id,school_abbreviation,team_name,primary_color,secondary_color,accent_color,created_at) VALUES('program','team','VCSU','Vikings','#000','#fff','#aaa','now');
    INSERT INTO seasons(id,program_id,label,year,is_current,created_at) VALUES('season','program','2026',2026,1,'now');
    INSERT INTO program_memberships(id,program_id,user_email,role,created_at) VALUES('member','program','test@example.com','owner','now');`);
  const blobs=new Map();
  const db={prepare(query) { let params=[]; return {
    bind(...values) {params=values;return this;},
    async first() {return sql.prepare(query).get(...params)??null;},
    async all() {return {results:sql.prepare(query).all(...params)};},
    async run() {return sql.prepare(query).run(...params);},
  };}, async batch(statements) {sql.exec('BEGIN');try {const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}}};
  env.DB=db; env.FILES={async put(key,bytes){blobs.set(key,Buffer.from(bytes));}};
  return {get sql(){return sql;}, blobs, reload(){sql.close();sql=new DatabaseSync(path);}, close(){sql.close();}};
}
const request=sourceUrl=>new Request('https://site.test/api/import',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':'test@example.com'},body:JSON.stringify({sourceUrl})});
const rosterHtml='<li class="sidearm-roster-player" data-player-id="5452"><div class="sidearm-roster-player-name"><h3><a href="/sports/volleyball/roster/brynn/5452">Brynn Sorenson</a></h3></div><span class="sidearm-roster-player-jersey-number">1</span><span class="sidearm-roster-player-position">OH</span></li>';
const scheduleHtml='<title>2026 Volleyball Schedule</title><li class="sidearm-schedule-game sidearm-schedule-neutral-game" data-game-id="6517"><time datetime="2026-08-21T16:00:00"></time><div class="sidearm-schedule-game-opponent-name">College of Saint Mary (Neb.)</div><div class="sidearm-schedule-game-location">Sioux City, Iowa</div><div class="sidearm-schedule-game-result">L, 1-3</div><a class="sidearm-schedule-game-boxscore" href="/sports/volleyball/stats/2026/boxscore/6517">Box Score</a></li>';

for (const kind of ['roster','schedule']) test(`${kind} route persists source-linked evidence across reload and repeated imports`,async()=>{
  const state=setup(), originalFetch=globalThis.fetch;
  const html=kind==='roster'?rosterHtml:scheduleHtml;
  globalThis.fetch=async()=>new Response(html,{headers:{'content-type':'text/html'}});
  try {
    const route=kind==='roster'?rosterImport:scheduleImport;
    const response=await route(request(`https://vcsuvikings.com/sports/volleyball/${kind}`));
    const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));
    assert.equal(body.summary.total,1);
    const artifact=state.sql.prepare('SELECT * FROM source_artifacts WHERE id=?').get(body.sourceArtifactId);
    assert.ok(artifact);assert.equal(state.blobs.get(artifact.object_key).toString(),html);
    assert.ok(state.sql.prepare('SELECT id FROM source_lineages WHERE id=?').get(artifact.lineage_id));
    const observations=state.sql.prepare('SELECT * FROM evidence_observations WHERE source_artifact_id=?').all(artifact.id);
    assert.ok(observations.length>0,'persisted source must be linked to evidence');
    if(kind==='roster') {
      assert.equal(state.sql.prepare('SELECT count(*) n FROM players').get().n,1);
      assert.equal(state.sql.prepare('SELECT count(*) n FROM player_seasons').get().n,1);
    } else {
      assert.equal(state.sql.prepare('SELECT count(*) n FROM match_source_links').get().n,1);
      assert.equal(JSON.parse(observations.find(o=>o.field_name==='boxScoreUrl').value_json),'https://vcsuvikings.com/sports/volleyball/stats/2026/boxscore/6517');
      assert.equal(state.sql.prepare('SELECT home_away,result FROM matches').get().home_away,'neutral');
    }
    const read=kind==='roster'?listRoster:listMatches;
    const before=await read('program','season');state.reload();assert.deepEqual(await read('program','season'),before);
    const repeated=await (await route(request(`https://vcsuvikings.com/sports/volleyball/${kind}`))).json();
    assert.equal(repeated.sourceArtifactId,body.sourceArtifactId);assert.equal(repeated.duplicateSource,true);
    assert.equal(state.sql.prepare('SELECT count(*) n FROM source_artifacts').get().n,1);
    assert.equal(state.sql.prepare('SELECT count(*) n FROM evidence_observations').get().n,observations.length);
    assert.deepEqual(await read('program','season'),before);
  } finally {globalThis.fetch=originalFetch;state.close();}
});

test('roster refresh preserves staff corrections while retaining incoming evidence',async()=>{
  const state=setup(), originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(rosterHtml);
  try {
    await rosterImport(request('https://vcsuvikings.com/sports/volleyball/roster'));
    const season=state.sql.prepare('SELECT id,player_id FROM player_seasons').get();
    state.sql.prepare('UPDATE players SET canonical_name=? WHERE id=?').run('Staff name',season.player_id);
    state.sql.prepare('UPDATE player_seasons SET official_position=? WHERE id=?').run('S',season.id);
    state.sql.prepare(`INSERT INTO canonical_overrides(id,program_id,entity_type,entity_id,field_name,canonical_value_json,corrected_by_email,corrected_at) VALUES('override','program','player_season',?,'officialPosition','"S"','test@example.com','now')`).run(season.id);
    const response=await rosterImport(request('https://vcsuvikings.com/sports/volleyball/roster'));
    assert.equal(response.status,200);
    const roster=await listRoster('program','season');
    assert.equal(roster[0].name,'Staff name');assert.equal(roster[0].officialPosition,'S');
    assert.equal(JSON.parse(state.sql.prepare("SELECT value_json FROM evidence_observations WHERE field_name='officialPosition'").get().value_json),'OH');
  } finally {globalThis.fetch=originalFetch;state.close();}
});

test('schedule refresh preserves corrected results and still attaches new source evidence',async()=>{
  const state=setup(), originalFetch=globalThis.fetch;
  let html=scheduleHtml;
  globalThis.fetch=async()=>new Response(html);
  try {
    await scheduleImport(request('https://vcsuvikings.com/sports/volleyball/schedule'));
    state.sql.exec("UPDATE matches SET result='W, 3-0'");
    html=scheduleHtml+'<!-- new source snapshot -->';
    const response=await scheduleImport(request('https://vcsuvikings.com/sports/volleyball/schedule'));
    assert.equal(response.status,200);
    assert.equal((await listMatches('program','season'))[0].result,'W, 3-0');
    assert.equal(state.sql.prepare('SELECT count(*) n FROM matches').get().n,1);
    assert.equal(state.sql.prepare('SELECT count(*) n FROM match_source_links').get().n,2);
    assert.equal(state.sql.prepare("SELECT count(*) n FROM evidence_observations WHERE field_name='result' AND value_json='\"L, 1-3\"'").get().n,2);
  } finally {globalThis.fetch=originalFetch;state.close();}
});
