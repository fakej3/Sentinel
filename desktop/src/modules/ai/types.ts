export type AIProviderName = 'gemini' | 'openai' | 'claude' | 'openrouter'

export interface AIEnhancementInput {
  symbol: string
  interval: string
  headline: string
  summary: string
  conclusion: string
  fullReport: string
  confidenceScore: number
  confidenceGrade: string
}

export interface AIEnhancement {
  summary: string
  conclusion: string
}

export interface AIProvider {
  readonly name: AIProviderName
  readonly model: string
  isAvailable(): boolean
  enhance(input: AIEnhancementInput): Promise<AIEnhancement>
}

export interface AIConfig {
  provider: AIProviderName
  apiKey: string
  model?: string
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}
