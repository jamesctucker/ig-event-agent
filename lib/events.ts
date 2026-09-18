/**
 * Shared event domain types and pure helpers.
 *
 * Single source of truth for:
 *  - the event completeness gate (date + start time + location)
 *  - caption/image merge strategy
 *  - Google Sheets row shape
 *
 * No Chrome/OpenAI imports here — this module is pure and unit-testable.
 */

export interface EventInfo {
  hasEventInfo: boolean
  name?: string // Event name/title
  date?: string // MM/DD/YYYY
  start?: string // e.g. "7:00:00 PM"
  location?: string // Venue/location
  organizer?: string
  cost?: string
  summary?: string // Max 25 words
}

export interface ExtractedEvent {
  name?: string
  url?: string // Instagram post URL
  date?: string
  start?: string
  location?: string
  organizer?: string
  cost?: string
  summary?: string
  imageUrl?: string
  caption?: string
}

/** Result of a single AI analysis call — error status is distinct from "no event found". */
export type AnalysisResult =
  | { status: 'ok'; info: EventInfo }
  | {
      status: 'error'
      kind: 'auth' | 'billing' | 'rate-limit' | 'api' | 'parse' | 'unexpected'
      message: string
    }

/**
 * An event is complete only with a specific date, a start time, AND a location.
 * (README "Event Completion Requirements" — all three, not date/time + (name OR location).)
 */
export function isCompleteEvent(
  info: Pick<EventInfo, 'date' | 'start' | 'location'>
): boolean {
  return Boolean(info.date && info.start && info.location)
}

/** Re-stamp hasEventInfo using the single completeness gate. */
export function withCompleteness<T extends Partial<EventInfo>>(
  info: T
): T & { hasEventInfo: boolean } {
  return {
    ...info,
    hasEventInfo: isCompleteEvent({
      date: info.date,
      start: info.start,
      location: info.location
    })
  }
}

/**
 * Merge caption and image analysis.
 *
 * - Image wins structured data (date/start/location) — more reliable from flyers.
 * - Caption wins descriptive data (name/organizer/summary) — usually better written.
 * - Partial data from both sides can combine into a complete event.
 * - Single-source results are re-stamped through the same completeness gate,
 *   so an image-only event with date+time but no location is correctly incomplete.
 */
export function mergeEventInfo(
  captionInfo: EventInfo | null | undefined,
  imageInfo: EventInfo | null | undefined
): EventInfo {
  if (!captionInfo && !imageInfo) {
    return { hasEventInfo: false }
  }
  if (!captionInfo) {
    return withCompleteness({ ...(imageInfo as EventInfo) })
  }
  if (!imageInfo) {
    return withCompleteness({ ...captionInfo })
  }

  const merged = {
    // Prefer caption name (usually better written), else image
    name: captionInfo.name || imageInfo.name,
    // Prefer image for structured data (more reliable from flyers)
    date: imageInfo.date || captionInfo.date,
    start: imageInfo.start || captionInfo.start,
    location: imageInfo.location || captionInfo.location,
    // Caption for organizer (often mentioned in text)
    organizer: captionInfo.organizer || imageInfo.organizer,
    // Either for cost
    cost: captionInfo.cost || imageInfo.cost,
    // Caption summary (usually more descriptive)
    summary: captionInfo.summary || imageInfo.summary
  }

  return withCompleteness(merged)
}

// ---------------------------------------------------------------------------
// Google Sheets row shape (mirrors sustainable_events.csv)
// ---------------------------------------------------------------------------

export const SHEET_HEADERS = [
  'Name',
  'URL',
  'Date',
  'Start',
  'Location',
  'Organizer',
  'Cost',
  'Summary'
] as const

/** Map events to sheet rows in SHEET_HEADERS column order. */
export function buildSheetRows(events: ExtractedEvent[]): string[][] {
  return events.map(event => [
    event.name || '',
    event.url || '', // URL (Instagram post)
    event.date || '',
    event.start || '',
    event.location || '',
    event.organizer || '',
    event.cost || '',
    event.summary || ''
  ])
}

/**
 * Split events into new vs already-present (dedup by Instagram post URL).
 * Events with no URL are always treated as new — hand-edited entries have
 * nothing to dedup against and we never want to silently drop them.
 */
export function splitNewEvents(
  events: ExtractedEvent[],
  existingUrls: ReadonlySet<string>
): { fresh: ExtractedEvent[]; skipped: ExtractedEvent[] } {
  const fresh: ExtractedEvent[] = []
  const skipped: ExtractedEvent[] = []
  for (const event of events) {
    if (event.url && existingUrls.has(event.url.trim())) {
      skipped.push(event)
    } else {
      fresh.push(event)
    }
  }
  return { fresh, skipped }
}
