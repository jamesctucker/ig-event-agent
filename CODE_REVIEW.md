# Code Review: Instagram Event Agent Chrome Extension

**Reviewed by:** Staff Engineer  
**Date:** October 27, 2025  
**Project:** Instagram Event Agent (Plasmo Chrome Extension)  
**Scope:** Bug identification and maintainability refactoring recommendations

---

## 🎯 Update: Critical Bugs Fixed (October 27, 2025)

✅ **Bug #1: Unsafe JSON.parse()** - FIXED in `lib/ai.ts`

- Added try-catch error handling around JSON.parse()
- Added validation of response structure (checking for `hasEventInfo` boolean field)
- Returns safe default `{ hasEventInfo: false }` on parse failure

✅ **Bug #3: Missing Location Validation** - FIXED in `background/messages/extractEvents.ts`

- Updated `mergeEventInfo()` to require location (not just name OR location)
- Now correctly enforces spec: date + start time + location (all 3 required)

✅ **Bug #2: OAuth Token Expiration** - FIXED in `lib/googleSheets.ts`

- Added `validateGoogleToken()` utility for token validation
- Added `callGoogleSheetsAPI()` wrapper that automatically handles 401 responses
- All API calls now wrapped with auto-retry on token expiration
- Clear error messages guide users to re-authenticate

✅ **Bug #4: Message Listener Memory Leak** - FIXED in `sidepanel.vue`

- Extracted listener into named `messageHandler()` function
- Added `onUnmounted` lifecycle hook to properly clean up listener
- Moved listener registration into `onMounted` for paired lifecycle management
- Prevents accumulation of listeners on component remount

✅ **Bug #5: Progress Race Condition** - FIXED in `background/messages/extractEvents.ts`

- Changed `chrome.runtime.sendMessage()` to `await chrome.runtime.sendMessage()`
- Ensures progress updates are sent in correct order
- Messages now wait for completion before next message is sent
- Fixes out-of-order progress display in UI

✅ **Bug #6: Image Conversion Fallback** - FIXED in `background/messages/extractEvents.ts`

- Added retry logic with exponential backoff to `imageUrlToBase64()`
- Retries up to 3 times with 500ms base delay
- Better error logging distinguishes between network failures and unavailable images
- Changed console.log to console.warn for image unavailability

✅ **Bug #7: Config Validation** - FIXED in `sidepanel.vue`

- Added API configuration check in `extractEvents()` before expensive operations
- Validates OpenAI API key is configured
- Validates Google Sheet ID is configured
- Shows clear user-facing error messages for missing configuration
- Prevents silent failures and wasted API calls

---

## Executive Summary

This is a well-architected Chrome extension with good separation of concerns and thoughtful AI integration. The project demonstrates solid engineering practices but has several **critical bugs** that need immediate attention, particularly around:

1. **Critical JSON parsing vulnerability** in AI response handling
2. **Unhandled OAuth token expiration** causing silent failures
3. **Weak error boundaries** in extraction pipeline
4. **Message listener memory leaks** in Vue component

Beyond bugs, there are meaningful refactoring opportunities to improve code maintainability, type safety, and error handling.

---

## 🔴 CRITICAL BUGS (Fix ASAP)

### 1. **Unsafe JSON.parse() Without Error Handling**

**File:** `lib/ai.ts` (lines 112, 217)  
**Severity:** 🔴 CRITICAL  
**Impact:** Application crash if OpenAI returns malformed JSON

**Issue:**

```typescript
const eventInfo: EventInfo = JSON.parse(result)
```

If OpenAI returns non-JSON or partial JSON, this will throw an uncaught error that crashes the entire extraction process.

**Fix:**

```typescript
let eventInfo: EventInfo
try {
  eventInfo = JSON.parse(result)
  // Validate structure
  if (!eventInfo || typeof eventInfo.hasEventInfo !== 'boolean') {
    throw new Error('Invalid response structure')
  }
} catch (error) {
  console.error('Failed to parse AI response:', result, error)
  return { hasEventInfo: false }
}
```

**Status:** ⚠️ Needs immediate fix

---

### 2. **Missing OAuth Token Expiration Handling**

**File:** `lib/googleSheets.ts` (lines 34, 119, 178)  
**Severity:** 🔴 CRITICAL  
**Impact:** Silent failures when Google OAuth token expires; user sees "Failed to save" with no context

