import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const text = async path => readFile(new URL(path, import.meta.url), 'utf8');

test('runtime is standard Next.js + Supabase and no longer depends on Sites/Cloudflare', async () => {
  const pkg = JSON.parse(await text('../../package.json'));
  const all = {...pkg.dependencies, ...pkg.devDependencies};
  assert.equal(typeof all.next, 'string');
  assert.equal(typeof all['@supabase/supabase-js'], 'string');
  assert.equal(typeof all['@supabase/ssr'], 'string');
  for (const removed of ['vinext','@openai/sites-vite-plugin','@cloudflare/vite-plugin','@cloudflare/workers-types','wrangler']) {
    assert.equal(all[removed], undefined, `${removed} should be removed`);
  }
  assert.equal(pkg.scripts.dev, 'next dev');
  assert.equal(pkg.scripts.build, 'next build');
  assert.equal(pkg.scripts.start, 'next start');
});

test('Netlify and Supabase migration artifacts exist', async () => {
  await access(new URL('../../netlify.toml', import.meta.url));
  const sql = await text('../../supabase/migrations/202609090001_initial.sql');
  assert.match(sql, /create table if not exists programs/i);
  assert.match(sql, /insert into storage\.buckets/i);
  assert.match(sql, /volleyball-evidence/i);
});

test('source tree has no production Cloudflare/Sites imports', async () => {
  const candidates = [
    '../../db/client.ts','../../db/repositories/sources.ts','../../lib/auth/server-current-user.ts',
    '../../app/api/roster/import/route.ts','../../app/api/schedule/import/route.ts'
  ];
  for (const path of candidates) {
    const source = await text(path);
    assert.doesNotMatch(source, /cloudflare:workers|oai-authenticated-user|@openai\/sites-vite-plugin|R2Bucket|D1Database/);
  }
});
