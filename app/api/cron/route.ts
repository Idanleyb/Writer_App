import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { generateArticle } from '@/lib/generateArticle';
import { pickTopic } from '@/lib/pickTopic';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const maxDuration = 60;

// Vercel Cron calls this once a day. It checks every user_config row (both
// Article and LinkedIn configs are separate rows) against today's weekday,
// and generates + stores content for whichever rows are due.
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

  const results: Array<{ user_id: string; content_type: string; ok: boolean; error?: string }> = [];

  for (const config of dueConfigs ?? []) {
    const contentType: 'article' | 'linkedin' = config.content_type === 'linkedin' ? 'linkedin' : 'article';
    try {
      const { count } = await admin
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', config.user_id)
        .eq('content_type', contentType);

      const topic = pickTopic(config.topics ?? [], count ?? 0);

      const content = await generateArticle({
        contentType,
        topic,
        toneText: config.tone_text ?? null,
        platform: config.platform ?? 'linkedin',
      });
      const { error: insertError } = await admin.from('articles').insert({
        user_id: config.user_id,
        content_type: contentType,
        title: content.title,
        body: content.body,
        hashtags: content.hashtags,
        source_topic: content.source_topic,
        source_summary: content.source_summary,
        search_log: content.searchLog,
        platform: config.platform ?? 'linkedin',
      });
      if (insertError) throw new Error(insertError.message);
      results.push({ user_id: config.user_id, content_type: contentType, ok: true });
    } catch (e: any) {
      results.push({ user_id: config.user_id, content_type: contentType, ok: false, error: e.message });
    }
  }

  return NextResponse.json({ ran_for: results.length, results });
}
