import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { generateArticle } from '@/lib/generateArticle';
import { pickTopic } from '@/lib/pickTopic';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const contentType: 'article' | 'linkedin' = body.contentType === 'linkedin' ? 'linkedin' : 'article';

  const { data: config } = await supabase
    .from('user_config')
    .select('*')
    .eq('user_id', user.id)
    .eq('content_type', contentType)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: `No ${contentType} settings found — save settings for this process first.` }, { status: 400 });
  }

  const topics: string[] = config.topics ?? [];
  const toneText: string | null = config.tone_text ?? null;
  const platform: string = config.platform ?? (contentType === 'linkedin' ? 'linkedin' : 'linkedin');

  // Topic rotation is independent per content type — an Article run and a
  // LinkedIn run for the same user track separately, since they're fully
  // separate configs.
  const { count } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('content_type', contentType);

  const topic = pickTopic(topics, count ?? 0);

  try {
    const content = await generateArticle({ contentType, topic, toneText, platform });
    const { data: inserted, error } = await supabase
      .from('articles')
      .insert({
        user_id: user.id,
        content_type: contentType,
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
        source_topic: content.source_topic,
        source_summary: content.source_summary,
        search_log: content.searchLog,
        platform,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ article: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Generation failed' }, { status: 500 });
  }
}
