import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id) // ensures a user can only download their own article
    .maybeSingle();

  if (error || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const bodyParagraphs = article.body
    .split('\n')
    .filter((line: string) => line.trim().length > 0)
    .map((line: string) => new Paragraph({ children: [new TextRun(line)], spacing: { after: 200 } }));

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: article.title, heading: HeadingLevel.HEADING_1, spacing: { after: 300 } }),
          ...bodyParagraphs,
          new Paragraph({
            children: [
              new TextRun({
                text: (article.hashtags ?? []).map((h: string) => '#' + h.replace(/^#/, '')).join(' '),
                color: '8b5cf6',
              }),
            ],
            spacing: { before: 200 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeFilename = article.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename || 'article'}.docx"`,
    },
  });
}
