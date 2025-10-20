import type { PlasmoCSConfig } from 'plasmo'

export const config: PlasmoCSConfig = {
  matches: ['https://www.instagram.com/*', 'https://instagram.com/*'],
  all_frames: false
}

interface Post {
  imageUrl: string
  caption: string
  postUrl: string
  timestamp?: number
}

interface Collection {
  id: string
  name: string
  url: string
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCollections') {
    getCollections().then(sendResponse)
    return true // Keep message channel open for async response
  } else if (request.action === 'getPosts') {
    getPosts(request.scrollCount).then(sendResponse)
    return true
  }
})

/**
 * Extract saved collections from Instagram
 */
async function getCollections(): Promise<Collection[]> {
  const collections: Collection[] = []

  try {
    // Wait for page to load
    await waitForElement('[role="main"]', 5000)

    // Check if we're on the saved collections page
    const isOnSavedPage = window.location.pathname.includes('/saved')

    if (!isOnSavedPage) {
      console.log('Not on saved collections page')
      return []
    }

    // Instagram's saved collections are typically in a grid/list format
    // We need to find collection links
    const collectionLinks = document.querySelectorAll('a[href*="/saved/"]')

    collectionLinks.forEach(link => {
      const href = link.getAttribute('href')
      if (href && href !== '/saved/') {
        // Extract collection ID from URL
        const match = href.match(/\/saved\/([^\/]+)/)
        if (match) {
          const collectionId = match[1]

          // Try to find collection name from the link's text or nearby elements
          const nameElement = link.querySelector('span') || link
          const name = nameElement.textContent?.trim() || `Collection ${collectionId}`

          collections.push({
            id: collectionId,
            name: name,
            url: `https://www.instagram.com${href}`
          })
        }
      }
    })

    // If no collections found, try alternative selectors
    if (collections.length === 0) {
      console.log('No collections found with primary method, trying alternatives')
      // Instagram's structure may vary, add fallback logic here
    }

    return collections
  } catch (error) {
    console.error('Error extracting collections:', error)
    return []
  }
}

/**
 * Extract posts from current collection page
 */
async function getPosts(scrollCount: number = 3): Promise<Post[]> {
  const posts: Post[] = []
  const seenUrls = new Set<string>()

  try {
    // Scroll to load more posts
    for (let i = 0; i < scrollCount; i++) {
      window.scrollTo(0, document.body.scrollHeight)
      await sleep(2000) // Wait for posts to load
    }

    // Find all post links
    const postLinks = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')

    for (const link of Array.from(postLinks)) {
      const href = link.getAttribute('href')
      if (!href || seenUrls.has(href)) continue

      seenUrls.add(href)

      // Find the image
      const img = link.querySelector('img')
      const imageUrl = img?.getAttribute('src') || ''

      // Try to get the alt text (often contains caption)
      const caption = img?.getAttribute('alt') || ''

      // Construct full post URL
      const postUrl = href.startsWith('http') ? href : `https://www.instagram.com${href}`

      posts.push({
        imageUrl,
        caption,
        postUrl
      })
    }

    return posts
  } catch (error) {
    console.error('Error extracting posts:', error)
    return []
  }
}

/**
 * Open a post in a new window/tab to extract more details
 */
async function getPostDetails(postUrl: string): Promise<{ caption: string; timestamp?: number }> {
  return new Promise(resolve => {
    // Send message to background to open and scrape the post
    chrome.runtime.sendMessage({ action: 'scrapePost', postUrl }, response => {
      resolve(response || { caption: '' })
    })
  })
}

/**
 * Utility: Wait for an element to appear
 */
function waitForElement(selector: string, timeout: number = 5000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Element ${selector} not found within ${timeout}ms`))
    }, timeout)
  })
}

/**
 * Utility: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Export for testing
export { getCollections, getPosts, getPostDetails }
