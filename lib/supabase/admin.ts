import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { evidenceBucketName } from './config';

let adminClient: SupabaseClient | undefined;

export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secretKey) throw new Error('SUPABASE_ADMIN_NOT_CONFIGURED');
  adminClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  return adminClient;
}

export function getEvidenceBucket() { return evidenceBucketName(); }
