/**
 * Allegora's answer and fable from Claude (Anthropic API) when the Worker has ANTHROPIC_API_KEY
 * (a Cloudflare secret); without it they come from Gemma on Workers AI as before (index.ts).
 * Claude Haiku 5.5 without thinking at effort low, for a quick chat answer; the quote check in
 * index.ts still drops any answer that does not quote its passages verbatim. A refusal is a
 * failure: Haiku has no server-side fallback.
 */
import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-haiku-5-5'

export async function claude(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
) {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
  })
  if (response.stop_reason === 'refusal') throw new Error('refusal')
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  return { text, usage: response.usage, model: response.model }
}
