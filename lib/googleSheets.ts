import { getApiConfig } from './storage'
import {
  buildSheetRows,
  SHEET_HEADERS,
  splitNewEvents,
  type ExtractedEvent
} from './events'

interface SaveResult {
  success: boolean
  error?: string
  saved?: number
  skipped?: number
}

/**
 * Get Google OAuth token via Chrome Identity API.
 * Note: chrome.identity caches tokens, so a 401 must be paired with
 * removeCachedAuthToken before re-requesting — see callGoogleSheetsAPI.
 */
async function getGoogleAuthToken(): Promise<string | null> {
  try {
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

/** Drop a cached token so the next getAuthToken issues a fresh grant. */
async function removeCachedGoogleAuthToken(token: string): Promise<void> {
  await new Promise<void>(resolve => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
}

/**
 * Make a Google Sheets API call with automatic token refresh on 401.
 * On 401 the cached token is REMOVED first — otherwise getAuthToken hands
 * back the same dead token and the retry is guaranteed to fail again.
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

  // If 401 (Unauthorized), invalidate the cached token, re-authenticate, retry once
  if (response.status === 401) {
    console.warn('⚠️ Google token rejected (401), clearing cache and re-authenticating...')
    await removeCachedGoogleAuthToken(currentToken)
    const newToken = await getGoogleAuthToken()

    if (!newToken) {
      throw new Error('Failed to re-authenticate with Google')
    }

    response = await fetch(endpoint, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${newToken}` }
    })
  }

  return response
}

/**
 * Resolve the title of the spreadsheet's first sheet (tab).
 * Ranges reference the tab by name, and users rename tabs — never assume "Sheet1".
 */
async function getFirstSheetTitle(sheetId: string): Promise<string> {
  const response = await callGoogleSheetsAPI(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { method: 'GET', headers: {} }
  )

  if (!response.ok) {
    throw new Error(`Failed to read spreadsheet metadata: ${await response.text()}`)
  }

  const data = await response.json()
  const title = data?.sheets?.[0]?.properties?.title
  if (!title || typeof title !== 'string') {
    throw new Error('Spreadsheet has no sheets')
  }
  return title
}

/** Quote a tab title for use in an A1-style range (handles spaces and apostrophes). */
function rangeFor(sheetTitle: string, suffix: string): string {
  return `'${sheetTitle.replace(/'/g, "''")}'!${suffix}`
}

/**
 * Initialize the sheet with the header row if it's empty.
 * Called at the top of every save so a fresh spreadsheet always gets headers.
 */
export async function initializeGoogleSheet(): Promise<SaveResult> {
  try {
    const config = await getApiConfig()
    const sheetId = config.googleSheetId

    if (!sheetId) {
      throw new Error('Google Sheet ID not configured')
    }

    const sheetTitle = await getFirstSheetTitle(sheetId)

    const getResponse = await callGoogleSheetsAPI(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
        rangeFor(sheetTitle, 'A1:H1')
      )}`,
      { method: 'GET', headers: {} }
    )

    if (!getResponse.ok) {
      throw new Error(`Failed to read sheet: ${await getResponse.text()}`)
    }

    const data = await getResponse.json()

    // If no data, add headers matching sustainable_events.csv
    if (!data.values || data.values.length === 0) {
      const putResponse = await callGoogleSheetsAPI(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
          rangeFor(sheetTitle, 'A1:H1')
        )}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [Array.from(SHEET_HEADERS)]
          })
        }
      )

      if (!putResponse.ok) {
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
 * Collect the Instagram post URLs already present in the sheet (column B)
 * so re-saving a collection doesn't append duplicates.
 */
async function getExistingPostUrls(sheetId: string, sheetTitle: string): Promise<Set<string>> {
  const response = await callGoogleSheetsAPI(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      rangeFor(sheetTitle, 'B:B')
    )}`,
    { method: 'GET', headers: {} }
  )

  const urls = new Set<string>()
  if (response.ok) {
    const data = await response.json()
    for (const row of data.values || []) {
      const value = (row?.[0] || '').trim()
      if (value) urls.add(value)
    }
  } else {
    // A failure here must not block saving — worst case is duplicates, not lost data.
    console.warn('⚠️ Could not read existing URLs for dedup; appending without dedup')
  }
  return urls
}

/**
 * Save events to Google Sheets.
 * Pipeline: resolve tab title → ensure headers → dedup by post URL → append.
 */
export async function saveEventsToGoogleSheets(events: ExtractedEvent[]): Promise<SaveResult> {
  try {
    const config = await getApiConfig()
    const sheetId = config.googleSheetId

    if (!sheetId) {
      throw new Error('Google Sheet ID not configured')
    }

    // Resolve the first tab's real name — ranges break if the user renamed it
    const sheetTitle = await getFirstSheetTitle(sheetId)

    // Headers first, so a brand-new spreadsheet never gets headerless rows
    const initResult = await initializeGoogleSheet()
    if (!initResult.success) {
      throw new Error(initResult.error || 'Failed to initialize Google Sheet')
    }

    // Skip events whose post URL is already in the sheet
    const existingUrls = await getExistingPostUrls(sheetId, sheetTitle)
    const { fresh, skipped } = splitNewEvents(events, existingUrls)

    if (skipped.length > 0) {
      console.log(`⏭️ Skipping ${skipped.length} duplicate event(s) already in the sheet`)
    }

    if (fresh.length === 0) {
      return { success: true, saved: 0, skipped: skipped.length }
    }

    const rows = buildSheetRows(fresh)

    // Append using the resolved tab title
    const response = await callGoogleSheetsAPI(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
        rangeFor(sheetTitle, 'A1')
      )}:append?valueInputOption=USER_ENTERED`,
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
          'Google authentication failed after re-authentication attempt. Check the extension options.'
        )
      }
      throw new Error(`Failed to save to Google Sheets: ${error}`)
    }

    return { success: true, saved: fresh.length, skipped: skipped.length }
  } catch (error) {
    console.error('Error saving to Google Sheets:', error)
    return {
      success: false,
      error: (error as Error).message || 'Failed to save to Google Sheets'
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
