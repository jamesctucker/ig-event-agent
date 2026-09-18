import OpenAI from 'openai'
import type { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions'
import { getApiConfig } from './storage'
import type { AnalysisResult, EventInfo } from './events'
import { withCompleteness } from './events'

/**
 * DeepSeek official API client (OpenAI-compatible).
 * Docs: https://api-docs.deepseek.com
 *
 * Model: deepseek-flash (DeepSeek-V4.1-Flash) — the only official DeepSeek model
 * with vision support. JSON output supported via response_format: json_object.
 *
 * Thinking mode is explicitly DISABLED (extra_body.thinking.type): it is on by
 * default, ignores temperature, and adds latency/cost per call — wrong tradeoffs
 * for deterministic structured extraction at 2 calls per post.
 */
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-flash'

let deepseekInstance: OpenAI | null = null

async function getDeepSeek(): Promise<OpenAI> {
  if (deepseekInstance) {
    return deepseekInstance
  }

  const config = await getApiConfig()

  if (!config.deepseekApiKey) {
    throw new Error('DeepSeek API key not configured')
  }

  deepseekInstance = new OpenAI({
    apiKey: config.deepseekApiKey,
    baseURL: DEEPSEEK_BASE_URL,
    dangerouslyAllowBrowser: true // Required for browser extension
  })

  return deepseekInstance
}

/**
 * DeepSeek docs call for `thinking: { type: 'disabled' }` in the request body
 * (thinking mode is ON by default; it ignores temperature and adds latency/cost —
 * wrong tradeoffs for deterministic structured extraction at 2 calls per post).
 * The openai-node 4.x SDK serializes the create() params object as-is, so unknown
 * top-level fields are passed through to the JSON body.
 */
const DEEPSEEK_EXTRA_PARAMS = { thinking: { type: 'disabled' } }

/**
 * Classify a DeepSeek SDK error into a kind the caller can act on.
 * Auth/billing/rate-limit failures are systemic and must never be mistaken for
 * "no event found". (402 = insufficient balance per DeepSeek error codes.)
 */
function classifyDeepSeekError(error: unknown): {
  kind: 'auth' | 'billing' | 'rate-limit' | 'api'
  message: string
} {
  const anyErr = error as { status?: number; message?: string }
  const status = anyErr?.status
  const message = anyErr?.message || 'Unknown DeepSeek error'

  if (status === 401 || status === 403) {
    return {
      kind: 'auth',
      message: `DeepSeek authentication failed (${status}): check your API key in Options.`
    }
  }
  if (status === 402) {
    return {
      kind: 'billing',
      message: 'DeepSeek account balance is insufficient (402). Top up at platform.deepseek.com.'
    }
  }
  if (status === 429) {
    return { kind: 'rate-limit', message: 'DeepSeek rate limit hit (429). Wait a moment and retry.' }
  }
  return { kind: 'api', message: `DeepSeek request failed${status ? ` (${status})` : ''}: ${message}` }
}

/** Parse and structurally validate the JSON body of a DeepSeek response. */
function parseEventInfoJson(result: string, sourceLabel: string): EventInfo | null {
  try {
    const eventInfo = JSON.parse(result) as EventInfo
    if (!eventInfo || typeof eventInfo.hasEventInfo !== 'boolean') {
      throw new Error('Invalid response structure: missing or invalid hasEventInfo field')
    }
    return eventInfo
  } catch (error) {
    console.error(`Failed to parse AI ${sourceLabel} response:`, result, error)
    return null
  }
}

/**
 * Analyze caption text to extract event information.
 * Returns { status: 'ok' } even when the caption contains no event — a non-ok
 * status means the analysis itself failed and must be surfaced to the user.
 */
export async function analyzeCaption(
  caption: string,
  startDate?: string,
  endDate?: string
): Promise<AnalysisResult> {
  try {
    const client = await getDeepSeek()

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
- Summary/description of the event (MAX 25 WORDS - write in an engaging, newsletter-style tone that would appeal to local community readers)${dateRangeText}

CRITICAL RULES:
1. DO NOT calculate or infer dates from relative references like "this Sunday", "tomorrow", "next week"
2. DO NOT invent or guess a start time - it must be explicitly stated in the text
3. ALWAYS extract name, location, organizer, summary, and cost if mentioned - even if there's no specific date/time
4. ONLY set hasEventInfo to true if you have: specific date (not "this Sunday"), start time, and location
5. If a date is mentioned without a year (e.g., "Nov 8th"), assume it's ${year}
6. Convert times to 12-hour format with AM/PM (e.g., "1-4pm" becomes "1:00:00 PM")
7. For summaries: Write in an engaging, community-focused tone that would appeal to local newsletter readers - use active voice, highlight what makes the event special, and make it sound exciting and worth attending

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

    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at extracting event information from social media posts. Extract ALL information that is explicitly mentioned (name, location, organizer, summary, cost), even if incomplete. ONLY set hasEventInfo to true when you have a specific date (not "this Sunday"), start time, and location. Never infer, calculate, or guess dates or times. For summaries, write in an engaging, newsletter-style tone that would appeal to local community readers - use active voice, highlight what makes the event special, and make it sound exciting and worth attending.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      ...DEEPSEEK_EXTRA_PARAMS
      // Cast: the SDK serializes the body as-is, so deepseek-specific fields reach
      // the wire; the OpenAI typings just don't know about them.
    } as ChatCompletionCreateParamsNonStreaming)

    const result = response.choices[0]?.message?.content
    if (!result) {
      // DeepSeek JSON mode docs warn it can occasionally return empty content
      console.warn('No result from DeepSeek caption analysis')
      return {
        status: 'error',
        kind: 'api',
        message: 'DeepSeek returned an empty response for caption analysis'
      }
    }

    const parsed = parseEventInfoJson(result, 'caption')
    if (!parsed) {
      return {
        status: 'error',
        kind: 'parse',
        message: 'DeepSeek caption response was not valid JSON'
      }
    }
    console.log('Caption analysis result:', parsed)

    // Re-stamp hasEventInfo through the single completeness gate (date + start + location);
    // keep partial fields even when the event is incomplete so they can merge with the image side.
    return { status: 'ok', info: withCompleteness(parsed) }
  } catch (error) {
    console.error('Error analyzing caption:', error)
    const { kind, message } = classifyDeepSeekError(error)
    return { status: 'error', kind, message }
  }
}

