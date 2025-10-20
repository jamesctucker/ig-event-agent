import { Storage } from '@plasmohq/storage'

const storage = new Storage()

export interface ApiConfig {
  openaiApiKey?: string
  googleClientId?: string
  googleApiKey?: string
  googleSheetId?: string
}

/**
 * Get API configuration from storage
 */
export async function getApiConfig(): Promise<ApiConfig> {
  const config = await storage.get<ApiConfig>('apiConfig')

  // Fallback to environment variables if not in storage
  return {
    openaiApiKey: config?.openaiApiKey || process.env.PLASMO_PUBLIC_OPENAI_API_KEY,
    googleClientId: config?.googleClientId || process.env.PLASMO_PUBLIC_GOOGLE_CLIENT_ID,
    googleApiKey: config?.googleApiKey || process.env.PLASMO_PUBLIC_GOOGLE_API_KEY,
    googleSheetId: config?.googleSheetId || process.env.PLASMO_PUBLIC_GOOGLE_SHEET_ID
  }
}

/**
 * Save API configuration to storage
 */
export async function saveApiConfig(config: ApiConfig): Promise<void> {
  await storage.set('apiConfig', config)
}

/**
 * Clear API configuration from storage
 */
export async function clearApiConfig(): Promise<void> {
  await storage.remove('apiConfig')
}

/**
 * Check if API is configured
 */
export async function isApiConfigured(): Promise<boolean> {
  const config = await getApiConfig()
  return Boolean(
    config.openaiApiKey && config.googleClientId && config.googleApiKey && config.googleSheetId
  )
}

/**
 * Get last extraction stats
 */
export interface ExtractionStats {
  lastRun?: string
  totalEventsExtracted?: number
  lastCollectionId?: string
}

export async function getExtractionStats(): Promise<ExtractionStats> {
  return (await storage.get<ExtractionStats>('extractionStats')) || {}
}

export async function saveExtractionStats(stats: ExtractionStats): Promise<void> {
  await storage.set('extractionStats', stats)
}
