import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { computeScheduledWeekdays } from '@/lib/scheduling';

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const topics: string[] = Array.isArray(body.topics) ? body.topics : [];
  const toneText: string | null = typeof body.toneText === 'string' ? body.toneText : null;
  const articlesPerWeek: number = Number(body.articlesPerWeek) || 2;
  const platform: string = body.platform || 'linkedin';

  const scheduledWeekdays = computeScheduledWeekdays(articlesPerWeek);

  const { error } = await supabase.from('user_config').upsert({
    user_id: user.id,
    topics,
    tone_text: toneText,
    articles_per_week: articlesPerWeek,
    scheduled_weekdays: scheduledWeekdays,
    platform,
    updated_at: new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scheduledWeekdays });
}

export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}
