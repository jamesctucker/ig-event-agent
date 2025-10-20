# Instagram Event Agent

A Chrome extension that extracts event information from Instagram saved collections and saves them to Google Sheets.

## Features

- Browse and select Instagram saved collections
- Pick date ranges to filter events
- AI-powered event detection from post captions
- Multimodal AI image analysis for event details
- Automatic export to Google Sheets

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file from `.env.example` and add your API keys:

   - OpenAI API key for AI analysis
   - Google Sheets API credentials

3. Run in development mode:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
```

## Configuration

### Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create OAuth 2.0 credentials
5. Add your credentials to `.env`

### OpenAI Setup

1. Get your API key from [OpenAI Platform](https://platform.openai.com/)
2. Add it to `.env` as `PLASMO_PUBLIC_OPENAI_API_KEY`

## Usage

1. Navigate to your Instagram saved collections page
2. Click the extension icon
3. Select a collection from the dropdown
4. Choose your date range
5. Click "Extract Events" to analyze posts
6. Review extracted events and save to Google Sheets

## Tech Stack

- **Plasmo**: Chrome extension framework
- **Vue.js**: UI framework
- **SCSS**: Styling
- **OpenAI GPT-4**: Text and image analysis
- **Google Sheets API**: Data storage
