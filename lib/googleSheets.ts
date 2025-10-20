import { getApiConfig } from './storage'

interface Event {
  name?: string // Event name/title
  url?: string // Instagram post URL
  date?: string // Event date
  start?: string // Start time
  location?: string // Venue/location
  organizer?: string // Event organizer
  cost?: string // Cost/price
  summary?: string // Event description/summary
  imageUrl?: string // Instagram image URL (optional)
}

interface SaveResult {
  success: boolean
  error?: string
}

/**
 * Save events to Google Sheets using the Google Sheets API
 */

export async function saveEventsToGoogleSheets(events: Event[]): Promise<SaveResult> {
  try {
    const config = await getApiConfig()
    const sheetId = config.googleSheetId

    if (!sheetId) {
      throw new Error('Google Sheet ID not configured')
    }

    // First, authenticate with Google (using OAuth2)
    const token = await getGoogleAuthToken()

    if (!token) {
      throw new Error('Failed to authenticate with Google')
    }

    // Prepare the data rows to match sustainable_events.csv structure
    const rows = events.map(event => [
      event.name || '', // Name
      event.url || '', // URL (Instagram post)
      event.date || '', // Date
      event.start || '', // Start (time)
      event.location || '', // Location
      event.organizer || '', // Organizer
      event.cost || '', // Cost
      event.summary || '' // Summary
    ])

    // Append to the sheet
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to save to Google Sheets: ${error}`)
    }

    return { success: true }
  } catch (error) {
    console.error('Error saving to Google Sheets:', error)
    return {
      success: false,
      error: (error as Error).message || 'Failed to save to Google Sheets'
    }
  }
}

/**
 * Get Google OAuth token
 */
async function getGoogleAuthToken(): Promise<string | null> {
  try {
    // Use Chrome Identity API to get OAuth token
    const token = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, token => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message || 'Unknown error')
        } else {
          resolve(token || '')
        }
      })
    })

    return token
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

/**
 * Initialize Google Sheets (create headers if needed)
 */
export async function initializeGoogleSheet(): Promise<SaveResult> {
  try {
    const config = await getApiConfig()
    const sheetId = config.googleSheetId

    if (!sheetId) {
      throw new Error('Google Sheet ID not configured')
    }

    const token = await getGoogleAuthToken()

    if (!token) {
      throw new Error('Failed to authenticate with Google')
    }

    // Check if headers exist
    const getResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    )

    const data = await getResponse.json()

    // If no data, add headers matching sustainable_events.csv
    if (!data.values || data.values.length === 0) {
      const headers = [['Name', 'URL', 'Date', 'Start', 'Location', 'Organizer', 'Cost', 'Summary']]

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: headers
          })
        }
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Error initializing Google Sheet:', error)
    return {
      success: false,
      error: (error as Error).message || 'Failed to initialize Google Sheet'
    }
  }
}

/**
 * Test Google Sheets connection
 */
export async function testGoogleSheetsConnection(): Promise<boolean> {
  try {
    const config = await getApiConfig()
    const sheetId = config.googleSheetId

    if (!sheetId) {
      return false
    }

    const token = await getGoogleAuthToken()

    if (!token) {
      return false
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    return response.ok
  } catch (error) {
    console.error('Error testing Google Sheets connection:', error)
    return false
  }
}
