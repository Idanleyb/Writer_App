'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

type ContentType = 'article' | 'linkedin';
type IntentChoice = 'article' | 'linkedin' | 'both';

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
  content_type: ContentType;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [items, setItems] = useState<Article[]>([]);
  const [selected, setSelected] = useState<Article | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [choice, setChoice] = useState<IntentChoice>('article');
  const [topicsInput, setTopicsInput] = useState('');
  const [articleFreq, setArticleFreq] = useState(2);
  const [linkedinFreq, setLinkedinFreq] = useState(2);
  const [toneFilename, setToneFilename] = useState<string | null>(null);
  const [tonePreview, setTonePreview] = useState<string | null>(null);
  const [pendingToneFile, setPendingToneFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserEmail(user.email ?? null);

      const params = new URLSearchParams(window.location.search);
      const intent = params.get('intent');
      if (intent === 'article' || intent === 'linkedin' || intent === 'both') setChoice(intent);

      const cfgRes = await fetch('/api/config');
      const cfgJson = await cfgRes.json();
      if (cfgJson.article?.topics?.length) setTopicsInput(cfgJson.article.topics.join(', '));
      else if (cfgJson.linkedin?.topics?.length) setTopicsInput(cfgJson.linkedin.topics.join(', '));
      if (cfgJson.article?.articles_per_week) setArticleFreq(cfgJson.article.articles_per_week);
      if (cfgJson.linkedin?.articles_per_week) setLinkedinFreq(cfgJson.linkedin.articles_per_week);
      const existingTone = cfgJson.article?.tone_text || cfgJson.linkedin?.tone_text;
      if (existingTone) setTonePreview(existingTone.slice(0, 160));

      const { data: rows } = await supabase.from('articles').select('*').order('created_at', { ascending: false });
      setItems(rows ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!profileOpen) return;
    const close = () => setProfileOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [profileOpen]);

  function startNewContent() {
    setSelected(null);
    setChoice('article');
    setTopicsInput('');
    setArticleFreq(2);
    setLinkedinFreq(2);
    setPendingToneFile(null);
    setToneFilename(null);
  }

  async function saveAndGenerate() {
    setSaving(true);
    const topics = topicsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const activeTypes: ContentType[] = choice === 'both' ? ['article', 'linkedin'] : [choice];

    for (const contentType of activeTypes) {
      const articlesPerWeek = contentType === 'article' ? articleFreq : linkedinFreq;

      // Save settings for this type
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, topics, articlesPerWeek }),
      });

      // Upload shared tone file to this type's row, if one was chosen
      if (pendingToneFile) {
        const formData = new FormData();
        formData.append('file', pendingToneFile);
        formData.append('contentType', contentType);
        await fetch('/api/tone-upload', { method: 'POST', body: formData });
      }

      // Generate
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contentType }),
        });
        const json = await res.json();
        if (json.article) {
          setItems((prev) => [json.article, ...prev]);
          setToast('Your content is ready');
        } else {
          setToast(json.error ? `Generation failed: ${json.error}` : 'Generation failed');
        }
      } catch {
        setToast('Generation failed — check your connection and try again');
      }
    }

    setSaving(false);
  }

  async function deleteItem(id: string) {
    const confirmed = window.confirm('Delete this item? This can\'t be undone.');
    if (!confirmed) return;
    const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selected?.id === id) setSelected(null);
      setToast('Deleted');
    } else {
      setToast('Could not delete item');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const articles = items.filter((i) => i.content_type === 'article');
  const posts = items.filter((i) => i.content_type === 'linkedin');

  const sidebarSection = (label: string, list: Article[]) => (
    <div style={{ marginBottom: 22 }}>
      <p className="eyebrow" style={{ padding: '0 10px', marginBottom: 8 }}>{label} ({list.length})</p>
      {list.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-low)', padding: '0 10px' }}>None yet</p>
      )}
      {list.map((item) => (
        <div
          key={item.id}
          className={`article-row ${selected?.id === item.id ? 'active' : ''}`}
          onClick={() => setSelected(item)}
        >
          <p className="article-row-title">{item.title}</p>
          <p className="article-row-meta">{new Date(item.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {toast && <div className="toast">{toast}</div>}

      {/* ---- Profile menu, top-right of the whole page ---- */}
      <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 60 }}>
        <button
          onClick={() => setProfileOpen((o) => !o)}
          aria-label="Account menu"
          style={{
            width: 38, height: 38, borderRadius: '50%', border: '1px solid var(--border-strong)',
            background: 'linear-gradient(120deg, var(--purple-600), var(--purple-500))',
            color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {userEmail ? userEmail[0].toUpperCase() : '?'}
        </button>

        {profileOpen && (
          <div
            className="glass-card"
            style={{ position: 'absolute', top: 46, right: 0, width: 240, padding: 16 }}
          >
            <p style={{ fontSize: 11, color: 'var(--text-low)', margin: '0 0 4px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Signed in as
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--text-hi)', margin: '0 0 14px', wordBreak: 'break-all' }}>
              {userEmail ?? 'Unknown'}
            </p>
            <button
              onClick={logout}
              className="btn-secondary"
              style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
            >
              Log out
            </button>
          </div>
        )}
      </div>

      {/* ---- Sidebar ---- */}
      <aside style={{ width: 250, borderRight: '1px solid var(--border)', padding: '24px 14px', flexShrink: 0 }}>
        <div style={{ padding: '0 10px', marginBottom: 24 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>Articles Builder</span>
        </div>
        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: 24 }}
          onClick={startNewContent}
        >
          + New content
        </button>

        {sidebarSection('Articles', articles)}
        {sidebarSection('Posts', posts)}
      </aside>

      {/* ---- Main panel ---- */}
      <main style={{ flex: 1, padding: '40px 40px 80px', maxWidth: 760 }}>
        {!selected && (
          <>
            <p className="eyebrow" style={{ marginBottom: 8 }}>NEW CONTENT</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, margin: '0 0 24px', color: 'var(--text-hi)' }}>
              What would you need assistance with today?
            </h1>

            <div className="glass-card">
              <label className="field-label">Type</label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {([
                  { value: 'article', label: '📝 Article' },
                  { value: 'linkedin', label: '💬 LinkedIn post' },
                  { value: 'both', label: '✨ Both' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setChoice(opt.value)}
                    className={choice === opt.value ? 'btn-primary' : 'btn-secondary'}
                    style={{ flex: 1, fontSize: 13, padding: '10px 12px' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className="field-label">Topic</label>
              <input
                className="field-input"
                style={{ marginBottom: 18 }}
                value={topicsInput}
                onChange={(e) => setTopicsInput(e.target.value)}
                placeholder="e.g. B2B SaaS growth, fintech UX, AI in music"
              />

              {(choice === 'article' || choice === 'both') && (
                <div style={{ marginBottom: choice === 'both' ? 14 : 18 }}>
                  <label className="field-label">Articles per week</label>
                  <input
                    className="field-input"
                    type="number" min={1} max={7}
                    value={articleFreq}
                    onChange={(e) => setArticleFreq(Number(e.target.value))}
                  />
                </div>
              )}
              {(choice === 'linkedin' || choice === 'both') && (
                <div style={{ marginBottom: 18 }}>
                  <label className="field-label">LinkedIn posts per week</label>
                  <input
                    className="field-input"
                    type="number" min={1} max={7}
                    value={linkedinFreq}
                    onChange={(e) => setLinkedinFreq(Number(e.target.value))}
                  />
                </div>
              )}

              <label className="field-label">Tone file (.docx or .txt) — optional</label>
              <input
                className="field-input"
                style={{ marginBottom: 6, padding: '9px 13px' }}
                type="file"
                accept=".docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) { setPendingToneFile(file); setToneFilename(file.name); }
                }}
              />
              {toneFilename && <p style={{ fontSize: 12, color: 'var(--success)', margin: '4px 0' }}>Selected: {toneFilename}</p>}
              {!toneFilename && tonePreview && (
                <p style={{ fontSize: 12, color: 'var(--text-low)', margin: '4px 0' }}>Currently using: "{tonePreview}…"</p>
              )}

              <button
                className={`btn-primary ${saving ? 'thinking' : ''}`}
                style={{ width: '100%', marginTop: 18 }}
                onClick={saveAndGenerate}
                disabled={saving}
              >
                {saving ? 'Researching + writing…' : 'Save & Generate'}
              </button>
            </div>
          </>
        )}

        {selected && (
          <div className="glass-card" style={{ position: 'relative' }}>
            <button
              onClick={() => deleteItem(selected.id)}
              className="btn-ghost-danger"
              style={{ position: 'absolute', top: 20, right: 22 }}
            >
              Delete
            </button>

            <span className="pill" style={{ marginBottom: 10, display: 'inline-block' }}>
              {selected.content_type === 'linkedin' ? 'LinkedIn post' : 'Article'}
            </span>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, margin: '0 60px 6px 0', color: 'var(--text-hi)' }}>
              {selected.title}
            </h2>
            <p className="mono" style={{ fontSize: 11.5, color: 'var(--text-low)', marginBottom: 18 }}>
              {new Date(selected.created_at).toLocaleString()} · SOURCE — {selected.source_topic}: {selected.source_summary}
            </p>

            <p style={{ fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-hi)' }}>
              {selected.body}
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {selected.hashtags.map((h) => (
                <span key={h} className="pill">#{h.replace(/^#/, '')}</span>
              ))}
            </div>

            <a
              className="btn-secondary"
              style={{ fontSize: 13, padding: '8px 18px', display: 'inline-flex', alignItems: 'center', marginTop: 20 }}
              href={`/api/download/${selected.id}`}
            >
              Download .docx
            </a>

            {selected.search_log && selected.search_log.length > 0 && (
              <div style={{ marginTop: 26, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                <p className="eyebrow" style={{ marginBottom: 4 }}>WHERE THIS CAME FROM</p>
                <table className="search-table">
                  <thead><tr><th>Search query</th><th>Results found</th></tr></thead>
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
        )}
      </main>
    </div>
  );
}
