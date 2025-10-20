interface Post {
  imageUrl: string
  caption: string
  postUrl: string
  timestamp?: number
}

/**
 * Filter posts by date range
 * Note: Instagram doesn't always provide timestamps directly, so we may need to estimate
 */
export function filterPostsByDateRange(posts: Post[], startDate: string, endDate: string): Post[] {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()

  return posts.filter(post => {
    if (!post.timestamp) {
      // If no timestamp available, include all posts
      // The AI will check the content for date information
      return true
    }

    return post.timestamp >= start && post.timestamp <= end
  })
}

/**
 * Extract timestamp from Instagram post URL or shortcode
 */
export function extractTimestampFromPost(shortcode: string): number | null {
  // Instagram shortcodes are base64-like encodings that include timestamp info
  // This is a simplified version - actual implementation may need adjustment
  try {
    // Instagram's encoding is complex, so for now we return null
    // In a real implementation, you might need to fetch the post's metadata
    return null
  } catch (error) {
    return null
  }
}

/**
 * Parse date from various formats
 */
export function parseFlexibleDate(dateStr: string): Date | null {
  if (!dateStr) return null

  try {
    // Try standard parsing first
    let date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date
    }

    // Try various formats
    const formats = [
      // MM/DD/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // DD-MM-YYYY
      /(\d{1,2})-(\d{1,2})-(\d{4})/,
      // Month DD, YYYY
      /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})/i
    ]

    for (const format of formats) {
      const match = dateStr.match(format)
      if (match) {
        if (match.length === 4) {
          if (isNaN(Number(match[1]))) {
            // Month name format
            const monthNames = [
              'january',
              'february',
              'march',
              'april',
              'may',
              'june',
              'july',
              'august',
              'september',
              'october',
              'november',
              'december'
            ]
            const month = monthNames.indexOf(match[1].toLowerCase())
            date = new Date(Number(match[3]), month, Number(match[2]))
          } else {
            // Numeric format
            date = new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]))
          }

          if (!isNaN(date.getTime())) {
            return date
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error parsing date:', error)
    return null
  }
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (isNaN(d.getTime())) {
    return 'Invalid date'
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Validate event data
 */
export function validateEvent(event: any): boolean {
  // An event must have at least a date/time and location
  return Boolean((event.date || event.time) && (event.location || event.address))
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\r\n]+/g, ' ') // Remove line breaks
}

/**
 * Extract URL from text
 */
export function extractUrl(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const match = text.match(urlRegex)
  return match ? match[0] : null
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error('Retry failed')
}
