'use client';
import { createClient } from '../lib/supabase/client';
export function SignOutButton() {
  return <button className="sign-out-button" onClick={async () => { await createClient().auth.signOut(); window.location.href='/login'; }}>Sign out</button>;
}
