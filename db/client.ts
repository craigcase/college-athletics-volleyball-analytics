import { env } from 'cloudflare:workers';

export function getDb(): D1Database {
  if (!env.DB) throw new Error('Sites D1 binding DB is not configured.');
  return env.DB;
}

export function getFiles(): R2Bucket {
  if (!env.FILES) throw new Error('Sites R2 binding FILES is not configured.');
  return env.FILES;
}
