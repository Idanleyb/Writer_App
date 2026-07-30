import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export const DEFAULT_TONE = `
Voice: confident, conversational, and direct. Professional but not stiff —
avoid corporate jargon and generic filler ("In today's fast-paced world...").
Every article should leave the reader with one concrete takeaway or a sharp
observation, not just a summary of a topic. No hype language ("game-changer",
"revolutionary", "skyrocket"). Vary sentence length: mix short, punchy lines
with longer explanatory ones. Structure: open with a specific observation or
question (no warm-up), unpack the mechanics or story behind it, land on the
core insight, close with a clear, concrete takeaway.
`.trim();

interface GenerateArgs {
  topic: string; // a single, specific topic for this run — see lib/pickTopic.ts
  toneText: string | null;
  platform: string;
}

interface SearchLogEntry {
  query: string;
  results: { title: string; url: string }[];
}

interface GeneratedArticle {
  title: string;
  body: string;
  hashtags: string[];
  source_topic: string;
  source_summary: string;
  searchLog: SearchLogEntry[];
}

const platformRules = (platform: string) =>
  platform === 'linkedin'
    ? `Format for LinkedIn: short paragraphs (1-3 sentences each), no markdown syntax
(LinkedIn won't render **bold** or # headers), 3-5 relevant hashtags at the end,
350-550 words.`
    : `Format for ${platform}. 350-650 words.`;

export async function generateArticle({ topic, toneText, platform }: GenerateArgs): Promise<GeneratedArticle> {
  const tone = toneText?.trim() || DEFAULT_TONE;

  const today = new Date().toISOString().slice(0, 10);

  const resp = await client.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [
        {
          role: 'user',
          content: `Today's date is ${today}. Your job is to find and write about something
specific and current related to exactly this topic: "${topic}".

STAY ON THIS TOPIC. Do not drift to a different, more generic subject just
because it's more heavily covered online. In particular: do not write about
large incumbent companies (e.g. JPMorgan, Goldman Sachs, Google, Meta, Amazon)
unless "${topic}" explicitly names one of them — broad category searches tend
to surface big-name news by default, and that is exactly what to avoid here.

Process:
1. Run at least 2 separate web searches with different, specific phrasings
   that include the topic itself, e.g. "${topic} new tool 2026",
   "${topic} startup launch", "${topic} research 2026". Prefer phrasings
   likely to surface a specific product, launch, or study rather than
   generic commentary.
2. If your results drift away from "${topic}" or only return generic/incumbent
   coverage, refine the query and search again before writing anything.
3. Pick ONE specific, concrete finding (a real launch, technique, or study) —
   not a generic trend statement — and write an original article about it.
4. Pick a genuinely different specific finding each time this runs — do not
   default to the most obvious or most-searched result if a more specific,
   less generic one is available in your search results.

TONE TO FOLLOW:
${tone}

FORMAT RULES:
${platformRules(platform)}
Apply basic SEO: work "${topic}" (or a natural variant of it) into the first
two sentences. Write claims clearly enough that an AI assistant summarizing
this article later would state them accurately (GEO), without sacrificing
the tone above.

Do not quote your sources directly or reproduce their wording — write fully
original analysis and commentary in your own words, citing only the gist of
what you found.

After you've finished researching, respond with ONLY a JSON object on its own
(no prose before or after, no markdown fences):
{
  "title": "...",
  "body": "...",
  "hashtags": ["...", "..."],
  "source_topic": "the specific thing you found and wrote about, one short phrase",
  "source_summary": "one sentence on where this idea came from"
}`,
        },
      ],
    },
    { fetchOptions: { cache: 'no-store' } } // belt-and-suspenders: Next.js patches fetch to cache by
                                             // default in some contexts — this rules that out entirely
  );

  // Build a transparent log of what was actually searched and found, by
  // matching each server_tool_use (the query) to its following
  // web_search_tool_result (the results) via tool_use_id.
  const queryById: Record<string, string> = {};
  for (const block of resp.content) {
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      const input = block.input as { query?: string } | undefined;
      queryById[block.id] = input?.query ?? '';
    }
  }
  const searchLog: SearchLogEntry[] = [];
  for (const block of resp.content) {
    if (block.type === 'web_search_tool_result') {
      const query = queryById[block.tool_use_id] ?? '(query unavailable)';
      const content = block.content;
      const results = Array.isArray(content)
        ? content.map((r) => ({ title: r.title, url: r.url }))
        : [];
      searchLog.push({ query, results });
    }
  }

  const textBlocks = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
  const raw = textBlocks[textBlocks.length - 1]?.text?.trim() ?? '';
  const cleaned = raw.replace(/^```json/, '').replace(/```$/, '').trim();

  let parsed: Omit<GeneratedArticle, 'searchLog'>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Could not parse article JSON from model output: ${cleaned.slice(0, 300)}`);
  }
  return { ...parsed, searchLog };
}
