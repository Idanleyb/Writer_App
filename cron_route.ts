import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { generateArticle } from '@/lib/generateArticle';
import { pickTopic } from '@/lib/pickTopic';

// Vercel Cron calls this once a day (see vercel.json). It checks every user's
// scheduled_weekdays against today, and generates + stores an article for
// each user who's due.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const todayWeekday = new Date().getUTCDay(); // 0=Sun..6=Sat

  const { data: dueConfigs, error } = await admin
    .from('user_config')
    .select('*')
    .contains('scheduled_weekdays', [todayWeekday]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ user_id: string; ok: boolean; error?: string }> = [];

  for (const config of dueConfigs ?? []) {
    try {
      const { count } = await admin
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', config.user_id);

      const topic = pickTopic(config.topics ?? [], count ?? 0);

      const article = await generateArticle({
        topic,
        toneText: config.tone_text ?? null,
        platform: config.platform ?? 'linkedin',
      });
      const { error: insertError } = await admin.from('articles').insert({
        user_id: config.user_id,
        title: article.title,
        body: article.body,
        hashtags: article.hashtags,
        source_topic: article.source_topic,
        source_summary: article.source_summary,
        search_log: article.searchLog,
        platform: config.platform ?? 'linkedin',
      });
      if (insertError) throw new Error(insertError.message);
      results.push({ user_id: config.user_id, ok: true });
    } catch (e: any) {
      results.push({ user_id: config.user_id, ok: false, error: e.message });
    }
  }

  return NextResponse.json({ ran_for: results.length, results });
}
