/**
 * Extract Events from Instagram Saved Collections
 *
 * This module fetches posts from Instagram's private API endpoint, which provides
 * full captions and metadata in a structured format. This is much faster and more
 * reliable than DOM scraping individual posts.
 *
 * API Endpoint: /api/v1/feed/collection/{collectionId}/posts/
 * Falls back to DOM scraping if API fetch fails.
 */

import type { PlasmoMessaging } from '@plasmohq/messaging'
import { analyzeCaption, analyzeImage } from '~lib/ai'
import { retry } from '~lib/utils'

/**
 * Convert Instagram image URL to base64 data URI
 * This is needed because OpenAI can't access Instagram's protected CDN URLs
 * Includes retry logic with exponential backoff for network failures
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    return await retry(
      async () => {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch image: HTTP ${response.status}`)
        }

        const blob = await response.blob()
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
      },
      3, // maxRetries
      500 // baseDelay in ms
    )
  } catch (error) {
    console.error('❌ Failed to convert image to base64 after retries:', error)
    return null
  }
}

/**
 * Merge event information from caption and image analysis
 * Strategy: Prioritize image for structured data (date/time/location) as it's more reliable,
 * but prefer caption for descriptive data (summary/name) as it's often better written
 *
 * Even if neither source has complete event info, we still merge partial data and check
 * if the combination creates a complete event.
 */
function mergeEventInfo(
  captionInfo: any,
  imageInfo: any
): { hasEventInfo: boolean; [key: string]: any } {
  // If both are completely null/undefined, return false
  if (!captionInfo && !imageInfo) {
    return { hasEventInfo: false }
  }

  // If only one source exists, return that one
  if (!captionInfo) {
    return imageInfo
  }
  if (!imageInfo) {
    return captionInfo
  }

  // Merge data from both sources (even if neither has hasEventInfo=true)
  const merged = {
    // Prefer caption name if available (usually better written), else image
    name: captionInfo.name || imageInfo.name,
    // Prefer image for date/time/location (more reliable from flyers)
    date: imageInfo.date || captionInfo.date,
    start: imageInfo.start || captionInfo.start,
    location: imageInfo.location || captionInfo.location,
    // Prefer caption for organizer (often mentioned in text)
    organizer: captionInfo.organizer || imageInfo.organizer,
    // Prefer either for cost (take first available)
    cost: captionInfo.cost || imageInfo.cost,
    // Prefer caption summary (usually more descriptive)
    summary: captionInfo.summary || imageInfo.summary
  }

  // After merging, check if we now have complete event info
  // Per spec: An event is complete if it has specific date + start time + LOCATION (location is required)
  const hasCompleteInfo = !!(merged.date && merged.start && merged.location)

  return {
    hasEventInfo: hasCompleteInfo,
    ...merged
  }
}

/**
 * Fetch posts from Instagram's private API
 */
