import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { computeScheduledWeekdays } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

// GET returns both configs at once (either may be null if the user hasn't
// enabled that process yet) so the dashboard can render both sections in one call.
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_config')
    .select('*')
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const article = data?.find((c) => c.content_type === 'article') ?? null;
  const linkedin = data?.find((c) => c.content_type === 'linkedin') ?? null;
  return NextResponse.json({ article, linkedin });
}

// POST always requires contentType so it knows which of the two independent
// rows to create/update — Article and LinkedIn settings never overwrite each other.
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const contentType: 'article' | 'linkedin' = body.contentType === 'linkedin' ? 'linkedin' : 'article';
  const topics: string[] = Array.isArray(body.topics) ? body.topics : [];
  const toneText: string | null = typeof body.toneText === 'string' ? body.toneText : null;
  const articlesPerWeek: number = Number(body.articlesPerWeek) || 2;
  const platform: string = contentType === 'linkedin' ? 'linkedin' : (body.platform || 'linkedin');

  const scheduledWeekdays = computeScheduledWeekdays(articlesPerWeek);

  const { error } = await supabase.from('user_config').upsert(
    {
      user_id: user.id,
      content_type: contentType,
      topics,
      tone_text: toneText,
      articles_per_week: articlesPerWeek,
      scheduled_weekdays: scheduledWeekdays,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,content_type' }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scheduledWeekdays });
}
