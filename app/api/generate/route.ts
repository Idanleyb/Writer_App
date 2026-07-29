import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { generateArticle } from '@/lib/generateArticle';

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

  try {
    const article = await generateArticle({ topics, toneText, platform });
    const { data: inserted, error } = await supabase
      .from('articles')
      .insert({
        user_id: user.id,
        title: article.title,
        body: article.body,
        hashtags: article.hashtags,
        source_topic: article.source_topic,
        source_summary: article.source_summary,
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
