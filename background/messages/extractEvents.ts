/**
 * Extract Events from Instagram Saved Collections
 *
 * This module fetches posts from Instagram's private API endpoint, which provides
 * full captions and metadata in a structured format. Much faster and more
 * reliable than DOM scraping individual posts.
 *
 * API Endpoint: /api/v1/feed/collection/{id}/posts/ (paginated via next_max_id)
 * Falls back to DOM scraping if API fetch fails.
 */

import type { PlasmoMessaging } from '@plasmohq/messaging'
import { analyzeCaption, analyzeImage } from '~lib/ai'
import { retry } from '~lib/utils'
import { mergeEventInfo, type AnalysisResult, type EventInfo } from '~lib/events'

/** Safety cap on Instagram feed pagination — prevents runaway loops on huge collections */
const MAX_FEED_PAGES = 10

/**
 * Convert Instagram image URL to base64 data URI
 * This is needed because DeepSeek can't access Instagram's protected CDN URLs
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
 * Send a UI progress message without ever throwing.
 *
 * The side panel is the only listener for these messages; Chrome's side panel
 * can close while extraction is still running, and chrome.runtime.sendMessage
 * rejects with "Receiving end does not exist" when no page is listening.
 * Ordering is preserved (still awaited), but a missing UI must never abort
 * the extraction run.
 */
async function notifyUI(message: unknown): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message)
  } catch {
    // Side panel closed (or never opened) — progress simply goes nowhere.
  }
}

/**
 * Fetch ALL posts from Instagram's private collection API, following
 * next_max_id pagination until the collection is exhausted (or MAX_FEED_PAGES is hit).
 */
