import type { PlasmoMessaging } from '@plasmohq/messaging'
import { saveEventsToGoogleSheets } from '~lib/googleSheets'
import type { ExtractedEvent } from '~lib/events'

interface SaveToSheetsRequest {
  events: ExtractedEvent[]
}

const handler: PlasmoMessaging.MessageHandler<SaveToSheetsRequest> = async (req, res) => {
  try {
    const { events } = req.body as SaveToSheetsRequest

    if (!events || events.length === 0) {
      return res.send({
        success: false,
        error: 'No events to save'
      })
    }

    // Save to Google Sheets (initializes headers, dedups by post URL, appends to first tab)
    const result = await saveEventsToGoogleSheets(events)

    if (result.success) {
      const parts = []
      parts.push(`Saved ${result.saved ?? events.length} event${(result.saved ?? events.length) !== 1 ? 's' : ''}`)
      if (result.skipped) {
        parts.push(`skipped ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''}`)
      }
      res.send({
        success: true,
        message: parts.join(', ')
      })
    } else {
      res.send({
        success: false,
        error: result.error || 'Failed to save to Google Sheets'
      })
    }
  } catch (error) {
    console.error('Error saving to sheets:', error)
    res.send({
      success: false,
      error: (error as Error).message || 'Failed to save to Google Sheets'
    })
  }
}

export default handler
