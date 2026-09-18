# Instagram Event Agent

A Chrome extension that extracts event information from Instagram saved collections and saves them to Google Sheets.

## Features

- 🔍 Browse and select Instagram saved collections
- 📅 Filter events by date ranges
- 🤖 AI-powered event detection from post captions and images
- 🖼️ Multimodal DeepSeek vision (deepseek-flash) image analysis for accurate event details
- 📊 Automatic export to Google Sheets with full event metadata
- 🔄 Automatic token refresh and retry logic for reliability

## ⚙️ Prerequisites

- Google account with access to Google Cloud Console
- DeepSeek account with API access (platform.deepseek.com)
- Chrome browser
- Node.js and npm (for development)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys (Required)

This extension requires **two** API configurations. Both must be set up or extraction will fail.

#### A. DeepSeek API Key

1. Go to [DeepSeek Platform](https://platform.deepseek.com/)
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
4. Configure the OAuth consent screen (External). While the app is in **Testing**, add your Google account under **Test users** (otherwise sign-in is blocked)
5. Create OAuth 2.0 Client ID credentials of type **Chrome Extension** — *not* Desktop or Web. `chrome.identity.getAuthToken` only works with a Chrome Extension client
6. Set the client's **Item ID** to this extension's ID: `nkogdebkolhahnmhgoeciohcifhflejj`
7. Copy the generated Client ID into `package.json` → `manifest.oauth2.client_id`

### 3. Configure the Extension

All configuration happens at runtime in the extension's **Options page** — you don't need a `.env` file.

After installing (or with `npm run dev` running):

1. Click the extension icon in Chrome (or right-click → Options)
2. Enter your **DeepSeek API key** and **Google Sheet ID**
3. Click "Test Connection" — this prompts for Google sign-in via OAuth

> **Why not `.env`?** Plasmo inlines any `PLASMO_PUBLIC_*` variable into the built bundle, which would ship your API keys inside the packaged extension. Runtime config via the Options page keeps secrets in `chrome.storage` only. (`PLASMO_PUBLIC_GOOGLE_SHEET_ID` remains available as a non-secret default for personal dev.)

### 4. Google Sign-In

The extension signs in with `chrome.identity.getAuthToken`, which requires an OAuth client of type **Chrome Extension** whose **Item ID** is bound to this extension's ID.

The extension ID is pinned in `package.json` (`manifest.key`), so it stays the same across dev/prod builds and machines:

```
Extension ID:  nkogdebkolhahnmhgoeciohcifhflejj
Redirect URI:  https://nkogdebkolhahnmhgoeciohcifhflejj.chromiumapp.org/   (derived automatically — do not enter manually)
```

The `client_id` currently in `package.json` belongs to the author's Google Cloud project. To run against your own project:

1. Create an OAuth client of type **Chrome Extension**, Item ID = `nkogdebkolhahnmhgoeciohcifhflejj`
2. Add `https://www.googleapis.com/auth/spreadsheets` to the consent screen's scopes
3. Replace `client_id` in `package.json` → `manifest.oauth2`
4. Reload the extension in `chrome://extensions`

> **Common error:** `Error 400: invalid_request` ("IG Event Agent sent an invalid request") means the OAuth client is the wrong type (Desktop/Web instead of Chrome Extension) or its Item ID doesn't match the extension ID above. If the app's consent screen is in Testing mode, also confirm your Google account is listed as a test user.

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

- **DeepSeek API**: Monitor your usage at [DeepSeek Platform](https://platform.deepseek.com/)
- **Google Sheets API**: Free tier allows 500 requests/minute
- If you hit rate limits, wait a moment and retry

### Network Resilience

The extension includes automatic retry logic:

- Image downloads are retried up to 3 times with exponential backoff
- Progress updates are ordered to prevent UI race conditions
- Failed operations display clear error messages

## 🐛 Troubleshooting

### "API key not configured" Error

**Solution**: Open extension options and verify both settings are filled in:

- DeepSeek API key
- Google Sheet ID

### "Google authentication failed"

**Causes & Solutions**:

- Token expired (normal after 1 hour): Click extension options and re-authenticate
- Invalid credentials: Verify your Google credentials in extension options
- Missing permissions: Ensure Google OAuth consent screen allows your account

### Google sign-in fails with "Error 400: invalid_request" / "Custom URI scheme is not supported on Chrome apps"

**Use Google Chrome.** `chrome.identity.getAuthToken` relies on Chrome's built-in Google
account integration; Brave (and some other Chromium forks) don't implement it and return this
error regardless of how the OAuth client is configured. The same build signs in fine in Chrome.

If you're already on Chrome, then the OAuth client is misconfigured — see [Google Sign-In](#4-google-sign-in):
it must be type **Chrome Extension** with Item ID `nkogdebkolhahnmhgoeciohcifhflejj`.

### No events extracted

**Check these**:

1. Ensure posts have **all three required fields**: date + time + location
2. Verify the date range includes event dates
3. Check the browser console (F12 → Console) for error messages
4. Verify DeepSeek API key is valid at [DeepSeek Platform](https://platform.deepseek.com/)

### Image analysis not working

The extension automatically retries image downloads. If images still fail:

1. Check your internet connection
2. Try a smaller date range with fewer posts
3. Check DeepSeek API status at [DeepSeek Platform](https://platform.deepseek.com/)

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
- **OpenAI SDK**: wired to DeepSeek's OpenAI-compatible API (deepseek-flash, text + vision)
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
   - [DeepSeek Platform](https://platform.deepseek.com/)
   - [Google Cloud Status](https://status.cloud.google.com/)
