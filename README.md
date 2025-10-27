# Instagram Event Agent

A Chrome extension that extracts event information from Instagram saved collections and saves them to Google Sheets.

## Features

- 🔍 Browse and select Instagram saved collections
- 📅 Filter events by date ranges
- 🤖 AI-powered event detection from post captions and images
- 🖼️ Multimodal GPT-4 Vision image analysis for accurate event details
- 📊 Automatic export to Google Sheets with full event metadata
- 🔄 Automatic token refresh and retry logic for reliability

## ⚙️ Prerequisites

- Google account with access to Google Cloud Console
- OpenAI account with API access
- Chrome browser
- Node.js and npm (for development)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys (Required)

This extension requires **two** API configurations. Both must be set up or extraction will fail.

#### A. OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/account/api-keys)
2. Create a new API key
3. Save it somewhere safe (you'll need it in Step 3)

#### B. Google Sheets Setup

**Create a Google Sheet:**

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Open the sharing settings and note the **Sheet ID** (the long string in the URL between `/d/` and `/edit`)
   - Example URL: `https://docs.google.com/spreadsheets/d/1abc123.../edit`
   - Sheet ID: `1abc123...`

**Get Google Credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - Google Sheets API
   - Google Drive API
4. Create OAuth 2.0 consent screen (External)
5. Create OAuth 2.0 Client ID credentials (Desktop application)
6. Download the credentials JSON file

### 3. Set Environment Variables

Create a `.env` file in the project root:

```bash
PLASMO_PUBLIC_OPENAI_API_KEY=your-openai-api-key-here
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-here
PLASMO_PUBLIC_GOOGLE_API_KEY=your-google-api-key-here
PLASMO_PUBLIC_GOOGLE_SHEET_ID=your-sheet-id-here
```

**How to find each value:**

- `PLASMO_PUBLIC_OPENAI_API_KEY`: From OpenAI Platform API keys page
- `PLASMO_PUBLIC_GOOGLE_CLIENT_ID`: From Google Cloud Console → Credentials → OAuth 2.0 Client ID
- `PLASMO_PUBLIC_GOOGLE_API_KEY`: From the credentials (API key field)
- `PLASMO_PUBLIC_GOOGLE_SHEET_ID`: From your Google Sheet URL

### 4. Configure Extension Options

1. Run the extension (see below)
2. Click the extension icon in Chrome
3. Click "Options" or the gear icon
4. Paste your API credentials in the settings form
5. Test the connection

### 5. Run the Extension

**Development mode:**

```bash
npm run dev
```

**Build for production:**

```bash
npm run build
```

## 📱 Usage

1. **Navigate to Instagram**: Go to `instagram.com/[your-username]/saved/[collection-name]/`
2. **Open Extension**: Click the extension icon in Chrome toolbar
3. **Select Date Range**: Choose start and end dates for event filtering
4. **Extract Events**: Click "Extract Events" button
   - The extension will analyze each post's caption and image
   - Events with complete info (date + time + location) will be extracted
5. **Review & Edit**: Edit extracted events directly in the UI if needed
6. **Save to Sheets**: Click "Save to Google Sheets" to export

## ⚠️ Important Information

### Event Completion Requirements

An event is marked as **complete** and extracted only if it has **all three** of:

- ✅ Specific date (not relative like "this Sunday")
- ✅ Start time (specific time, not "evening")
- ✅ Location (venue or address)

Posts with incomplete information won't be extracted.

### API Token Expiration

Google OAuth tokens automatically expire after 1 hour. The extension handles this automatically:

- If you get an authentication error, the extension will prompt you to re-authenticate
- You'll see a clear error message: _"Google authentication failed. Please re-authenticate in the extension options."_
- Simply re-authorize in the extension options to continue

### Rate Limits

- **OpenAI API**: Monitor your usage at [OpenAI Platform](https://platform.openai.com/account/usage/overview)
- **Google Sheets API**: Free tier allows 500 requests/minute
- If you hit rate limits, wait a moment and retry

### Network Resilience

The extension includes automatic retry logic:

- Image downloads are retried up to 3 times with exponential backoff
- Progress updates are ordered to prevent UI race conditions
- Failed operations display clear error messages

## 🐛 Troubleshooting

### "API key not configured" Error

**Solution**: Open extension options and verify all API keys are filled in:

- OpenAI API key
- Google Client ID
- Google API key
- Google Sheet ID

### "Google authentication failed"

**Causes & Solutions**:

- Token expired (normal after 1 hour): Click extension options and re-authenticate
- Invalid credentials: Verify your Google credentials in extension options
- Missing permissions: Ensure Google OAuth consent screen allows your account

### No events extracted

**Check these**:

1. Ensure posts have **all three required fields**: date + time + location
2. Verify the date range includes event dates
3. Check the browser console (F12 → Console) for error messages
4. Verify OpenAI API key is valid at [OpenAI Platform](https://platform.openai.com/account/api-keys)

### Image analysis not working

The extension automatically retries image downloads. If images still fail:

1. Check your internet connection
2. Try a smaller date range with fewer posts
3. Check OpenAI API status at [OpenAI Status Page](https://status.openai.com/)

### "No active tab found" Error

**Solution**: Open an Instagram tab and make sure the extension sidepanel loads

## 📊 Google Sheets Column Structure

Extracted events are saved to Google Sheets with these columns:
| Column | Type | Example |
|--------|------|---------|
| Name | Text | "Summer Music Festival" |
| URL | Link | Instagram post URL |
| Date | Text | 07/15/2024 |
| Start | Text | 3:00:00 PM |
| Location | Text | "Central Park, NYC" |
| Organizer | Text | "NYC Events" |
| Cost | Text | "Free" or "$25" |
| Summary | Text | Event description (max 25 words) |

## 🔧 Development

### Project Structure

```
├── background/          # Service worker (event extraction logic)
├── components/          # Vue components
├── lib/                 # Utility functions and API clients
├── contents/            # Content scripts
├── types/               # TypeScript types
├── sidepanel.vue        # Main UI component
├── options.vue          # Extension options/settings
└── package.json         # Dependencies
```

### Tech Stack

- **Plasmo**: Chrome extension framework
- **Vue 3**: UI framework with Composition API
- **TypeScript**: Type safety
- **OpenAI SDK**: GPT-4 and Vision API access
- **Google Sheets API**: Data storage
- **Lucide Icons**: UI icons

## 📝 License

See LICENSE file for details.

## 🤝 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review error messages in browser console (F12 → Console tab)
3. Verify all API credentials are correct and active
4. Check API status pages:
   - [OpenAI Status](https://status.openai.com/)
   - [Google Cloud Status](https://status.cloud.google.com/)
