export const AI_PROVIDER_IDS = ['google'] as const

export type AIProviderId = (typeof AI_PROVIDER_IDS)[number]

export const AI_PROVIDER_LABELS: Record<AIProviderId, string> = {
  google: 'Google Gemini (Free Tier)',
}

export type AIProviderConfig = {
  provider: AIProviderId
  model: string
  baseUrl: string | null
  enabled: boolean
  isDefault: boolean
  hasApiKey: boolean
  updatedAt: string
}

export type AIProviderConfigsResponse = {
  providers: AIProviderConfig[]
}
