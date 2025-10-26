// Background service worker for the extension
// Handles long-running tasks and API calls

// Listen for installation
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    console.log('Instagram Event Agent installed')

    // Open options page on first install
    chrome.runtime.openOptionsPage()
  } else if (details.reason === 'update') {
    console.log('Instagram Event Agent updated')
  }
})

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async tab => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id })
  }
})

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapePost') {
    // Handle post scraping in a new tab
    scrapePostInNewTab(message.postUrl).then(sendResponse)
    return true // Keep message channel open for async response
  }
})

/**
 * Scrape a single post by opening it in a new tab
 */
async function scrapePostInNewTab(
  postUrl: string
): Promise<{ caption: string; timestamp?: number }> {
  return new Promise(resolve => {
    // Create a new tab
    chrome.tabs.create({ url: postUrl, active: false }, tab => {
      if (!tab.id) {
        resolve({ caption: '' })
        return
      }

      const tabId = tab.id

      // Listen for the tab to finish loading
      const listener = (tabIdUpdated: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (tabIdUpdated === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)

          // Execute script to extract caption
          chrome.scripting.executeScript(
            {
              target: { tabId },
              func: extractPostData
            },
            results => {
              // Close the tab
              chrome.tabs.remove(tabId)

              if (results && results[0]) {
                resolve(results[0].result as any)
              } else {
                resolve({ caption: '' })
              }
            }
          )
        }
      }

      chrome.tabs.onUpdated.addListener(listener)

      // Timeout after 10 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener)
        chrome.tabs.remove(tabId)
        resolve({ caption: '' })
      }, 10000)
    })
  })
}

/**
 * Function to be injected into the post page to extract data
 */
function extractPostData(): { caption: string; timestamp?: number } {
  try {
    let caption = ''

    // Strategy 1: Look for h1 element (often contains the full caption)
    const h1Elements = document.querySelectorAll('h1')
    for (const h1 of Array.from(h1Elements)) {
      const text = h1.textContent?.trim()
      if (text && text.length > 50) {
        // Likely the caption
        caption = text
        break
      }
    }

    // Strategy 2: Look for specific Instagram caption selectors
    if (!caption) {
      const captionSelectors = [
        '[class*="Caption"]',
        '[class*="caption"]',
        'span[dir="auto"]',
        'div[class*="Caption"] span'
      ]

      for (const selector of captionSelectors) {
        const elements = document.querySelectorAll(selector)
        for (const element of Array.from(elements)) {
          const text = element.textContent?.trim()
          if (text && text.length > caption.length && text.length > 20) {
            caption = text
          }
        }
      }
    }

    // Strategy 3: Look in meta tags
    if (!caption || caption.length < 50) {
      const metaDescription = document.querySelector('meta[property="og:description"]')
      const metaCaption = metaDescription?.getAttribute('content')
      if (metaCaption && metaCaption.length > caption.length) {
        caption = metaCaption
      }
    }

    // Clean up caption - remove username prefix if present
    // Instagram often formats as "username: actual caption text"
    const colonIndex = caption.indexOf(':')
    if (colonIndex > 0 && colonIndex < 50) {
      const afterColon = caption.substring(colonIndex + 1).trim()
      if (afterColon.length > 20) {
        caption = afterColon
      }
    }

    // Try to find timestamp
    const timeElement = document.querySelector('time')
    const timestamp = timeElement
      ? new Date(timeElement.getAttribute('datetime') || '').getTime()
      : undefined

    console.log('Extracted caption length:', caption.length)

    return {
      caption,
      timestamp
    }
  } catch (error) {
    console.error('Error extracting post data:', error)
    return { caption: '' }
  }
}

export {}
