'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<string | null>(null);
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIntent(params.get('intent'));
  }, []);

  function destination() {
    return intent ? `/dashboard?intent=${intent}` : '/dashboard';
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(destination());
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 400, margin: '110px auto', padding: '0 24px' }}>
      <p className="eyebrow" style={{ marginBottom: 10 }}>ARTICLES BUILDER</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, margin: '0 0 6px', lineHeight: 1.15, color: 'var(--text-hi)' }}>
        {mode === 'signin' ? 'Welcome back' : 'Start writing smarter'}
      </h1>
      <p style={{ color: 'var(--text-mid)', fontSize: 14, marginBottom: 28 }}>
        {mode === 'signin' ? 'Sign in to your dashboard' : 'Topics in, content out — on your schedule.'}
      </p>

      <div className="glass-card">
        <form onSubmit={handleEmailAuth}>
          <label className="field-label">Email</label>
          <input
            className="field-input"
            style={{ marginBottom: 14 }}
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="field-label">Password</label>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              className="field-input"
              style={{ paddingRight: 42 }}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'var(--text-low)', display: 'flex', alignItems: 'center',
              }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.9 18.9 0 0 1 4.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
          <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>

      <p style={{ fontSize: 13, marginTop: 20, color: 'var(--text-mid)', textAlign: 'center' }}>
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <a onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={{ cursor: 'pointer' }}>
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </a>
      </p>
    </div>
  );
}
