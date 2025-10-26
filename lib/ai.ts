import OpenAI from 'openai'
import { getApiConfig } from './storage'

let openaiInstance: OpenAI | null = null

async function getOpenAI(): Promise<OpenAI> {
  if (openaiInstance) {
    return openaiInstance
  }

  const config = await getApiConfig()

  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  openaiInstance = new OpenAI({
    apiKey: config.openaiApiKey,
    dangerouslyAllowBrowser: true // Required for browser extension
  })

  return openaiInstance
}

interface EventInfo {
  hasEventInfo: boolean
  name?: string // Event name/title
  date?: string // Event date (MM/DD/YYYY format preferred)
  start?: string // Start time
  location?: string // Venue/location
  organizer?: string // Event organizer/host
  cost?: string // Cost/price (e.g., "Free", "$15", "Free (registration required)")
  summary?: string // Event description/summary (max 25 words)
}

/**
 * Analyze caption text to extract event information
 */
export async function analyzeCaption(
  caption: string,
  startDate?: string,
  endDate?: string
): Promise<EventInfo> {
  try {
    const openai = await getOpenAI()

    // Calculate the year from the date range to help with year-less dates
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear()

    const dateRangeText =
      startDate && endDate
        ? `\n\nDATE CONTEXT: We are looking for events between ${startDate} and ${endDate}. If a date doesn't include a year, assume it's ${year}. Only set hasEventInfo to true if the event date falls within this range.`
        : ''

    const prompt = `You are analyzing an Instagram post caption to extract event information. ONLY extract information that is EXPLICITLY stated in the text - DO NOT infer, guess, or calculate dates.

Caption: "${caption}"

Extract the following information ONLY if explicitly stated:
- Event name/title (must be clearly stated)
- Date (MUST be a specific date like "Nov 8", "November 8th", "11/8" - convert to MM/DD/YYYY format, assume ${year} if no year given)
- Start time (MUST be explicitly stated like "7pm", "7:00 PM", "7-9pm" - convert to "7:00:00 PM" format)
- Location/Venue name with full address if available
- Organizer/Host name
- Cost information (e.g., "Free", "$15")
- Summary/description of the event (MAX 25 WORDS - keep it concise and informative)${dateRangeText}

CRITICAL RULES:
1. DO NOT calculate or infer dates from relative references like "this Sunday", "tomorrow", "next week"
2. DO NOT invent or guess a start time - it must be explicitly stated in the text
3. ALWAYS extract name, location, organizer, summary, and cost if mentioned - even if there's no specific date/time
4. ONLY set hasEventInfo to true if you have: specific date (not "this Sunday"), start time, and location
5. If a date is mentioned without a year (e.g., "Nov 8th"), assume it's ${year}
6. Convert times to 12-hour format with AM/PM (e.g., "1-4pm" becomes "1:00:00 PM")

Respond in JSON format (ALWAYS fill in fields that are mentioned, even if hasEventInfo is false):
{
  "hasEventInfo": boolean,
  "name": "event name (extract even without date/time)",
  "date": "MM/DD/YYYY or null",
  "start": "start time or null",
  "location": "venue/location (extract even without date/time)",
  "organizer": "organizer name (extract even without date/time)",
  "cost": "cost information (extract even without date/time)",
  "summary": "event description (extract even without date/time)"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at extracting event information from social media posts. Extract ALL information that is explicitly mentioned (name, location, organizer, summary, cost), even if incomplete. ONLY set hasEventInfo to true when you have a specific date (not "this Sunday"), start time, and location. Never infer, calculate, or guess dates or times.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const result = response.choices[0]?.message?.content
    if (!result) {
      console.log('No result from OpenAI caption analysis')
      return { hasEventInfo: false }
    }

    const eventInfo: EventInfo = JSON.parse(result)
    console.log('Caption analysis result:', eventInfo)

    // Validate that if hasEventInfo is true, we have the required fields
    if (eventInfo.hasEventInfo && (!eventInfo.start || !eventInfo.date)) {
      console.log('⚠️ Event marked as incomplete: missing required date or start time')
      // Keep the extracted fields but mark as incomplete
      return { ...eventInfo, hasEventInfo: false }
    }

    return eventInfo
  } catch (error) {
    console.error('Error analyzing caption:', error)
    return { hasEventInfo: false }
  }
}

/**
 * Analyze image to extract event information using GPT-4 Vision
 * @param imageUrl - Can be a URL or base64 data URI
 */
export async function analyzeImage(
  imageUrl: string,
  startDate?: string,
  endDate?: string
): Promise<EventInfo> {
  try {
    const openai = await getOpenAI()

    // Calculate the year from the date range to help with year-less dates
    const year = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear()

    const dateRangeText =
      startDate && endDate
        ? `\n\nDATE CONTEXT: We are looking for events between ${startDate} and ${endDate}. If a date doesn't include a year, assume it's ${year}. Only set hasEventInfo to true if the event date falls within this range.`
        : ''

    const prompt = `Analyze this event flyer/poster image carefully and extract all visible event information. ONLY extract information that is clearly visible in the image - DO NOT guess or infer.

Extract the following information ONLY if clearly visible:
- Event name/title (must be visible on the flyer)
- Date (MUST be a specific date visible in the image - convert to MM/DD/YYYY format, assume ${year} if no year shown)
- Start time (MUST be clearly visible like "7pm", "7:00 PM" - convert to "7:00:00 PM" format)
- Location/Venue name with full address if visible
- Organizer/Host name
- Cost information (e.g., "Free", "$15")
- Summary/description of the event (MAX 25 WORDS - keep it concise and informative)

CRITICAL RULES:
1. DO NOT guess dates or times - they must be clearly readable in the image
2. ALWAYS extract name, location, organizer, summary, and cost if visible - even if date/time is missing
3. ONLY set hasEventInfo to true if you can see: specific date, start time, and location
4. If a date is shown without a year (e.g., "Nov 8th", "Saturday Nov 8"), assume it's ${year}
5. Convert times to 12-hour format with AM/PM (e.g., "1-4pm" becomes "1:00:00 PM")
6. Read ALL text carefully, including small print${dateRangeText}

Respond in JSON format (ALWAYS fill in visible fields, even if hasEventInfo is false):
{
  "hasEventInfo": boolean,
  "name": "event name (extract even without date/time)",
  "date": "MM/DD/YYYY or null",
  "start": "start time or null",
  "location": "venue with address (extract even without date/time)",
  "organizer": "organizer name (extract even without date/time)",
  "cost": "cost information (extract even without date/time)",
  "summary": "event description (extract even without date/time)"
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at extracting event information from images. Extract ALL information that is clearly visible (name, location, organizer, summary, cost), even if incomplete. ONLY set hasEventInfo to true when you can clearly see a specific date, start time, and location. Never guess or infer information that is not visible.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500
    })

    const result = response.choices[0]?.message?.content
    if (!result) {
      console.log('No result from OpenAI image analysis')
      return { hasEventInfo: false }
    }

    const eventInfo: EventInfo = JSON.parse(result)
    console.log('Image analysis result:', eventInfo)

    // Validate that if hasEventInfo is true, we have the required fields
    if (eventInfo.hasEventInfo && (!eventInfo.start || !eventInfo.date)) {
      console.log('⚠️ Event marked as incomplete: missing required date or start time')
      // Keep the extracted fields but mark as incomplete
      return { ...eventInfo, hasEventInfo: false }
    }

    return eventInfo
  } catch (error) {
    console.error('Error analyzing image:', error)
    return { hasEventInfo: false }
  }
}

/**
 * Batch analyze multiple images (for efficiency)
 */
export async function analyzeImagesBatch(imageUrls: string[]): Promise<EventInfo[]> {
  const results: EventInfo[] = []

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5
  for (let i = 0; i < imageUrls.length; i += batchSize) {
    const batch = imageUrls.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(url => analyzeImage(url)))
    results.push(...batchResults)

    // Small delay between batches
    if (i + batchSize < imageUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return results
}
