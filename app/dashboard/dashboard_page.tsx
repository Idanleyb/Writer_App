'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

type ContentType = 'article' | 'linkedin';

interface SearchLogEntry {
  query: string;
  results: { title: string; url: string }[];
}

interface Article {
  id: string;
  title: string;
  body: string;
  hashtags: string[];
  source_topic: string;
  source_summary: string;
  search_log: SearchLogEntry[];
  platform: string;
  content_type: ContentType;
  created_at: string;
}

interface UserConfig {
  topics: string[];
  tone_text: string | null;
  articles_per_week: number;
  platform: string;
}

const emptyConfig = (): UserConfig => ({ topics: [], tone_text: null, articles_per_week: 2, platform: 'linkedin' });

export default function Dashboard() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [articles, setArticles] = useState<Article[]>([]);
  const [listFilter, setListFilter] = useState<'all' | ContentType>('all');

  const [articleConfig, setArticleConfig] = useState<UserConfig | null>(null);
  const [linkedinConfig, setLinkedinConfig] = useState<UserConfig | null>(null);
  const [articleTopicsInput, setArticleTopicsInput] = useState('');
  const [linkedinTopicsInput, setLinkedinTopicsInput] = useState('');

  const [savingArticle, setSavingArticle] = useState(false);
  const [savingLinkedin, setSavingLinkedin] = useState(false);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [generatingLinkedin, setGeneratingLinkedin] = useState(false);

  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const cfgRes = await fetch('/api/config');
      const cfgJson = await cfgRes.json();
      if (cfgJson.article) {
        setArticleConfig(cfgJson.article);
        setArticleTopicsInput((cfgJson.article.topics ?? []).join(', '));
      }
      if (cfgJson.linkedin) {
        setLinkedinConfig(cfgJson.linkedin);
        setLinkedinTopicsInput((cfgJson.linkedin.topics ?? []).join(', '));
      }

      const { data: articleRows } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });
      setArticles(articleRows ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function saveConfig(contentType: ContentType, config: UserConfig, topicsInputValue: string) {
    const topics = topicsInputValue.split(',').map((t) => t.trim()).filter(Boolean);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType, ...config, topics }),
    });
    return topics;
  }

  async function handleSaveArticle() {
    setSavingArticle(true);
    const cfg = articleConfig ?? emptyConfig();
    const topics = await saveConfig('article', cfg, articleTopicsInput);
    setArticleConfig({ ...cfg, topics });
    setSavingArticle(false);
  }

  async function handleSaveLinkedin() {
    setSavingLinkedin(true);
    const cfg = linkedinConfig ?? emptyConfig();
    const topics = await saveConfig('linkedin', cfg, linkedinTopicsInput);
    setLinkedinConfig({ ...cfg, topics });
    setSavingLinkedin(false);
  }

  async function uploadTone(contentType: ContentType, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentType', contentType);
    const res = await fetch('/api/tone-upload', { method: 'POST', body: formData });
    const json = await res.json();
    if (json.preview) {
      if (contentType === 'article') setArticleConfig((c) => ({ ...(c ?? emptyConfig()), tone_text: json.preview }));
      else setLinkedinConfig((c) => ({ ...(c ?? emptyConfig()), tone_text: json.preview }));
    }
  }

  async function generateNow(contentType: ContentType) {
    const setGenerating = contentType === 'article' ? setGeneratingArticle : setGeneratingLinkedin;
    const cfg = contentType === 'article' ? (articleConfig ?? emptyConfig()) : (linkedinConfig ?? emptyConfig());
    const topicsInputValue = contentType === 'article' ? articleTopicsInput : linkedinTopicsInput;

    setGenerating(true);
    try {
      const topics = await saveConfig(contentType, cfg, topicsInputValue);
      if (contentType === 'article') setArticleConfig({ ...cfg, topics });
      else setLinkedinConfig({ ...cfg, topics });

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType }),
      });
      const json = await res.json();
      setGenerating(false);
      if (json.article) {
        setArticles((prev) => [json.article, ...prev]);
        setToast(`"${json.article.title}" is ready — based on: ${json.article.source_topic}`);
      } else {
        setToast(json.error ? `Generation failed: ${json.error}` : 'Generation failed');
      }
    } catch (e) {
      setGenerating(false);
      setToast('Generation failed — check your connection and try again');
    }
  }

  async function clearAllArticles() {
    const confirmed = window.confirm(
      `Delete all ${articles.length} item${articles.length === 1 ? '' : 's'} (articles and LinkedIn posts)? This can't be undone.`
    );
    if (!confirmed) return;
    const res = await fetch('/api/articles/clear', { method: 'DELETE' });
    const json = await res.json();
    if (json.ok) {
      setArticles([]);
      setSelected(null);
      setToast('All items cleared');
    } else {
      setToast(json.error ? `Could not clear: ${json.error}` : 'Could not clear items');
    }
  }

  function copyArticle(article: Article) {
    const text = `${article.title}\n\n${article.body}\n\n${article.hashtags.map((h) => '#' + h.replace(/^#/, '')).join(' ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const filteredArticles = articles.filter((a) => listFilter === 'all' || a.content_type === listFilter);

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '48px 24px 80px' }}>
      {toast && <div className="toast">{toast}</div>}

      <header style={{ marginBottom: 36 }}>
        <p className="eyebrow" style={{ marginBottom: 8 }}>YOUR WORKSPACE</p>
        <h1 className="aurora-text" style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: 0, lineHeight: 1.1 }}>
          Articles Builder
        </h1>
        <p style={{ color: 'var(--text-mid)', fontSize: 14, marginTop: 8 }}>
          Turn on either process, or both — each has its own topics, tone, and frequency.
        </p>
      </header>

      {/* ---- Article settings ---- */}
      <div className="glass-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: '0 0 4px' }}>📝 Article settings</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-low)', margin: '0 0 18px' }}>
          Long-form (350-550 words), shown here for you to copy or download as Word.
        </p>

        <label className="field-label">Topics (comma-separated — each generation focuses on just one, rotating through the list)</label>
        <input
          className="field-input"
          style={{ marginBottom: 16 }}
          value={articleTopicsInput}
          onChange={(e) => setArticleTopicsInput(e.target.value)}
          placeholder="e.g. B2B SaaS growth, fintech UX, AI in music"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
          <div>
            <label className="field-label">Articles per week</label>
            <input
              className="field-input"
              type="number"
              min={1}
              max={7}
              value={articleConfig?.articles_per_week ?? 2}
              onChange={(e) => setArticleConfig({ ...(articleConfig ?? emptyConfig()), articles_per_week: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="field-label">Platform</label>
            <select
              className="field-input"
              value={articleConfig?.platform ?? 'linkedin'}
              onChange={(e) => setArticleConfig({ ...(articleConfig ?? emptyConfig()), platform: e.target.value })}
            >
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
        </div>

        <label className="field-label" style={{ marginTop: 12 }}>
          Tone file (.docx or .txt) — optional, a sensible default is used if skipped
        </label>
        <input
          className="field-input"
          style={{ marginBottom: 6, padding: '9px 13px' }}
          type="file"
          accept=".docx,.txt"
          onChange={(e) => e.target.files?.[0] && uploadTone('article', e.target.files[0])}
        />
        {articleConfig?.tone_text && (
          <p style={{ fontSize: 12, color: 'var(--success)', margin: '8px 0 4px' }}>
            Tone loaded: "{articleConfig.tone_text.slice(0, 120)}…"
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button className="btn-primary" onClick={handleSaveArticle} disabled={savingArticle}>
            {savingArticle ? 'Saving…' : 'Save article settings'}
          </button>
          <button
            className={`btn-secondary ${generatingArticle ? 'thinking' : ''}`}
            onClick={() => generateNow('article')}
            disabled={generatingArticle}
          >
            {generatingArticle ? 'Researching + writing…' : 'Save & generate article now'}
          </button>
        </div>
      </div>

      {/* ---- LinkedIn settings ---- */}
      <div className="glass-card" style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: '0 0 4px' }}>💬 LinkedIn post settings</h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-low)', margin: '0 0 18px' }}>
          Short-form (50-150 words), same sourcing process — fully separate topics and schedule from Articles.
        </p>

        <label className="field-label">Topics (comma-separated — rotates one per post)</label>
        <input
          className="field-input"
          style={{ marginBottom: 16 }}
          value={linkedinTopicsInput}
          onChange={(e) => setLinkedinTopicsInput(e.target.value)}
          placeholder="e.g. psychological marketing, fintech, music tech"
        />

        <label className="field-label">Posts per week</label>
        <input
          className="field-input"
          style={{ marginBottom: 4 }}
          type="number"
          min={1}
          max={7}
          value={linkedinConfig?.articles_per_week ?? 2}
          onChange={(e) => setLinkedinConfig({ ...(linkedinConfig ?? emptyConfig()), articles_per_week: Number(e.target.value) })}
        />

        <label className="field-label" style={{ marginTop: 12 }}>
          Tone file (.docx or .txt) — optional, a sensible default is used if skipped
        </label>
        <input
          className="field-input"
          style={{ marginBottom: 6, padding: '9px 13px' }}
          type="file"
          accept=".docx,.txt"
          onChange={(e) => e.target.files?.[0] && uploadTone('linkedin', e.target.files[0])}
        />
        {linkedinConfig?.tone_text && (
          <p style={{ fontSize: 12, color: 'var(--success)', margin: '8px 0 4px' }}>
            Tone loaded: "{linkedinConfig.tone_text.slice(0, 120)}…"
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 18 }}>
          <button className="btn-primary" onClick={handleSaveLinkedin} disabled={savingLinkedin}>
            {savingLinkedin ? 'Saving…' : 'Save LinkedIn settings'}
          </button>
          <button
            className={`btn-secondary ${generatingLinkedin ? 'thinking' : ''}`}
            onClick={() => generateNow('linkedin')}
            disabled={generatingLinkedin}
          >
            {generatingLinkedin ? 'Researching + writing…' : 'Save & generate post now'}
          </button>
        </div>
      </div>

      {/* ---- Combined list ---- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, margin: 0 }}>My content</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['all', 'article', 'linkedin'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setListFilter(f)}
              className="pill"
              style={{
                cursor: 'pointer',
                borderColor: listFilter === f ? 'var(--accent)' : undefined,
                color: listFilter === f ? 'var(--accent)' : undefined,
              }}
            >
              {f === 'all' ? 'All' : f === 'article' ? 'Articles' : 'LinkedIn'}
            </button>
          ))}
          {articles.length > 0 && (
            <button
              onClick={clearAllArticles}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {filteredArticles.length === 0 && (
        <p style={{ color: 'var(--text-low)', fontSize: 13.5 }}>
          Nothing here yet — save settings above, then try one of the "Generate now" buttons.
        </p>
      )}
      {filteredArticles.length > 0 && (
        <div className="glass-card" style={{ padding: 6 }}>
          {filteredArticles.map((article, i) => (
            <div
              key={article.id}
              className="article-row"
              style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
              onClick={() => setSelected(article)}
            >
              <div>
                <p className="article-row-title">{article.title}</p>
                <p className="article-row-meta">
                  {new Date(article.created_at).toLocaleDateString()} · {article.source_topic}
                </p>
              </div>
              <span className="pill">{article.content_type === 'linkedin' ? 'LinkedIn' : 'Article'}</span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="glass-card modal-panel" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">×</button>

            <span className="pill" style={{ marginBottom: 10, display: 'inline-block' }}>
              {selected.content_type === 'linkedin' ? 'LinkedIn post' : 'Article'}
            </span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 21, margin: '0 24px 6px 0' }}>{selected.title}</h3>
            <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-low)', marginBottom: 18 }}>
              {new Date(selected.created_at).toLocaleString()} · SOURCE — {selected.source_topic}: {selected.source_summary}
            </p>

            <p style={{ fontSize: 14.5, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text-hi)', opacity: 0.92 }}>
              {selected.body}
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {selected.hashtags.map((h) => (
                <span key={h} className="pill">#{h.replace(/^#/, '')}</span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-secondary" style={{ fontSize: 13, padding: '8px 18px' }} onClick={() => copyArticle(selected)}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
              <a
                className="btn-secondary"
                style={{ fontSize: 13, padding: '8px 18px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                href={`/api/download/${selected.id}`}
              >
                Download .docx
              </a>
            </div>

            {selected.search_log && selected.search_log.length > 0 && (
              <div style={{ marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <p className="eyebrow" style={{ marginBottom: 4 }}>WHERE THIS CAME FROM</p>
                <table className="search-table">
                  <thead>
                    <tr><th>Search query</th><th>Results found</th></tr>
                  </thead>
                  <tbody>
                    {selected.search_log.map((entry, i) => (
                      <tr key={i}>
                        <td className="query-cell">{entry.query}</td>
                        <td>
                          {entry.results.slice(0, 4).map((r, j) => (
                            <a key={j} href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
