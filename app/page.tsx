import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabaseServer';

export default async function Home() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  const options: { intent: string; emoji: string; label: string }[] = [
    { intent: 'article', emoji: '📝', label: 'An article' },
    { intent: 'linkedin', emoji: '💬', label: 'A LinkedIn post' },
    { intent: 'both', emoji: '✨', label: 'Both' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 0' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>Articles Builder</span>
        <Link href="/login" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Log in
        </Link>
      </nav>

      <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
        <p className="eyebrow" style={{ marginBottom: 14 }}>WELCOME</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, lineHeight: 1.15, margin: '0 0 18px', color: 'var(--text-hi)' }}>
          Your topics in. <span className="purple-text">Ready-to-publish content out.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--text-mid)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Articles Builder researches your chosen topics on the web, writes in your tone, and
          delivers finished LinkedIn posts and articles on the schedule you set — so you always
          have something ready to publish.
        </p>

        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>
          What would you need help with today?
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {options.map((o) => (
            <Link
              key={o.intent}
              href={`/login?intent=${o.intent}`}
              className="glass-card"
              style={{
                textDecoration: 'none', width: 190, padding: '28px 20px', textAlign: 'center',
                display: 'block', color: 'var(--text-hi)', transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 10 }}>{o.emoji}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5 }}>{o.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
