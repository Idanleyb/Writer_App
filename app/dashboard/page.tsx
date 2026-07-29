'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

interface Article {
  id: string;
  title: string;
  body: string;
  hashtags: string[];
  source_topic: string;
  source_summary: string;
  platform: string;
  created_at: string;
}

interface UserConfig {
  topics: string[];
  tone_text: string | null;
  articles_per_week: number;
  platform: string;
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [articles, setArticles] = useState<Article[]>([]);
  const [config, setConfig] = useState<UserConfig>({
    topics: [], tone_text: null, articles_per_week: 2, platform: 'linkedin',
  });
  const [topicsInput, setTopicsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const cfgRes = await fetch('/api/config');
      const cfgJson = await cfgRes.json();
      if (cfgJson.config) {
        setConfig(cfgJson.config);
        setTopicsInput((cfgJson.config.topics ?? []).join(', '));
      }

      const { data: articleRows } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });
      setArticles(articleRows ?? []);
    })();
  }, []);

  async function saveConfig() {
    setSaving(true);
    const topics = topicsInput.split(',').map((t) => t.trim()).filter(Boolean);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, topics }),
    });
    setSaving(false);
  }

  async function uploadTone(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/tone-upload', { method: 'POST', body: formData });
    const json = await res.json();
    if (json.preview) {
      setConfig((c) => ({ ...c, tone_text: json.preview }));
    }
  }

  async function generateNow() {
    setGenerating(true);
    const res = await fetch('/api/generate', { method: 'POST' });
    const json = await res.json();
    setGenerating(false);
    if (json.article) setArticles((prev) => [json.article, ...prev]);
  }

  function copyArticle(article: Article) {
    const text = `${article.title}\n\n${article.body}\n\n${article.hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(article.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const card: React.CSSProperties = {
    background: '#0c1526', border: '1px solid #121e35', borderRadius: 6, padding: 20, marginBottom: 16,
  };
  const label: React.CSSProperties = { fontSize: 12, color: '#9fb0c8', display: 'block', marginBottom: 6 };
  const input: React.CSSProperties = {
    width: '100%', padding: '9px 11px', borderRadius: 4, border: '1px solid #28406b',
    background: '#121e35', color: '#eef2f8', marginBottom: 14,
  };
  const button: React.CSSProperties = {
    padding: '9px 16px', borderRadius: 4, border: 'none', background: '#f0a93b',
    color: '#070d1a', fontWeight: 600, cursor: 'pointer',
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Articles Builder</h1>

      <div style={card}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Your settings</h2>

        <label style={label}>Topics (comma-separated)</label>
        <input
          style={input}
          value={topicsInput}
          onChange={(e) => setTopicsInput(e.target.value)}
          placeholder="e.g. B2B SaaS growth, fintech UX, AI in music"
        />

        <label style={label}>Articles per week</label>
        <input
          style={input}
          type="number"
          min={1}
          max={7}
          value={config.articles_per_week}
          onChange={(e) => setConfig((c) => ({ ...c, articles_per_week: Number(e.target.value) }))}
        />

        <label style={label}>Platform</label>
        <select
          style={input}
          value={config.platform}
          onChange={(e) => setConfig((c) => ({ ...c, platform: e.target.value }))}
        >
          <option value="linkedin">LinkedIn</option>
        </select>

        <label style={label}>Tone file (.docx or .txt) — optional, uses a sensible default if skipped</label>
        <input
          style={input}
          type="file"
          accept=".docx,.txt"
          onChange={(e) => e.target.files?.[0] && uploadTone(e.target.files[0])}
        />
        {config.tone_text && (
          <p style={{ fontSize: 12, color: '#5fbf8f', marginBottom: 14 }}>
            Tone loaded: "{config.tone_text.slice(0, 120)}…"
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={button} onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <button style={{ ...button, background: 'transparent', border: '1px solid #f0a93b', color: '#f0a93b' }}
                  onClick={generateNow} disabled={generating}>
            {generating ? 'Generating…' : 'Generate an article now'}
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Your articles</h2>
      {articles.length === 0 && (
        <p style={{ color: '#5f7291', fontSize: 13 }}>No articles yet — save your settings and try "Generate an article now".</p>
      )}
      {articles.map((article) => (
        <div key={article.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 style={{ fontSize: 17, margin: 0 }}>{article.title}</h3>
            <span style={{ fontSize: 11, color: '#5f7291' }}>{new Date(article.created_at).toLocaleDateString()}</span>
          </div>
          <p style={{ fontSize: 11, color: '#5f7291', margin: '6px 0 12px' }}>
            Source: {article.source_topic} — {article.source_summary}
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#c7d2e3' }}>{article.body}</p>
          <p style={{ fontSize: 13, color: '#f0a93b', marginTop: 10 }}>
            {article.hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}
          </p>
          <button style={{ ...button, marginTop: 10 }} onClick={() => copyArticle(article)}>
            {copiedId === article.id ? 'Copied!' : 'Copy for LinkedIn'}
          </button>
        </div>
      ))}
    </div>
  );
}
