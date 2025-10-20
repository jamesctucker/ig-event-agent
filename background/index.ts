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
    // Find the caption element
    const captionElements = document.querySelectorAll('[class*="Caption"]')
    let caption = ''

    for (const element of Array.from(captionElements)) {
      const text = element.textContent?.trim()
      if (text && text.length > caption.length) {
        caption = text
      }
    }

    // Try alternative selectors if no caption found
    if (!caption) {
      const altCaptionElement = document.querySelector('h1')
      caption = altCaptionElement?.textContent?.trim() || ''
    }

    // Try to find timestamp
    const timeElement = document.querySelector('time')
    const timestamp = timeElement
      ? new Date(timeElement.getAttribute('datetime') || '').getTime()
      : undefined

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
