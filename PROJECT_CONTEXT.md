# Instagram Event Agent - Project Context

## Overview

A Chrome extension built with Plasmo that extracts event information from Instagram saved collections using AI (OpenAI GPT-4.1) and saves the results to Google Sheets. The extension analyzes both post captions and images to extract complete event details.

## Tech Stack

- **Framework**: Plasmo (Chrome extension builder)
- **UI**: Vue.js 3 with SCSS
- **AI**: OpenAI API (gpt-4.1 for both text and vision)
- **APIs**:
  - Instagram Private API (`/api/v1/feed/collection/{id}/posts/`)
  - Google Sheets API (OAuth2)
  - Chrome Extension APIs (tabs, storage, identity, sidePanel, scripting)

## User Flow

1. User navigates to an Instagram saved collection (e.g., `instagram.com/username/saved/collection-name/ID/`)
2. User clicks the extension icon → opens side panel
3. User selects a date range (default: today + 14 days)
4. User clicks "Extract Events"
5. Extension fetches posts from Instagram API
6. For each post, AI analyzes caption AND image
7. Results are merged intelligently
8. User can edit extracted events
9. User clicks "Save to Google Sheets"

## Architecture

### Core Files

#### **`sidepanel.vue`** (841 lines)

- Main UI component
- Features:
  - Date range picker
  - Extract button with loading state
  - Progress bar with current post preview
  - Event list with edit mode
  - Clear all button
  - Save to Google Sheets button
- Key functions:
  - `extractEvents()` - Triggers extraction via background message
  - `saveToGoogleSheets()` - Saves events to Google Sheets
  - `clearEvents()` - Clears all extracted events with confirmation
  - `removeEvent(index)` - Removes individual event

#### **`background/messages/extractEvents.ts`** (359 lines)

- Main orchestration logic
- Fetches posts from Instagram API
- Analyzes both caption and image for each post
- Merges results intelligently
- Key functions:
  - `fetchPostsFromAPI()` - Gets posts from Instagram's private API
  - `imageUrlToBase64()` - Converts Instagram CDN URLs to base64 (required for OpenAI Vision)
  - `mergeEventInfo()` - Intelligently combines caption + image data
- Always analyzes BOTH caption and image, then merges results

#### **`lib/ai.ts`** (253 lines)

- OpenAI integration
- Two main functions:
  - `analyzeCaption(caption, startDate, endDate)` - Uses gpt-4.1 for text analysis
  - `analyzeImage(imageUrl, startDate, endDate)` - Uses gpt-4.1 for vision analysis
- Both extract partial data even if incomplete
- Validates that complete events have: date, start time, and location

#### **`lib/googleSheets.ts`**

- Google Sheets integration
- OAuth2 authentication via Chrome Identity API
- Creates/updates spreadsheet with 8 columns: name, url, date, start, location, organizer, cost, summary

#### **`background/index.ts`** (161 lines)

- Background service worker
- Opens side panel on extension icon click
- Contains fallback DOM scraping logic (rarely used)

## Event Data Structure

```typescript
interface ExtractedEvent {
  name?: string // Event title
  url?: string // Instagram post URL
  date?: string // Format: MM/DD/YYYY
  start?: string // Format: "7:00:00 PM"
  location?: string // Venue name with address
  organizer?: string // Host/organizer name
  cost?: string // e.g., "Free", "$15", "$10-$15 suggested donation"
  summary?: string // Event description (max 25 words)
  imageUrl?: string // Instagram image URL
  caption?: string // Full Instagram caption
}
```

## Critical Implementation Details

### 1. Dual Analysis Strategy

**Always analyzes both caption AND image**, then merges:

- Caption often has: better written name, summary, organizer
- Image often has: reliable date, time, location (from flyers)

### 2. Partial Data Extraction

AI extracts ALL available fields, even if incomplete:

- `hasEventInfo: false` doesn't mean "no data"
- It means "incomplete event" (missing date/time/location)
- Partial data is still returned and can be merged

### 3. Merge Priority

```javascript
{
  name: captionInfo.name || imageInfo.name,           // Caption first
  date: imageInfo.date || captionInfo.date,           // Image first
  start: imageInfo.start || captionInfo.start,        // Image first
  location: imageInfo.location || captionInfo.location, // Image first
  organizer: captionInfo.organizer || imageInfo.organizer, // Caption first
  cost: captionInfo.cost || imageInfo.cost,           // Either
  summary: captionInfo.summary || imageInfo.summary  // Caption first
}
```

### 4. Validation Rules

An event is considered **complete** if it has:

- Specific date (not relative like "this Sunday")
- Start time (explicitly stated)
- Location OR name

### 5. AI Prompt Strategy

**Key instructions to prevent hallucination:**

- "DO NOT calculate or infer dates from relative references like 'this Sunday'"
- "DO NOT invent or guess a start time"
- "Extract ALL mentioned fields, even if incomplete"
- "ONLY set hasEventInfo to true if you have: specific date, start time, and location"

