# Quick Start Guide

## Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Open the extension options page and configure:

- **OpenAI API Key**: Required for AI-powered event extraction

  - Get from: https://platform.openai.com/api-keys
  - Uses `gpt-4o-mini` for text analysis (cost-effective)
  - Uses `gpt-4o` for image analysis (vision capabilities)

- **Google Client ID**: Required for Google Sheets integration
  - Create at: https://console.cloud.google.com/apis/credentials
  - Enable Google Sheets API
  - Configure OAuth consent screen
  - Add authorized redirect URI: `https://<extension-id>.chromiumapp.org/`

### 3. Build & Load Extension

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
```

Load the extension in Chrome:

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` folder

## Usage

### Step 1: Navigate to an Instagram Collection

1. Go to Instagram: `instagram.com/[your-username]/saved`
2. Open any saved collection you want to extract events from

### Step 2: Open the Side Panel

1. Click the extension icon in your Chrome toolbar
2. The side panel will open on the right side of your browser

### Step 3: Select Date Range

1. Choose your start date (defaults to today)
2. Choose your end date (defaults to 2 weeks from today)
3. Click "🔍 Extract Events"

### Step 4: Review & Edit Events

1. The extension will:

   - Scroll through posts in the collection
   - Show a preview of each post being analyzed
   - Extract event information using AI
   - Display found events with thumbnails

2. Review the extracted events:
   - ✏️ Click "Edit" to modify any event details
   - 🗑️ Remove events that aren't relevant
   - ✓ Click "Done" when finished editing

### Step 5: Save to Google Sheets

1. Click "💾 Save to Google Sheets"
2. Authenticate with Google (first time only)
3. Events will be saved to your configured spreadsheet

## How It Works

### AI-Powered Extraction

The extension uses a two-step approach:

1. **Caption Analysis** (GPT-4o-mini):

   - Analyzes post captions for event details
   - Fast and cost-effective
   - Works well for text-heavy posts

2. **Image Analysis** (GPT-4o):
   - Fallback if caption has no event info
   - Uses vision AI to read flyers/posters
   - Extracts text from images

### Date Range Filtering

- The AI only extracts events within your specified date range
- Events outside the range are automatically filtered out
- Helps reduce noise and API costs

### Event Data Structure

Each event includes:

- **Name**: Event title
- **Date**: MM/DD/YYYY format
- **Start**: Start time (e.g., "7:00:00 PM")
- **Location**: Venue name and address
- **Organizer**: Host/organizer name
- **Cost**: Price or "Free"
- **Summary**: Event description
- **URL**: Link to Instagram post

## Product Recommendations (Implemented ✅)

### 1. Side Panel Instead of Popup ✅

**Why:** Provides more screen real estate and allows users to:

- See the Instagram page and extension simultaneously
- Review posts while extraction happens
- Better context for editing events

### 2. Simplified Flow ✅

**Why:**

- Users are already in their desired collection
- No need to navigate away or select from dropdown
- Reduces clicks and cognitive load
- Faster to extract events

### 3. Visual Feedback ✅

**Why:**

- Shows current post being analyzed with thumbnail
- Progress bar with count (e.g., "5 / 20 posts")
- Gives confidence the extension is working
- Helps users understand what's being processed

### 4. In-Line Event Editing ✅

**Why:**

- AI isn't perfect - users can fix mistakes
- Add missing information
- Remove false positives
- Ensures data quality before saving

### 5. Better Error Handling

**Recommendation:** Add:

- Retry failed analyses automatically
- "Skip" button for problematic posts
- Detailed error messages (e.g., "API rate limit reached")
- Save partial results if extraction fails midway

### 6. Caching & Resume

**Recommendation:** Add:

- Cache analyzed posts to avoid re-processing
- "Resume" button to continue interrupted extractions
- Show which posts have already been analyzed

### 7. Batch Operations

**Recommendation:** Add:

- "Analyze Visible Posts Only" (no scrolling)
- "Load More" button vs. auto-scrolling
- Select multiple collections at once
- Export to CSV as alternative to Google Sheets

### 8. Smart Defaults

**Recommendation:** Add:

- Auto-detect common date patterns from collection name
- Suggest date range based on post dates
- Remember last used settings per collection

### 9. Analytics & Insights

**Recommendation:** Add:

- Show extraction accuracy metrics
- Most common venues/organizers
- Event type categorization
- Cost distribution

### 10. Accessibility

**Recommendation:** Add:

- Keyboard shortcuts (e.g., `Ctrl+E` to extract)
- Screen reader support
- High contrast mode
- Text size options

## Tips & Best Practices

### For Best Results:

1. **Scroll manually first**: Load more posts before extracting
2. **Narrow date ranges**: More focused = better accuracy
3. **Review before saving**: Always check extracted data
4. **Use descriptive collection names**: Helps with context

### Cost Optimization:

- Use narrow date ranges to reduce API calls
- GPT-4o-mini for captions is ~90% cheaper than GPT-4o
- Images are only analyzed if caption fails
- Estimated cost: $0.01-0.05 per 10 posts

### Common Issues:

- **No events found**: Check date range, scroll to load more posts
- **Inaccurate extraction**: Edit events before saving
- **API errors**: Check your OpenAI API key has credits
- **Google Sheets fails**: Re-authenticate in options

## Keyboard Shortcuts (Future)

- `Ctrl/Cmd + E` - Extract events
- `Ctrl/Cmd + S` - Save to sheets
- `Ctrl/Cmd + ,` - Open options
- `Esc` - Close side panel

## Support

For issues or feature requests:

- Check console logs (F12 → Console)
- Review `TESTING.md` for debugging tips
- File an issue on GitHub

---

**Built with:**

- [Plasmo](https://www.plasmo.com/) - Chrome extension framework
- [Vue 3](https://vuejs.org/) - UI framework
- [OpenAI API](https://openai.com/) - AI-powered extraction
- [Google Sheets API](https://developers.google.com/sheets/api) - Data storage
