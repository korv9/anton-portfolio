/**
 * Allegora's answer and fable from Claude (Anthropic API) when the Worker has ANTHROPIC_API_KEY
 * (a Cloudflare secret); without it they come from Gemma on Workers AI as before (index.ts).
 * Claude Opus 5.5 always thinks; effort low keeps a chat answer quick. A refusal is a failure.
 */
import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-opus-5-5'

export async function claude(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
) {
  const client = new Anthropic({ apiKey })
  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: 'low' },
    // A declined request is retried on the model Anthropic picks for that refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  if (response.stop_reason === 'refusal') throw new Error('refusal')
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  return { text, usage: response.usage, model: response.model }
}
