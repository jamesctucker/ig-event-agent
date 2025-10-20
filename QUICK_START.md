# Quick Start Guide

Get started with Instagram Event Agent in 5 minutes!

## 1. Install Dependencies

```bash
npm install
```

## 2. Get Your API Keys

### OpenAI (Required)

1. Visit https://platform.openai.com/api-keys
2. Create an API key
3. Copy it (starts with `sk-`)

### Google Sheets (Required)

1. Visit https://console.cloud.google.com/
2. Create a project and enable Google Sheets API
3. Create OAuth 2.0 credentials for Chrome Extension
4. Create an API key
5. Create a Google Sheet and copy its ID from the URL

## 3. Configure Environment

Create a `.env` file:

```bash
PLASMO_PUBLIC_OPENAI_API_KEY=sk-your-key-here
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
PLASMO_PUBLIC_GOOGLE_API_KEY=AIza-your-key
PLASMO_PUBLIC_GOOGLE_SHEET_ID=your-sheet-id
```

## 4. Run Development Build

```bash
npm run dev
```

## 5. Load in Chrome

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `build/chrome-mv3-dev`

## 6. Update OAuth Settings

1. Copy your extension ID from Chrome
2. Go back to Google Cloud Console
3. Add extension ID to OAuth client

## 7. Test It Out!

1. Go to Instagram.com/[your-username]/saved
2. Click the extension icon
3. Select a collection
4. Pick a date range
5. Extract events!

## Troubleshooting

**"No collections found"**

- Make sure you're on `/saved` page
- Refresh the page

**"Authentication failed"**

- Check your Google OAuth settings
- Make sure extension ID is added

**"OpenAI error"**

- Verify your API key is correct
- Check your OpenAI account has credits

## Need More Help?

See the full [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.
