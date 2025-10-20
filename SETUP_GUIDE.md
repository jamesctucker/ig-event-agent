# Instagram Event Agent - Setup Guide

This guide will walk you through setting up the Instagram Event Agent Chrome extension.

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Chrome browser
- OpenAI API account
- Google Cloud account

## Installation

### 1. Clone and Install Dependencies

```bash
cd ig_event_agent
npm install
```

### 2. Set Up OpenAI API

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it will start with `sk-`)

### 3. Set Up Google Sheets API

#### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **Google Sheets API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

#### Configure OAuth 2.0

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the OAuth consent screen:
   - User Type: External
   - App name: Instagram Event Agent
   - Add your email as developer contact
   - Scopes: Add `https://www.googleapis.com/auth/spreadsheets`
4. Create OAuth client ID:
   - Application type: Chrome Extension
   - Add your extension ID (you'll get this after loading the extension)
5. Copy the Client ID

#### Create API Key

1. In "Credentials", click "Create Credentials" > "API key"
2. Copy the API key
3. Optionally restrict the key to Google Sheets API only

#### Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet
3. Name it (e.g., "Instagram Events")
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
   ```

### 4. Configure the Extension

#### Option A: Using .env file (Development)

Create a `.env` file in the project root:

```bash
PLASMO_PUBLIC_OPENAI_API_KEY=sk-your-openai-key-here
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
PLASMO_PUBLIC_GOOGLE_API_KEY=AIza-your-google-api-key
PLASMO_PUBLIC_GOOGLE_SHEET_ID=your-sheet-id-here
```

#### Option B: Using Extension Options Page (Production)

1. Build and load the extension first (see step 5)
2. Right-click the extension icon > Options
3. Enter your API keys in the settings page
4. Click "Save Settings"
5. Test the connection to verify

### 5. Build and Load the Extension

#### Development Mode

```bash
npm run dev
```

This will create a `build/chrome-mv3-dev` directory.

#### Production Build

```bash
npm run build
```

This will create a `build/chrome-mv3-prod` directory.

#### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `build/chrome-mv3-dev` (or `chrome-mv3-prod`) directory
5. Copy the Extension ID shown
6. Go back to Google Cloud Console and update your OAuth client to include this extension ID

### 6. Update OAuth Settings with Extension ID

1. Go back to Google Cloud Console
2. Navigate to "APIs & Services" > "Credentials"
3. Edit your OAuth 2.0 Client ID
4. Add the extension ID to authorized JavaScript origins:
   ```
   chrome-extension://[YOUR_EXTENSION_ID]
   ```
5. Save changes

## Usage

### Step 1: Navigate to Instagram Saved Collections

1. Go to Instagram
2. Click your profile
3. Click on "Saved"
4. Your URL should look like: `https://www.instagram.com/[username]/saved`

### Step 2: Open the Extension

1. Click the extension icon in Chrome toolbar
2. You should see a list of your saved collections

### Step 3: Select Collection and Date Range

1. Choose a collection from the dropdown
2. The extension will navigate to that collection
3. Set your desired date range using the date pickers
4. Click "Extract Events"

### Step 4: Review and Save

1. The extension will:
   - Scroll through the collection to load posts
   - Analyze captions for event information
   - If no event info in caption, analyze the image using AI
   - Extract: title, date, time, location, address
2. Review the extracted events
3. Click "Save to Google Sheets" to export

## Troubleshooting

### Extension not detecting collections

- Make sure you're on the `/saved` page
- Refresh the Instagram page
- Try scrolling down to load more collections

### "Failed to authenticate with Google" error

- Check that your Google Client ID is correct
- Verify the extension ID is added to OAuth settings
- Make sure you granted permissions during first use

### "Rate limit exceeded" from OpenAI

- You've hit your OpenAI API usage limit
- Check your usage at platform.openai.com
- Consider upgrading your plan or waiting

### Events not being detected

- The AI might not find clear event information
- Try posts with clear event flyers or detailed captions
- Check that dates in posts are within your selected range

### Google Sheets not updating

- Verify Sheet ID is correct
- Check that you have edit permissions on the sheet
- Test connection in the Options page

## Tips for Best Results

1. **Use Clear Event Posts**: Posts with event flyers or detailed captions work best
2. **Reasonable Date Ranges**: Keep ranges narrow (7-14 days) for better performance
3. **Collection Organization**: Organize your saved posts into specific collections
4. **Review Before Saving**: Always review extracted events before saving to sheets
5. **API Usage**: Be mindful of OpenAI API costs with large collections

## Cost Estimates

### OpenAI API Costs (Approximate)

- Caption analysis: ~$0.001 per post (GPT-4-mini)
- Image analysis: ~$0.01-0.02 per image (GPT-4-vision)
- Average: ~$0.02 per post if analyzing images

Example: Analyzing 50 posts ≈ $1.00

### Google Sheets API

- Free up to 60 requests per minute
- This extension typically uses 1-2 requests per session

## Privacy & Security

- API keys are stored locally in Chrome's storage
- No data is sent to third parties except OpenAI and Google
- Instagram content is accessed only while you're logged in
- The extension cannot access your Instagram password

## Support

For issues or questions:

- Check the [GitHub Issues](https://github.com/yourusername/ig_event_agent/issues)
- Review OpenAI and Google API documentation
- Ensure all permissions are granted in Chrome

## License

MIT License - See LICENSE file for details
