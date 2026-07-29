'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = supabaseBrowser();

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
    router.push('/dashboard');
    router.refresh();
  }

  async function handleGoogleAuth() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    marginBottom: 12,
    borderRadius: 4,
    border: '1px solid #28406b',
    background: '#121e35',
    color: '#eef2f8',
  };

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Articles Builder</h1>
      <p style={{ color: '#9fb0c8', fontSize: 13, marginBottom: 24 }}>
        {mode === 'signin' ? 'Sign in to your dashboard' : 'Create an account'}
      </p>

      <form onSubmit={handleEmailAuth}>
        <input
          style={inputStyle}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={inputStyle}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p style={{ color: '#f0a93b', fontSize: 13 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 4, border: 'none',
            background: '#f0a93b', color: '#070d1a', fontWeight: 600, cursor: 'pointer',
          }}
        >
          {loading ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>
      </form>

      <button
        onClick={handleGoogleAuth}
        style={{
          width: '100%', padding: '10px 12px', marginTop: 12, borderRadius: 4,
          border: '1px solid #28406b', background: 'transparent', color: '#eef2f8', cursor: 'pointer',
        }}
      >
        Continue with Google
      </button>

      <p style={{ fontSize: 13, marginTop: 16, color: '#9fb0c8' }}>
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <a
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{ color: '#f0a93b', cursor: 'pointer' }}
        >
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </a>
      </p>
    </div>
  );
}
