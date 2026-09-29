/**
 * The language model behind Herr taLLMan: Claude through the official Anthropic SDK. It gets
 * the retrieved passages and returns claims as JSON that matches CLAIMS_SCHEMA; Allegoria
 * checks them afterwards, so the model never has the last word.
 *
 * Server-side fallback is on (`fallbacks: 'default'`): if the chosen model is overloaded the
 * API answers with its default fallback model, and the trace records the model that answered.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  CLAIMS_SCHEMA,
  SYSTEM_PROMPT,
  parseClaims,
  userPrompt,
  type ClaimModel,
} from '../frontend/src/tallman/engine/claims.ts'

export const DEFAULT_MODEL = 'claude-opus-5-5'

export type LlmOptions = {
  apiKey: string
  model?: string
  /** How hard the model thinks; 'medium' balances cost and care for short answers. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

export function anthropicModel(options: LlmOptions): ClaimModel {
  const client = new Anthropic({ apiKey: options.apiKey })
  const model = options.model || DEFAULT_MODEL
  return {
    name: `Anthropic ${model}`,
    async claims(question, passages) {
      const stream = client.beta.messages.stream({
        model,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: {
          effort: options.effort ?? 'medium',
          format: {
            type: 'json_schema',
            schema: CLAIMS_SCHEMA as unknown as Record<string, unknown>,
          },
        },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt(question, passages) }],
      })
      const message = await stream.finalMessage()
      if (message.stop_reason === 'refusal') throw new Error('modellen avböjde')
      if (message.stop_reason === 'max_tokens')
        throw new Error('svaret blev för långt')
      const text = message.content.find((block) => block.type === 'text')
      if (!text || text.type !== 'text') throw new Error('inget textsvar')
      const set = parseClaims(JSON.parse(text.text))
      return { ...set, model: `Anthropic ${message.model}` }
    },
  }
}
