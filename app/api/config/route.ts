import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { computeScheduledWeekdays } from '@/lib/scheduling';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase.from('user_config').select('*').eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const article = data?.find((c) => c.content_type === 'article') ?? null;
  const linkedin = data?.find((c) => c.content_type === 'linkedin') ?? null;
  return NextResponse.json({ article, linkedin });
}

// Saves topics/frequency/platform for one content type. Deliberately does NOT
// touch tone_text unless explicitly provided in the body — tone is uploaded
// via a separate call (/api/tone-upload), and this route runs on every
// "Save & Generate" click, so overwriting tone_text with null here would
// silently wipe a previously saved tone every time settings are saved without
// re-selecting a file.
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();
  const contentType: 'article' | 'linkedin' = body.contentType === 'linkedin' ? 'linkedin' : 'article';
  const topics: string[] = Array.isArray(body.topics) ? body.topics : [];
  const articlesPerWeek: number = Number(body.articlesPerWeek) || 2;
  const platform: string = contentType === 'linkedin' ? 'linkedin' : (body.platform || 'linkedin');
  const scheduledWeekdays = computeScheduledWeekdays(articlesPerWeek);
  const hasExplicitTone = typeof body.toneText === 'string';

  const { data: existing } = await supabase
    .from('user_config')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('content_type', contentType)
    .maybeSingle();

  const basePayload: Record<string, any> = {
    topics,
    articles_per_week: articlesPerWeek,
    scheduled_weekdays: scheduledWeekdays,
    platform,
    updated_at: new Date().toISOString(),
  };
  if (hasExplicitTone) basePayload.tone_text = body.toneText;

  const { error } = existing
    ? await supabase.from('user_config').update(basePayload).eq('user_id', user.id).eq('content_type', contentType)
    : await supabase.from('user_config').insert({
        user_id: user.id,
        content_type: contentType,
        tone_text: hasExplicitTone ? body.toneText : null,
        ...basePayload,
      });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, scheduledWeekdays });
}
