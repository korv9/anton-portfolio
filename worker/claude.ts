/**
 * Allegora's answer and fable from Claude (Anthropic API) when the Worker has ANTHROPIC_API_KEY
 * (a Cloudflare secret); without it they come from Gemma on Workers AI as before (index.ts).
 * Claude Sonnet 5.5 with thinking off (`between_tools`, its only off switch) at effort low, for a
 * quick chat answer; the quote check in index.ts still drops any answer that does not quote its
 * passages verbatim. A refusal the fallback does not rescue is a failure. claudeStream() is the same
 * call streamed (ask.ts): the raw events, without the SDK's accumulating helper, to keep the
 * Worker's CPU time per event small.
 */
import Anthropic from '@anthropic-ai/sdk'

export const CLAUDE_MODEL = 'claude-sonnet-5-5'

const request = (system: string, user: string, maxTokens: number) => ({
  model: CLAUDE_MODEL,
  max_tokens: maxTokens,
  system,
  messages: [{ role: 'user' as const, content: user }],
  thinking: { type: 'between_tools' as const },
  output_config: { effort: 'low' as const },
  // A declined request is retried on the model Anthropic picks for that refusal category.
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
})

export async function claude(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
) {
  const client = new Anthropic({ apiKey })
  const response = await client.beta.messages.create(
    request(system, user, maxTokens),
  )
  if (response.stop_reason === 'refusal') throw new Error('refusal')
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
  return { text, usage: response.usage, model: response.model }
}

/** The text as it is written; returns the model and token counts. A refusal throws. */
export async function* claudeStream(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number,
) {
  const client = new Anthropic({ apiKey })
  const events = await client.beta.messages.create({
    ...request(system, user, maxTokens),
    stream: true,
  })
  let model: string = CLAUDE_MODEL
  const usage = { input_tokens: 0, output_tokens: 0 }
  for await (const event of events) {
    if (event.type === 'message_start') {
      model = event.message.model
      usage.input_tokens = event.message.usage.input_tokens
    } else if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text
    } else if (event.type === 'message_delta') {
      usage.output_tokens = event.usage.output_tokens
      if (event.delta.stop_reason === 'refusal') throw new Error('refusal')
    }
  }
  return { model, usage }
}
