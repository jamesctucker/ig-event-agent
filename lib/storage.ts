import { Storage } from '@plasmohq/storage'

const storage = new Storage()

export interface ApiConfig {
  deepseekApiKey?: string
  googleSheetId?: string
}

/**
 * Get API configuration from storage.
 *
 * Secrets (DeepSeek key) are intentionally NOT read from PLASMO_PUBLIC_* env vars:
 * Plasmo inlines those into the bundle at build time, which would ship your key
 * inside the packaged zip. Secrets are entered at runtime via the Options page
 * and live only in chrome.storage.
 */
export async function getApiConfig(): Promise<ApiConfig> {
  const config = await storage.get<ApiConfig>('apiConfig')

  return {
    deepseekApiKey: config?.deepseekApiKey,
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
 * Check if the extension is configured well enough to run extraction.
 */
export async function isApiConfigured(): Promise<boolean> {
  const config = await getApiConfig()
  return Boolean(config.deepseekApiKey && config.googleSheetId)
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
