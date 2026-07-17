import type { AIProvider, AIConfig } from './types'
import { GeminiProvider } from './providers/gemini'

export { GeminiProvider } from './providers/gemini'
export type {
  AIProvider,
  AIConfig,
  AIEnhancement,
  AIEnhancementInput,
  AIProviderName,
} from './types'

export function createAIProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config)
    default:
      throw new Error(`Unsupported AI provider: ${String(config.provider)}`)
  }
}
