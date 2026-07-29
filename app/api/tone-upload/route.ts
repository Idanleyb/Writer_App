import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import mammoth from 'mammoth';

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let toneText: string;

  if (file.name.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    toneText = result.value;
  } else {
    toneText = buffer.toString('utf-8');
  }

  toneText = toneText.trim().slice(0, 8000); // keep prompts a sane size

  const { error } = await supabase
    .from('user_config')
    .upsert({ user_id: user.id, tone_text: toneText, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, preview: toneText.slice(0, 300) });
}
