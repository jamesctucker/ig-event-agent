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
  summary?: string // Event description/summary
}

/**
 * Analyze caption text to extract event information
 */
export async function analyzeCaption(caption: string): Promise<EventInfo> {
  try {
    const openai = await getOpenAI()

    const prompt = `Analyze the following Instagram post caption and extract event information if present.

Caption: "${caption}"

Extract the following information if available:
- Event name/title
- Date (in format MM/DD/YYYY if possible)
- Start time (e.g., "7:00:00 PM", "6:30:00 PM")
- Location/Venue name with address if available
- Organizer/Host name
- Cost information (e.g., "Free", "$15", "Free (registration required)", "$10-$15 suggested donation")
- Summary/description of the event

Respond in JSON format:
{
  "hasEventInfo": boolean,
  "name": "event name",
  "date": "MM/DD/YYYY",
  "start": "start time",
  "location": "venue/location with address",
  "organizer": "organizer name",
  "cost": "cost information",
  "summary": "event description"
}

Only set hasEventInfo to true if there is clearly event information (at minimum: date and location). Return null for fields that aren't found.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at extracting event information from social media posts. You identify dates, times, locations, and event details with high accuracy.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })

    const result = response.choices[0]?.message?.content
    if (!result) {
      return { hasEventInfo: false }
    }

    const eventInfo: EventInfo = JSON.parse(result)
    return eventInfo
  } catch (error) {
    console.error('Error analyzing caption:', error)
    return { hasEventInfo: false }
  }
}

/**
 * Analyze image to extract event information using GPT-4 Vision
 */
export async function analyzeImage(imageUrl: string): Promise<EventInfo> {
  try {
    const openai = await getOpenAI()

    const prompt = `Analyze this image and extract any event information visible in the image.

Look for:
- Event name/title
- Date (extract in format MM/DD/YYYY if possible)
- Start time (e.g., "7:00:00 PM")
- Location/Venue name with full address
- Organizer/Host name
- Cost/price information
- Event description or summary

This might be a flyer, poster, or screenshot containing event information.

Respond in JSON format:
{
  "hasEventInfo": boolean,
  "name": "event name",
  "date": "MM/DD/YYYY",
  "start": "start time",
  "location": "venue with address",
  "organizer": "organizer name",
  "cost": "cost information",
  "summary": "event description"
}

Only set hasEventInfo to true if there is clearly event information visible. Return null for fields that aren't found.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // GPT-4 Turbo with Vision
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at extracting event information from images. You can read flyers, posters, and screenshots to identify dates, times, locations, and event details with high accuracy.'
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
      temperature: 0.1,
      max_tokens: 500
    })

    const result = response.choices[0]?.message?.content
    if (!result) {
      return { hasEventInfo: false }
    }

    const eventInfo: EventInfo = JSON.parse(result)
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