### 6. Instagram API Integration

Uses private API: `/api/v1/feed/collection/{collectionId}/posts/`

- Requires: `x-ig-app-id: 936619743392459` header
- Executed via `chrome.scripting.executeScript` in tab context (for cookies)
- Fallback to DOM scraping if API fails
- Returns full captions and metadata in structured JSON

### 7. Image Base64 Conversion

OpenAI Vision API cannot access Instagram's protected CDN URLs directly:

```javascript
// Fetch image in background script context → convert to base64 data URI
const base64Image = await imageUrlToBase64(post.imageUrl)
// Pass base64 to OpenAI Vision API
await analyzeImage(base64Image, startDate, endDate)
```

### 8. Date Range Filtering

- AI receives date range context: "We are looking for events between X and Y"
- AI calculates year from date range (e.g., 2025) for dates without years
- AI validates event dates fall within range
- Posts are NOT filtered by timestamp (since event date ≠ post date)

## Recent Improvements

### ✅ Fixed Hallucination Issues

- Added strict prompts preventing date calculation from "this Sunday"
- Required explicit dates and start times
- Validation rejects events missing critical fields

### ✅ Implemented Merge Strategy

- Always analyze both caption and image
- Merge partial data intelligently
- Example: Caption has description, image has date/time → combined event

### ✅ Enhanced Logging

```javascript
console.log('📝 Step 1: Analyzing caption...')
console.log('🖼️ Step 2: Analyzing image...')
console.log('🔀 Merged result:', { hasEventInfo, source: 'both' / 'caption' / 'image' })
```

### ✅ Start Time Requirement

- Events without start times are automatically rejected
- Prevents incomplete/unusable event data

### ✅ Side Panel UX

- Full-height sidebar (not popup dropdown)
- Visual progress with current post thumbnail
- Inline editing of extracted events
- Clear all functionality with confirmation

## Configuration Requirements

### 1. Google Cloud Console Setup

```json
// In package.json manifest:
"oauth2": {
  "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/spreadsheets"]
}
```

### 2. Authorized Redirect URI

Must add to Google Cloud Console:

```
https://<extension-id>.chromiumapp.org/
```

### 3. API Keys

Stored in Chrome storage:

- OpenAI API Key (required)
- Google Sheets Spreadsheet ID (optional, created if not provided)

## Known Considerations

### 1. Instagram Rate Limiting

- Instagram API may rate limit requests
- Currently no retry logic implemented
- Fallback to DOM scraping available

### 2. OpenAI Costs

- Each post analyzed twice (caption + image)
- gpt-4.1 pricing applies
- Vision API more expensive than text-only

### 3. Chrome Extension Permissions

- Requires `scripting` permission for API injection
- Requires `identity` for Google OAuth
- Requires `sidePanel` for sidebar UI

### 4. CORS and Authentication

- Instagram images protected by CDN auth
- Base64 conversion required for OpenAI Vision
- Executed in background script context with proper permissions

## Development Commands

```bash
npm run dev      # Start development server with HMR
npm run build    # Build for production
npm run package  # Create distributable package
```

## File Structure

```
ig_event_agent/
├── sidepanel.vue                    # Main UI component
├── background/
│   ├── index.ts                     # Background service worker
│   └── messages/
│       ├── extractEvents.ts         # Main extraction logic
│       └── saveToSheets.ts          # Google Sheets integration
├── lib/
│   ├── ai.ts                        # OpenAI integration
│   ├── googleSheets.ts              # Google Sheets API
│   ├── storage.ts                   # Chrome storage utilities
│   └── utils.ts                     # Utility functions
├── types/
│   └── index.ts                     # TypeScript interfaces
├── contents/
│   └── instagram.ts                 # Instagram DOM interaction (fallback)
├── package.json                     # Dependencies & manifest config
└── tsconfig.json                    # TypeScript configuration
```

## Debugging Tips

1. **Check console logs** - Detailed logging at each step
2. **Verify API keys** - Check Chrome storage in extension options
3. **Instagram API issues** - Check Network tab for `/api/v1/feed/collection/` calls
4. **Google OAuth issues** - Verify client_id in package.json and redirect URI in console
5. **AI not finding events** - Check if caption has specific date/time or if image is clear

## Example Console Output

```
=== Processing post: https://www.instagram.com/p/ABC123/ ===
Caption length: 245
📝 Step 1: Analyzing caption...
Caption analysis result: { hasEventInfo: false, hasDate: false, hasStart: false, hasSummary: true }
🖼️ Step 2: Analyzing image...
✅ Image converted, analyzing with Vision AI...
Image analysis result: { hasEventInfo: true, hasDate: true, hasStart: true, hasSummary: false }
🔀 Merged result: { hasEventInfo: true, source: 'both' }
```

## Summary

This extension solves the problem of manually extracting event details from Instagram saved collections. By combining AI analysis of both captions and images, it creates complete event records that can be imported into Google Sheets for event planning and organization.