async function fetchPostsFromAPI(collectionId: string, tabId: number): Promise<Post[]> {
  try {
    const apiUrl = `https://www.instagram.com/api/v1/feed/collection/${collectionId}/posts/`

    // Execute fetch in the context of the Instagram tab (to get cookies)
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (url: string) => {
        try {
          const response = await fetch(url, {
            headers: {
              'x-ig-app-id': '936619743392459',
              'x-requested-with': 'XMLHttpRequest'
            },
            credentials: 'include'
          })

          if (!response.ok) {
            throw new Error(`API returned ${response.status}`)
          }

          const data = await response.json()
          return data
        } catch (error) {
          console.error('Error fetching from API:', error)
          return null
        }
      },
      args: [apiUrl]
    })

    if (!result || !result[0] || !result[0].result) {
      throw new Error('Failed to fetch from Instagram API')
    }

    const apiResponse = result[0].result
    const posts: Post[] = []

    if (apiResponse.items && Array.isArray(apiResponse.items)) {
      for (const item of apiResponse.items) {
        const media = item.media
        if (!media) continue

        const caption = media.caption?.text || ''
        const code = media.code || ''
        const imageUrl =
          media.image_versions2?.candidates?.[0]?.url ||
          media.carousel_media?.[0]?.image_versions2?.candidates?.[0]?.url ||
          ''
        const timestamp = media.taken_at ? media.taken_at * 1000 : undefined

        posts.push({
          imageUrl,
          caption,
          postUrl: `https://www.instagram.com/p/${code}/`,
          timestamp
        })
      }
    }

    return posts
  } catch (error) {
    console.error('Error fetching posts from API:', error)
    throw error
  }
}

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

    if (!tab?.id || !tab.url) {
      return res.send({ success: false, error: 'No active tab found' })
    }

    // Extract collection ID from URL
    // URL format: https://www.instagram.com/username/saved/collection-name/COLLECTION_ID/
    const urlMatch = tab.url.match(/\/saved\/[^\/]+\/(\d+)/)
    const actualCollectionId = urlMatch ? urlMatch[1] : null

    if (!actualCollectionId) {
      return res.send({
        success: false,
        error:
          'Could not extract collection ID from URL. Make sure you are on a saved collection page.'
      })
    }

    console.log('Fetching posts from collection:', actualCollectionId)

    // Get posts from Instagram API
    let posts: Post[] = []
    try {
      posts = await fetchPostsFromAPI(actualCollectionId, tab.id)
    } catch (apiError) {
      console.error('API fetch failed, will try DOM scraping as fallback:', apiError)
      // Fallback to DOM scraping if API fails
      posts = await chrome.tabs.sendMessage(tab.id, {
        action: 'getPosts',
        scrollCount: 5
      })
    }

    if (!posts || posts.length === 0) {
      return res.send({
        success: false,
        error: 'No posts found in this collection'
      })
    }

    console.log(`Found ${posts.length} posts from API`)

    // Don't filter by post timestamp - we want to analyze ALL posts
    // because the EVENT date (in the caption) might be different from
    // when the post was created. The AI will filter by event date.
    const filteredPosts = posts

    if (filteredPosts.length === 0) {
      return res.send({
        success: true,
        events: [],
        message: 'No posts found in this collection'
      })
    }

    // Send progress update
    await chrome.runtime.sendMessage({
      type: 'progress',
      progress: { current: 0, total: filteredPosts.length }
    })

    // Extract event information from each post
    const events = []

    for (let i = 0; i < filteredPosts.length; i++) {
      const post = filteredPosts[i]

      // Update progress and show current post - use await to ensure ordering
      await chrome.runtime.sendMessage({
        type: 'progress',
        progress: { current: i + 1, total: filteredPosts.length }
      })

      await chrome.runtime.sendMessage({
        type: 'currentPost',
        post: post
      })

      try {
        // We already have the full caption from the API!
        const caption = post.caption
        console.log('=== Processing post:', post.postUrl, '===')
        console.log('Caption length:', caption.length)

        let captionInfo = null
        let imageInfo = null

        // Step 1: Analyze caption
        if (caption && caption.length > 20) {
          console.log('📝 Step 1: Analyzing caption...')
          captionInfo = await analyzeCaption(caption, startDate, endDate)
          console.log('Caption analysis result:', {
            hasEventInfo: captionInfo?.hasEventInfo,
            hasDate: !!captionInfo?.date,
            hasStart: !!captionInfo?.start,
            hasSummary: !!captionInfo?.summary
          })
        } else {
          console.log('⏭️ Skipping caption analysis (too short or empty)')
        }

        // Step 2: Always analyze image (to get date/time if caption doesn't have it)
        if (post.imageUrl) {
          console.log('🖼️ Step 2: Analyzing image...')
          console.log('Converting image to base64...')
          const base64Image = await imageUrlToBase64(post.imageUrl)

          if (base64Image) {
            console.log('✅ Image converted, analyzing with Vision AI...')
            imageInfo = await analyzeImage(base64Image, startDate, endDate)
            console.log('Image analysis result:', {
              hasEventInfo: imageInfo?.hasEventInfo,
              hasDate: !!imageInfo?.date,
              hasStart: !!imageInfo?.start,
              hasSummary: !!imageInfo?.summary
            })
          } else {
            console.warn('⚠️ Image unavailable for post', post.postUrl)
          }
        } else {
          console.log('❌ No image URL available')
        }

        // Merge results: prioritize image for structured data (date/time/location),
        // but keep caption for descriptive data (summary/name)
        const mergedInfo = mergeEventInfo(captionInfo, imageInfo)
        console.log('🔀 Merged result:', {
          hasEventInfo: mergedInfo?.hasEventInfo,
          source: mergedInfo?.hasEventInfo
            ? captionInfo?.hasEventInfo && imageInfo?.hasEventInfo
              ? 'both'
              : captionInfo?.hasEventInfo
              ? 'caption'
              : 'image'
            : 'none'
        })

        // If we found event information, add it to results
        if (mergedInfo && mergedInfo.hasEventInfo) {
          events.push({
            name: mergedInfo.name,
            url: post.postUrl,
            date: mergedInfo.date,
            start: mergedInfo.start,
            location: mergedInfo.location,
            organizer: mergedInfo.organizer,
            cost: mergedInfo.cost,
            summary: mergedInfo.summary,
            imageUrl: post.imageUrl,
            caption: caption
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