**Issue:**

```typescript
const token = await getGoogleAuthToken()
if (!token) {
  throw new Error('Failed to authenticate with Google')
}
// Token is never validated for expiration
```

Google OAuth tokens expire (default: 1 hour for access tokens). The code doesn't:

- Detect token expiration
- Attempt re-authentication
- Handle HTTP 401 responses from Google API

**Current behavior:** Users get vague error messages when token expires.

**Fix:**

```typescript
// Add token validation
async function validateGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token
    )
    return response.ok
  } catch {
    return false
  }
}

// Wrap API calls with token refresh
async function callGoogleSheetsAPI(token: string, endpoint: string, options: RequestInit) {
  let currentToken = token

  let response = await fetch(endpoint, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${currentToken}` }
  })

  // If 401, try to refresh and retry
  if (response.status === 401) {
    const newToken = await getGoogleAuthToken() // Force re-auth
    if (!newToken) throw new Error('Re-authentication failed')

    response = await fetch(endpoint, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${newToken}` }
    })
  }

  return response
}
```

**Status:** ⚠️ Needs immediate fix

---

### 3. **Missing Location Validation in Merge Logic**

**File:** `background/messages/extractEvents.ts` (lines 48-89)  
**Severity:** 🔴 CRITICAL  
**Impact:** Events with missing location are marked as complete when they shouldn't be

**Issue:**
Line 83 checks for `(merged.name || merged.location)`, but the PROJECT_CONTEXT states:

> "An event is considered **complete** if it has: Specific date (not relative like 'this Sunday') + Start time + **Location**"

The merge should require LOCATION, not just name. Currently, an event with date, time, and name (but no location) is incorrectly marked as `hasEventInfo: true`.

**Fix:**

```typescript
const hasCompleteInfo = !!(
  (merged.date && merged.start && merged.location) // MUST have location per spec
)
```

**Status:** ⚠️ Needs immediate fix

---

### 4. **Unhandled Chrome Message Listener Memory Leak**

**File:** `sidepanel.vue` (lines 348-355)  
**Severity:** 🟠 HIGH  
**Impact:** Multiple listeners accumulate on component remount, consuming memory

**Issue:**

```typescript
onMounted(async () => {
  // ... setup code ...
})

// Listener registered WITHOUT cleanup
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'progress') {
    progress.value = message.progress
  }
  if (message.type === 'currentPost') {
    currentPost.value = message.post
  }
})
```

This listener is never removed. If the sidepanel is opened/closed repeatedly, listeners accumulate.

**Fix:**

```typescript
import { onUnmounted } from 'vue'

const messageHandler = (message: any) => {
  if (message.type === 'progress') {
    progress.value = message.progress
  }
  if (message.type === 'currentPost') {
    currentPost.value = message.post
  }
}

onMounted(() => {
  chrome.runtime.onMessage.addListener(messageHandler)
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(messageHandler)
})
```

**Status:** ⚠️ Needs immediate fix

---

### 5. **Race Condition in Progress Updates**

**File:** `background/messages/extractEvents.ts` (lines 243-262)  
**Severity:** 🟠 HIGH  
**Impact:** Progress messages may arrive out of order; UI shows wrong progress

**Issue:**

```typescript
for (let i = 0; i < filteredPosts.length; i++) {
  const post = filteredPosts[i]

  chrome.runtime.sendMessage({
    type: 'progress',
    progress: { current: i + 1, total: filteredPosts.length }
  })

  chrome.runtime.sendMessage({
    type: 'currentPost',
    post: post
  })

  // AI analysis happens here (async, non-blocking)
  try { ... }
}
```

`sendMessage()` is fire-and-forget; progress messages are sent before analysis is complete. If network is slow, messages arrive out of order.

**Fix:**

```typescript
// Use a queue and debouncing
let pendingProgress: any = null
const flushProgress = async () => {
  if (pendingProgress) {
    await chrome.runtime.sendMessage(pendingProgress)
    pendingProgress = null
  }
}

for (let i = 0; i < filteredPosts.length; i++) {
  const post = filteredPosts[i]

  // Update locally and queue for send
  pendingProgress = {
    type: 'progress',
    progress: { current: i + 1, total: filteredPosts.length }
  }

  // Send post after progress is queued
  await chrome.runtime.sendMessage({
    type: 'currentPost',
    post: post
  })

  try {
    // ... analysis ...
  } finally {
    await flushProgress()
  }
}
```

**Status:** ⚠️ Needs investigation & fix

---

## 🟠 HIGH-PRIORITY BUGS

### 6. **Weak Fallback Strategy for Image Conversion Failures**

**File:** `background/messages/extractEvents.ts` (lines 289-308)  
**Severity:** 🟠 HIGH  
**Impact:** Image analysis is silently skipped if base64 conversion fails; events miss date/time info

**Issue:**

```typescript
const base64Image = await imageUrlToBase64(post.imageUrl)

if (base64Image) {
  console.log('✅ Image converted, analyzing with Vision AI...')
  imageInfo = await analyzeImage(base64Image, startDate, endDate)
} else {
  console.log('❌ Failed to fetch/convert image')
}
```

If image conversion fails (network error, 404, etc.), the function logs and continues. No retry logic. User never knows a potential data source was lost.

**Fix:**

```typescript
// Add retry with exponential backoff
const base64Image = await retry(
  () => imageUrlToBase64(post.imageUrl),
  (maxRetries = 3),
  (baseDelay = 500)
).catch(error => {
  console.error('Failed to convert image after 3 retries:', error)
  return null
})

if (base64Image) {
  imageInfo = await analyzeImage(base64Image, startDate, endDate)
} else {
  // Log warning so user knows image wasn't analyzed
  console.warn('⚠️ Image unavailable for post', post.postUrl)
}
```

(Note: `retry()` utility already exists in `lib/utils.ts`)

**Status:** ⚠️ Needs fix

---

### 7. **Missing Validation for API Config at Startup**

**File:** `options.vue` (not provided, but related)  
**Severity:** 🟠 HIGH  
**Impact:** Users may extract events without proper setup; expensive OpenAI calls fail silently

**Issue:**
The extension starts extraction without validating that OpenAI API key is configured. If key is missing:

- OpenAI throws error: `"OpenAI API key not configured"`
- Entire extraction fails
- User sees generic error, doesn't know what's wrong

**Fix:** Add config validation before extraction:

```typescript
// In sidepanel.vue extractEvents()
async function extractEvents() {
  if (!canExtract.value) return

  try {
    loading.value = true

    // ✅ NEW: Validate config before making expensive calls
    const config = await getApiConfig()
    if (!config.openaiApiKey) {
      showStatus('❌ OpenAI API key not configured. Check the extension options.', 'error')
      return
    }

    // ... rest of extraction ...
  }
}
```

**Status:** ⚠️ Needs fix

---

## 🟡 MODERATE ISSUES

### 8. **Type Duplication Across Codebase**

**Files:** `types/index.ts`, `lib/ai.ts`, `lib/googleSheets.ts`, `background/messages/*.ts`  
**Severity:** 🟡 MODERATE  
**Impact:** Type inconsistencies; hard to maintain; risk of mismatches

**Issue:**

- `EventInfo` interface defined in `lib/ai.ts` (lines 25-34)
- `ExtractedEvent` interface defined in `types/index.ts` (lines 16-27)
- `Event` interface defined in `lib/googleSheets.ts` (lines 3-13)
- Similar definitions across multiple files

All three are nearly identical but have slight differences (e.g., presence of `imageUrl`, `caption`).

**Fix:** Consolidate in `types/index.ts`:

```typescript
// types/index.ts
export interface EventInfo {
  hasEventInfo: boolean
  name?: string
  date?: string
  start?: string
  location?: string
  organizer?: string
  cost?: string
  summary?: string
}

export interface ExtractedEvent extends EventInfo {
  hasEventInfo: boolean // Required in saved events
  url?: string // Instagram post URL
  imageUrl?: string
  caption?: string
}

// Re-export for convenience
export type Event = ExtractedEvent
```

Then remove duplicates and import:

```typescript
// lib/ai.ts
import type { EventInfo } from '~types'

// lib/googleSheets.ts
import type { ExtractedEvent as Event } from '~types'

// background/messages/extractEvents.ts
import type { ExtractedEvent } from '~types'
```
