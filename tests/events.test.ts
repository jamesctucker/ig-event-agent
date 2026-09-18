import { describe, it, expect } from 'vitest'
import {
  buildSheetRows,
  isCompleteEvent,
  mergeEventInfo,
  SHEET_HEADERS,
  splitNewEvents,
  withCompleteness,
  type EventInfo
} from '../lib/events'

describe('isCompleteEvent', () => {
  it('requires date + start + location (all three)', () => {
    expect(
      isCompleteEvent({ date: '11/08/2026', start: '7:00:00 PM', location: 'The Capri' })
    ).toBe(true)
  })

  it('rejects missing location even with date and start present', () => {
    expect(isCompleteEvent({ date: '11/08/2026', start: '7:00:00 PM', location: undefined })).toBe(
      false
    )
  })

  it('rejects missing start time', () => {
    expect(isCompleteEvent({ date: '11/08/2026', start: '', location: 'The Capri' })).toBe(false)
  })

  it('rejects missing date', () => {
    expect(isCompleteEvent({ date: undefined, start: '7:00:00 PM', location: 'The Capri' })).toBe(
      false
    )
  })
})

describe('withCompleteness', () => {
  it('downgrades hasEventInfo when fields go missing', () => {
    const input: EventInfo = {
      hasEventInfo: true,
      date: '11/08/2026',
      start: '7:00:00 PM'
      // no location
    }
    expect(withCompleteness(input).hasEventInfo).toBe(false)
  })
})

describe('mergeEventInfo', () => {
  it('returns hasEventInfo:false when both sources are absent', () => {
    expect(mergeEventInfo(null, null).hasEventInfo).toBe(false)
    expect(mergeEventInfo(undefined, undefined).hasEventInfo).toBe(false)
  })

  it('image wins structured data (date/start/location); caption wins descriptive (name/organizer/summary)', () => {
    const caption: EventInfo = {
      hasEventInfo: false,
      name: 'Caption Name',
      organizer: 'Caption Org',
      summary: 'Caption summary',
      cost: '$10'
    }
    const image: EventInfo = {
      hasEventInfo: false,
      name: 'Image Name',
      date: '11/08/2026',
      start: '7:00:00 PM',
      location: 'The Capri Theater',
      organizer: 'Image Org',
      summary: 'Image summary'
    }
    const merged = mergeEventInfo(caption, image)
    expect(merged.name).toBe('Caption Name')
    expect(merged.organizer).toBe('Caption Org')
    expect(merged.summary).toBe('Caption summary')
    expect(merged.cost).toBe('$10')
    expect(merged.date).toBe('11/08/2026')
    expect(merged.start).toBe('7:00:00 PM')
    expect(merged.location).toBe('The Capri Theater')
    expect(merged.hasEventInfo).toBe(true)
  })

  it('partial data from both sides can combine into a complete event', () => {
    const caption: EventInfo = { hasEventInfo: false, location: 'Lake Harriet Upper' }
    const image: EventInfo = { hasEventInfo: false, date: '11/08/2026', start: '6:30:00 PM' }
    const merged = mergeEventInfo(caption, image)
    expect(merged.hasEventInfo).toBe(true)
  })

  it('single-source result is re-stamped through the completeness gate (location required)', () => {
    // Regression: prior code returned the single source as-is, so an image with
    // date+start but no location slipped through as a complete event.
    const imageNoLocation: EventInfo = {
      hasEventInfo: true, // per old date+start-only rule
      date: '11/08/2026',
      start: '7:00:00 PM'
    }
    expect(mergeEventInfo(null, imageNoLocation).hasEventInfo).toBe(false)
  })

  it('single-source complete event stays complete', () => {
    const caption: EventInfo = {
      hasEventInfo: true,
      date: '11/08/2026',
      start: '7:00:00 PM',
      location: 'The Capri'
    }
    const merged = mergeEventInfo(caption, null)
    expect(merged.hasEventInfo).toBe(true)
    expect(merged.location).toBe('The Capri')
  })
})

describe('sheet row mapping', () => {
  it('maps events into SHEET_HEADERS column order', () => {
    expect(SHEET_HEADERS).toEqual([
      'Name',
      'URL',
      'Date',
      'Start',
      'Location',
      'Organizer',
      'Cost',
      'Summary'
    ])
    const rows = buildSheetRows([
      {
        name: 'Mayoral Forum',
        url: 'https://www.instagram.com/p/ABC123/',
        date: '10/15/2026',
        start: '5:00:00 PM',
        location: 'The Capri Theater',
        organizer: 'AALF',
        cost: 'Free',
        summary: 'Civic forum'
      }
    ])
    expect(rows).toEqual([
      [
        'Mayoral Forum',
        'https://www.instagram.com/p/ABC123/',
        '10/15/2026',
        '5:00:00 PM',
        'The Capri Theater',
        'AALF',
        'Free',
        'Civic forum'
      ]
    ])
  })

  it('fills missing fields with empty strings', () => {
    const rows = buildSheetRows([{ name: 'Only Name' }])
    expect(rows).toEqual([['Only Name', '', '', '', '', '', '', '']])
  })
})

describe('splitNewEvents (dedup by post URL)', () => {
  const events = [
    { name: 'A', url: 'https://www.instagram.com/p/AAA/' },
    { name: 'B', url: 'https://www.instagram.com/p/BBB/' },
    { name: 'C' } // no URL — hand-entered, never deduped
  ]

  it('skips events whose URL is already in the sheet', () => {
    const existing = new Set(['https://www.instagram.com/p/AAA/'])
    const { fresh, skipped } = splitNewEvents(events, existing)
    expect(fresh.map(e => e.name)).toEqual(['B', 'C'])
    expect(skipped.map(e => e.name)).toEqual(['A'])
  })

  it('keeps everything when the sheet has no URLs yet', () => {
    const { fresh, skipped } = splitNewEvents(events, new Set())
    expect(fresh).toHaveLength(3)
    expect(skipped).toHaveLength(0)
  })
})
