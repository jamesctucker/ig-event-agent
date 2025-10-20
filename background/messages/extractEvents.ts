import type { PlasmoMessaging } from '@plasmohq/messaging'
import { analyzeCaption, analyzeImage } from '~lib/ai'
import { filterPostsByDateRange } from '~lib/utils'

interface ExtractEventsRequest {
  collectionId: string
  startDate: string
  endDate: string
}

interface Post {
  imageUrl: string
  caption: string
  postUrl: string
  timestamp?: number
}

const handler: PlasmoMessaging.MessageHandler<ExtractEventsRequest> = async (req, res) => {
  try {
    const { collectionId, startDate, endDate } = req.body as ExtractEventsRequest

    if (!collectionId || !startDate || !endDate) {
      return res.send({
        success: false,
        error: 'Missing required parameters'
      })
    }

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    if (!tab?.id) {
      return res.send({ success: false, error: 'No active tab found' })
    }

    // Get posts from content script (with multiple scrolls to load more)
    const posts: Post[] = await chrome.tabs.sendMessage(tab.id, {
      action: 'getPosts',
      scrollCount: 5 // Scroll 5 times to load more posts
    })

    if (!posts || posts.length === 0) {
      return res.send({
        success: false,
        error: 'No posts found in this collection'
      })
    }

    // Filter posts by date range
    const filteredPosts = filterPostsByDateRange(posts, startDate, endDate)

    if (filteredPosts.length === 0) {
      return res.send({
        success: true,
        events: [],
        message: 'No posts found in the selected date range'
      })
    }

    // Send progress update
    chrome.runtime.sendMessage({
      type: 'progress',
      progress: { current: 0, total: filteredPosts.length }
    })

    // Extract event information from each post
    const events = []

    for (let i = 0; i < filteredPosts.length; i++) {
      const post = filteredPosts[i]

      // Update progress
      chrome.runtime.sendMessage({
        type: 'progress',
        progress: { current: i + 1, total: filteredPosts.length }
      })

      try {
        // First, try to extract event info from caption
        let eventInfo = null

        if (post.caption && post.caption.length > 20) {
          eventInfo = await analyzeCaption(post.caption)
        }

        // If no event info from caption, analyze the image
        if (!eventInfo || !eventInfo.hasEventInfo) {
          if (post.imageUrl) {
            eventInfo = await analyzeImage(post.imageUrl)
          }
        }

        // If we found event information, add it to results
        if (eventInfo && eventInfo.hasEventInfo) {
          events.push({
            name: eventInfo.name,
            url: post.postUrl,
            date: eventInfo.date,
            start: eventInfo.start,
            location: eventInfo.location,
            organizer: eventInfo.organizer,
            cost: eventInfo.cost,
            summary: eventInfo.summary,
            imageUrl: post.imageUrl,
            caption: post.caption
          })
        }
      } catch (error) {
        console.error(`Error processing post ${post.postUrl}:`, error)
        // Continue with next post
      }
    }

    res.send({
      success: true,
      events
    })
  } catch (error) {
    console.error('Error extracting events:', error)
    res.send({
      success: false,
      error: (error as Error).message || 'Failed to extract events'
    })
  }
}

export default handler