async function fetchPostsFromAPI(collectionId: string, tabId: number): Promise<Post[]> {
  try {
    // Execute fetch in the context of the Instagram tab (to get cookies).
    // The whole pagination loop runs inside the page (one executeScript call)
    // to avoid repeated serialization round-trips per page.
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (startUrl: string, maxPages: number) => {
        try {
          const allItems: any[] = []
          let url: string | null = startUrl
          let pages = 0

          while (url && pages < maxPages) {
            const response: Response = await fetch(url, {
              headers: {
                'x-ig-app-id': '936619743392459',
                'x-requested-with': 'XMLHttpRequest'
              },
              credentials: 'include'
            })

            if (!response.ok) {
              return { error: `API returned ${response.status}`, items: allItems, pages }
            }

            const data: any = await response.json()
            if (Array.isArray(data.items)) {
              allItems.push(...data.items)
            }
            pages++

            if (data.more_available && data.next_max_id) {
              const separator = startUrl.includes('?') ? '&' : '?'
              url = `${startUrl}${separator}max_id=${encodeURIComponent(data.next_max_id)}`
            } else {
              url = null
            }
          }

          return { error: null, items: allItems, pages }
        } catch (error) {
          console.error('Error fetching from API:', error)
          return null
        }
      },
      args: [
        `https://www.instagram.com/api/v1/feed/collection/${collectionId}/posts/`,
        MAX_FEED_PAGES
      ]
    })

    if (!result || !result[0] || !result[0].result) {
      throw new Error('Failed to fetch from Instagram API')
    }

    const apiResponse = result[0].result as {
      error: string | null
      items: any[]
      pages: number
    }

    const posts: Post[] = []
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

    console.log(
      `Fetched ${posts.length} posts from Instagram API across ${apiResponse.pages} page(s)` +
        (apiResponse.pages >= MAX_FEED_PAGES ? ` (stopped at MAX_FEED_PAGES=${MAX_FEED_PAGES})` : '')
    )

    if (apiResponse.error) {
      // Partial failure: some pages loaded, later page failed. Keep what we got,
      // but log loudly — truncation without a log line is how partial data looks like success.
      console.warn(
        `⚠️ Collection fetch incomplete after ${apiResponse.pages} page(s): ${apiResponse.error}`
      )
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

    // Don't filter by post timestamp - we want to analyze ALL posts
    // because the EVENT date (in the caption) might be different from
    // when the post was created. The AI will filter by event date.
    const filteredPosts = posts
    const totalPosts = filteredPosts.length

    // Send initial progress (no-op if the panel is closed)
    await notifyUI({
      type: 'progress',
      progress: { current: 0, total: totalPosts }
    })

    // Extract event information from each post
    const events = []
    let failedPosts = 0
    let failureNote: string | null = null

    for (let i = 0; i < filteredPosts.length; i++) {
      const post = filteredPosts[i]

      // Update progress and show current post (survives a closed side panel)
      await notifyUI({
        type: 'progress',
        progress: { current: i + 1, total: totalPosts }
      })

      await notifyUI({
        type: 'currentPost',
        post: post
      })

      try {
        // We already have the full caption from the API!
        const caption = post.caption
        console.log('=== Processing post:', post.postUrl, '===')
        console.log('Caption length:', caption.length)

        let captionInfo: EventInfo | null = null
        let imageInfo: EventInfo | null = null
        // Each post runs up to two analyses (caption + image). A post only counts
        // as "failed" when BOTH analyses errored — partial degradation still merges.
        let captionFailed = false
        let imageFailed = false

        // Step 1: Analyze caption
        if (caption && caption.length > 20) {
          console.log('📝 Step 1: Analyzing caption...')
          const captionResult: AnalysisResult = await analyzeCaption(caption, startDate, endDate)
          if (captionResult.status === 'error') {
            captionFailed = true
            console.error('❌ Caption analysis failed:', captionResult.kind, captionResult.message)
            // Auth and billing failures are systemic, not post-specific — stop the run
            // instead of reporting "no events found" after burning through every post.
            if (captionResult.kind === 'auth' || captionResult.kind === 'billing') {
              return res.send({
                success: false,
                error: captionResult.message,
                failedPosts: i + 1,
                totalPosts
              })
            }
            if (captionResult.kind === 'rate-limit') {
              failureNote = captionResult.message
            }
          } else {
            captionInfo = captionResult.info
            console.log('Caption analysis result:', {
              hasEventInfo: captionInfo?.hasEventInfo,
              hasDate: !!captionInfo?.date,
              hasStart: !!captionInfo?.start,
              hasSummary: !!captionInfo?.summary
            })
          }
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
            const imageResult: AnalysisResult = await analyzeImage(base64Image, startDate, endDate)
            if (imageResult.status === 'error') {
              imageFailed = true
              console.error('❌ Image analysis failed:', imageResult.kind, imageResult.message)
              if (imageResult.kind === 'auth' || imageResult.kind === 'billing') {
                return res.send({
                  success: false,
                  error: imageResult.message,
                  failedPosts: i + 1,
                  totalPosts
                })
              }
              if (imageResult.kind === 'rate-limit') {
                failureNote = imageResult.message
              }
            } else {
              imageInfo = imageResult.info
              console.log('Image analysis result:', {
                hasEventInfo: imageInfo?.hasEventInfo,
                hasDate: !!imageInfo?.date,
                hasStart: !!imageInfo?.start,
                hasSummary: !!imageInfo?.summary
              })
            }
          } else {
            imageFailed = true
            console.warn('⚠️ Image unavailable for post', post.postUrl)
          }
        } else {
          console.log('❌ No image URL available')
        }

        // A post only counts as failed when every attempted analysis errored out —
        // distinguished from a successfully-analyzed post that contains no event.
        const attemptedCaption = Boolean(caption && caption.length > 20)
        const attemptedImage = Boolean(post.imageUrl)
        const attempts = [attemptedCaption, attemptedImage].filter(Boolean).length
        const failures = [attemptedCaption && captionFailed, attemptedImage && imageFailed].filter(
          Boolean
        ).length
        if (attempts > 0 && failures === attempts) {
          failedPosts++
        }

        // Merge results: image wins structured data (date/time/location),
        // caption wins descriptive data (summary/name). Both sides re-stamped
        // through the shared completeness gate inside mergeEventInfo.
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
        failedPosts++
        // Continue with next post
      }
    }

    if (failedPosts > 0) {
      console.warn(`⚠️ ${failedPosts} of ${totalPosts} posts failed to analyze (vs. "no event found")`)
    }

    res.send({
      success: true,
      events,
      failedPosts,
      totalPosts,
      failureNote
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
