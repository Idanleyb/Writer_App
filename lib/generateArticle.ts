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
  topics: string[];
  toneText: string | null;
  platform: string;
}

interface GeneratedArticle {
  title: string;
  body: string;
  hashtags: string[];
  source_topic: string;
  source_summary: string;
}

/**
 * Uses Claude's web search tool to find a genuinely current, specific idea
 * related to the user's topics, then writes an article about it in the
 * user's tone. One Claude call handles both steps so the model can ground
 * the article in what it actually found, rather than writing generically
 * and citing nothing.
 */
export async function generateArticle({ topics, toneText, platform }: GenerateArgs): Promise<GeneratedArticle> {
  const tone = toneText?.trim() || DEFAULT_TONE;
  const topicList = topics.length ? topics.join(', ') : 'marketing and growth';

  const platformRules =
    platform === 'linkedin'
      ? `Format for LinkedIn: short paragraphs (1-3 sentences each), no markdown syntax
(LinkedIn won't render **bold** or # headers), 3-5 relevant hashtags at the end,
350-550 words.`
      : `Format for ${platform}. 350-650 words.`;

  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Search the web for one specific, genuinely current product, idea, or
development related to: ${topicList}.

Pick something concrete and recent — a real launch, a real study, a real
technique — not a generic trend statement. Then write an original article
about it.

TONE TO FOLLOW:
${tone}

FORMAT RULES:
${platformRules}
Apply basic SEO: work the core topic naturally into the first two sentences.
Write claims clearly enough that an AI assistant summarizing this article later
would state them accurately (GEO) — without sacrificing the tone above.

Do not quote your sources directly or reproduce their wording — write fully
original analysis and commentary in your own words, citing only the gist of
what you found.

After you've researched, respond with ONLY a JSON object on its own (no prose
before or after, no markdown fences):
{
  "title": "...",
  "body": "...",
  "hashtags": ["...", "..."],
  "source_topic": "the specific thing you found and wrote about, one short phrase",
  "source_summary": "one sentence on where this idea came from"
}`,
      },
    ],
  });

  // With tool use enabled, the final assistant turn may include multiple
  // content blocks (tool calls + text); the JSON is in the last text block.
  const textBlocks = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
  const raw = textBlocks[textBlocks.length - 1]?.text?.trim() ?? '';
  const cleaned = raw.replace(/^```json/, '').replace(/```$/, '').trim();

  let parsed: GeneratedArticle;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Could not parse article JSON from model output: ${cleaned.slice(0, 300)}`);
  }
  return parsed;
}
