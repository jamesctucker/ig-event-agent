import type { PlasmoMessaging } from '@plasmohq/messaging'
import { saveEventsToGoogleSheets } from '~lib/googleSheets'

interface Event {
  name?: string
  url?: string
  date?: string
  start?: string
  location?: string
  organizer?: string
  cost?: string
  summary?: string
  imageUrl?: string
}

interface SaveToSheetsRequest {
  events: Event[]
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

    // Save to Google Sheets
    const result = await saveEventsToGoogleSheets(events)

    if (result.success) {
      res.send({
        success: true,
        message: `Successfully saved ${events.length} events to Google Sheets`
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