/**
 * Analyze image to extract event information using DeepSeek vision.
 * @param imageUrl - Base64 data URI (Instagram CDN requires auth, so we always
 *                   convert to base64 first — see extractEvents.ts)
 */
export async function analyzeImage(
  imageUrl: string,
  startDate?: string,
  endDate?: string
): Promise<AnalysisResult> {
  try {
    const client = await getDeepSeek()

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
- Summary/description of the event (MAX 25 WORDS - write in an engaging, newsletter-style tone that would appeal to local community readers)

CRITICAL RULES:
1. DO NOT guess dates or times - they must be clearly readable in the image
2. ALWAYS extract name, location, organizer, summary, and cost if visible - even if date/time is missing
3. ONLY set hasEventInfo to true if you can see: specific date, start time, and location
4. If a date is shown without a year (e.g., "Nov 8th", "Saturday Nov 8"), assume it's ${year}
5. Convert times to 12-hour format with AM/PM (e.g., "1-4pm" becomes "1:00:00 PM")
6. Read ALL text carefully, including small print
7. For summaries: Write in an engaging, community-focused tone that would appeal to local newsletter readers - use active voice, highlight what makes the event special, and make it sound exciting and worth attending${dateRangeText}

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

    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at extracting event information from images. Extract ALL information that is clearly visible (name, location, organizer, summary, cost), even if incomplete. ONLY set hasEventInfo to true when you can clearly see a specific date, start time, and location. Never guess or infer information that is not visible. For summaries, write in an engaging, newsletter-style tone that would appeal to local community readers - use active voice, highlight what makes the event special, and make it sound exciting and worth attending.'
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
      max_tokens: 500,
      ...DEEPSEEK_EXTRA_PARAMS
      // Cast: the SDK serializes the body as-is, so deepseek-specific fields reach
      // the wire; the OpenAI typings just don't know about them.
    } as ChatCompletionCreateParamsNonStreaming)

    const result = response.choices[0]?.message?.content
    if (!result) {
      console.warn('No result from DeepSeek image analysis')
      return {
        status: 'error',
        kind: 'api',
        message: 'DeepSeek returned an empty response for image analysis'
      }
    }

    const parsed = parseEventInfoJson(result, 'image')
    if (!parsed) {
      return {
        status: 'error',
        kind: 'parse',
        message: 'DeepSeek image response was not valid JSON'
      }
    }
    console.log('Image analysis result:', parsed)

    // Same completeness gate as the caption path (date + start + location);
    // partial fields are kept so they can merge with the caption side.
    return { status: 'ok', info: withCompleteness(parsed) }
  } catch (error) {
    console.error('Error analyzing image:', error)
    const { kind, message } = classifyDeepSeekError(error)
    return { status: 'error', kind, message }
  }
}
