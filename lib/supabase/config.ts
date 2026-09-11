export function publicSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim());
}

export function requirePublicSupabaseConfig() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if(!url||!publishableKey)throw new Error('SUPABASE_NOT_CONFIGURED');
  return {url,publishableKey};
}

export function evidenceBucketName(){return process.env.SUPABASE_EVIDENCE_BUCKET?.trim()||'volleyball-evidence';}
