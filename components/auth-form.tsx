'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';

export function AuthForm() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(form: HTMLFormElement, mode: 'signin' | 'signup') {
    setBusy(true); setMessage('');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const supabase = createClient();
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to confirm it, then sign in.');
      return;
    }
    router.push('/'); router.refresh();
  }

  return <form className="setup-form" onSubmit={e => { e.preventDefault(); void submit(e.currentTarget, 'signin'); }}>
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" minLength={6} autoComplete="current-password" required /></label>
    {message && <p className="form-error">{message}</p>}
    <div className="auth-actions">
      <button className="primary-button" disabled={busy}>{busy ? 'Working…' : 'Sign In'}</button>
      <button className="secondary-button" type="button" disabled={busy} onClick={e => void submit(e.currentTarget.form!, 'signup')}>Create Account</button>
    </div>
  </form>;
}
