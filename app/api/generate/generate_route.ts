import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { generateArticle } from '@/lib/generateArticle';
import { pickTopic } from '@/lib/pickTopic';

export async function POST() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: config } = await supabase
    .from('user_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const topics: string[] = config?.topics ?? [];
  const toneText: string | null = config?.tone_text ?? null;
  const platform: string = config?.platform ?? 'linkedin';

  const { count } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const topic = pickTopic(topics, count ?? 0);

  try {
    const article = await generateArticle({ topic, toneText, platform });
    const { data: inserted, error } = await supabase
      .from('articles')
      .insert({
        user_id: user.id,
        title: article.title,
        body: article.body,
        hashtags: article.hashtags,
        source_topic: article.source_topic,
        source_summary: article.source_summary,
        search_log: article.searchLog,
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
