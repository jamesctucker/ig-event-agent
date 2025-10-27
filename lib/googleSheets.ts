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
 * Validate if a Google OAuth token is still valid
 */
async function validateGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`
    )
    return response.ok
  } catch {
    return false
  }
}

/**
 * Make a Google Sheets API call with automatic token refresh on 401
 */
async function callGoogleSheetsAPI(endpoint: string, options: RequestInit): Promise<Response> {
  let currentToken = await getGoogleAuthToken()

  if (!currentToken) {
    throw new Error('Failed to authenticate with Google')
  }

  // First attempt with current token
  let response = await fetch(endpoint, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${currentToken}` }
  })

  // If 401 (Unauthorized), attempt to refresh token and retry
  if (response.status === 401) {
    console.warn('⚠️ Google token expired (401), attempting to re-authenticate...')
    const newToken = await getGoogleAuthToken() // Force re-auth

    if (!newToken) {
      throw new Error('Failed to re-authenticate with Google')
    }

    // Retry the request with new token
    response = await fetch(endpoint, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${newToken}` }
    })
  }

  return response
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

    // Append to the sheet using API wrapper with auto-retry on 401
    const response = await callGoogleSheetsAPI(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: rows
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      if (response.status === 401) {
        throw new Error(
          'Google authentication failed. Please re-authenticate in the extension options.'
        )
      }
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

    // Check if headers exist using API wrapper with auto-retry on 401
    const getResponse = await callGoogleSheetsAPI(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1`,
      {
        method: 'GET',
        headers: {}
      }
    )

    if (!getResponse.ok) {
      if (getResponse.status === 401) {
        throw new Error(
          'Google authentication failed. Please re-authenticate in the extension options.'
        )
      }
      throw new Error(`Failed to read sheet: ${await getResponse.text()}`)
    }

    const data = await getResponse.json()

    // If no data, add headers matching sustainable_events.csv
    if (!data.values || data.values.length === 0) {
      const headers = [['Name', 'URL', 'Date', 'Start', 'Location', 'Organizer', 'Cost', 'Summary']]

      const putResponse = await callGoogleSheetsAPI(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:H1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: headers
          })
        }
      )

      if (!putResponse.ok) {
        if (putResponse.status === 401) {
          throw new Error(
            'Google authentication failed. Please re-authenticate in the extension options.'
          )
        }
        throw new Error(`Failed to initialize sheet: ${await putResponse.text()}`)
      }
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

    const response = await callGoogleSheetsAPI(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`,
      {
        method: 'GET',
        headers: {}
      }
    )

    return response.ok
  } catch (error) {
    console.error('Error testing Google Sheets connection:', error)
    return false
  }
}
