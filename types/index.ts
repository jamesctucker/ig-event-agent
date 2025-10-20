// Common type definitions

export interface Collection {
  id: string
  name: string
  url: string
}

export interface Post {
  imageUrl: string
  caption: string
  postUrl: string
  timestamp?: number
}

export interface ExtractedEvent {
  name?: string // Event name/title
  url?: string // Instagram post URL
  date?: string // Event date (MM/DD/YYYY format preferred)
  start?: string // Start time
  location?: string // Venue/location name
  organizer?: string // Event organizer/host
  cost?: string // Cost/price information
  summary?: string // Event description/summary
  imageUrl?: string // Instagram image URL (optional)
  caption?: string // Original Instagram caption (optional)
}

export interface EventInfo {
  hasEventInfo: boolean
  name?: string // Event name/title
  date?: string // Event date
  start?: string // Start time
  location?: string // Venue/location
  organizer?: string // Event organizer
  cost?: string // Cost information
  summary?: string // Event description
}

export interface Progress {
  current: number
  total: number
}

export interface ApiConfig {
  openaiApiKey?: string
  googleClientId?: string
  googleApiKey?: string
  googleSheetId?: string
}

export interface MessageResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Chrome extension message types
export type ChromeMessage =
  | { action: 'getCollections' }
  | { action: 'getPosts'; scrollCount: number }
  | { action: 'scrapePost'; postUrl: string }
  | { type: 'progress'; progress: Progress }
