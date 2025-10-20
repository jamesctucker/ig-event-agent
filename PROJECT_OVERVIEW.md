# Instagram Event Agent - Project Overview

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Data Flow](#data-flow)
- [API Integration](#api-integration)
- [Development](#development)

## Overview

Instagram Event Agent is a Chrome extension that uses AI to automatically extract event information from your Instagram saved collections and export them to Google Sheets.

### Use Case

Perfect for:

- Event organizers tracking local events
- Social media managers curating events
- Community managers discovering activities
- Anyone who saves Instagram posts about events

### How It Works

1. User navigates to Instagram saved collections
2. Selects a specific collection
3. Chooses a date range
4. Extension analyzes posts using AI:
   - First checks captions for event details
   - If no details in caption, analyzes images using vision AI
5. Extracts: title, date, time, location, address
6. Displays results for review
7. Saves to Google Sheets with one click

## Architecture

### Extension Components

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Popup UI   │  │   Options    │  │   Content    │  │
│  │  (Vue.js)    │  │     Page     │  │   Script     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────┬───────┴──────────────────┘          │
│                    │                                      │
│         ┌──────────▼────────────┐                        │
│         │  Background Service   │                        │
│         │    Worker (Messages)  │                        │
│         └──────────┬────────────┘                        │
│                    │                                      │
│         ┌──────────▼────────────┐                        │
│         │    Library Modules    │                        │
│         │  (AI, Sheets, Utils)  │                        │
│         └───────────────────────┘                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
                    │          │
        ┌───────────┴──┐   ┌──▼──────────────┐
        │  OpenAI API  │   │ Google Sheets   │
        │  (GPT-4)     │   │      API        │
        └──────────────┘   └─────────────────┘
```

### Component Responsibilities

#### Popup (popup.vue)

- Main user interface
- Collection selection
- Date range picker
- Event display
- Trigger extraction and saving

#### Options Page (options.vue)

- API configuration
- Settings management
- Connection testing

#### Content Script (contents/instagram.ts)

- Scrapes Instagram page structure
- Extracts collections list
- Loads and parses posts
- Finds images and captions

#### Background Service (background/)

- Message routing
- API orchestration
- Post detail scraping
- Progress tracking

#### Libraries (lib/)

- **ai.ts**: OpenAI integration (text + vision)
- **googleSheets.ts**: Google Sheets API integration
- **storage.ts**: Chrome storage management
- **utils.ts**: Helper functions

## File Structure

```
ig_event_agent/
├── assets/
│   └── icon.svg                    # Extension icon
│
├── background/
│   ├── index.ts                    # Service worker entry
│   └── messages/
│       ├── getCollections.ts       # Get saved collections
│       ├── extractEvents.ts        # Extract events from posts
│       └── saveToSheets.ts         # Save to Google Sheets
│
├── components/
│   ├── EventCard.vue               # Event display card
│   └── LoadingSpinner.vue          # Loading indicator
│
├── contents/
│   └── instagram.ts                # Instagram page scraper
│
├── lib/
│   ├── ai.ts                       # OpenAI integration
│   ├── googleSheets.ts             # Google Sheets API
│   ├── storage.ts                  # Storage utilities
│   └── utils.ts                    # Helper functions
│
├── types/
│   └── index.ts                    # TypeScript definitions
│
├── popup.vue                        # Main popup UI
├── options.vue                      # Settings page
│
├── package.json                     # Dependencies & manifest
├── tsconfig.json                    # TypeScript config
├── .prettierrc                      # Code formatting
├── .gitignore                       # Git ignore rules
│
├── README.md                        # Main documentation
├── QUICK_START.md                   # Quick start guide
├── SETUP_GUIDE.md                   # Detailed setup
├── TESTING.md                       # Testing guide
├── PROJECT_OVERVIEW.md              # This file
└── LICENSE                          # MIT License
```

## Key Features

### ✨ Core Features

1. **Collection Discovery**

   - Automatically finds all saved collections
   - Populates dropdown with names
   - Navigates to selected collection

2. **Intelligent Event Detection**

   - Caption analysis using GPT-4-mini
   - Image analysis using GPT-4-vision
   - Fallback strategy (caption → image)
   - Structured data extraction

3. **Date Range Filtering**

   - Date picker interface
   - Default to current week
   - Filters relevant posts

4. **Real-time Progress**

   - Progress bar during extraction
   - Current/total post count
   - Status messages

5. **Google Sheets Export**
   - One-click export
   - Formatted columns
   - Automatic headers
   - Links to original posts

### 🎨 UI/UX Features

- Beautiful gradient design
- Responsive layout
- Loading states
- Error handling
- Success feedback
- Hover effects
- Smooth animations

## Tech Stack

### Frontend

- **Plasmo**: Chrome extension framework
- **Vue.js 3**: UI framework (Composition API)
- **SCSS**: Styling with variables
- **TypeScript**: Type safety

### Backend/APIs

- **OpenAI GPT-4**: Text analysis
- **OpenAI GPT-4-vision**: Image analysis
- **Google Sheets API**: Data storage
- **Chrome APIs**: Extension functionality

### Build Tools

- **Plasmo CLI**: Build & packaging
- **TypeScript Compiler**: Type checking
- **Sass**: CSS preprocessing

## Data Flow

### 1. Collection Loading

```
User opens popup
    → Background: getCollections
        → Content Script: scrape /saved page
            → Find collection links
            → Extract names & IDs
        ← Return collections[]
    ← Display in dropdown
```

### 2. Event Extraction

```
User clicks "Extract Events"
    → Background: extractEvents
        → Content Script: getPosts
            → Scroll collection page
            → Extract images & captions
        ← Return posts[]

        For each post:
            → AI: analyzeCaption(caption)
            ← eventInfo or null

            If no event info:
                → AI: analyzeImage(imageUrl)
                ← eventInfo or null

            If event found:
                → Add to results[]

    ← Return events[]
    → Display in popup
```

### 3. Google Sheets Save

```
User clicks "Save to Google Sheets"
    → Background: saveToSheets
        → Get OAuth token
        → Format data as rows
        → POST to Sheets API
        ← Success/error
    ← Show status message
```

## API Integration

### OpenAI API

**Models Used:**

- `gpt-4o-mini`: Caption analysis (~$0.001/post)
- `gpt-4o`: Image analysis (~$0.01/post)

**Prompts:**

- Structured to return JSON
- Specific field extraction
- High accuracy mode (temp: 0.1)

**Rate Limits:**

- 60 requests/minute (free tier)
- Handled with batching

### Google Sheets API

**Operations:**

- Read (check headers)
- Write (append rows)
- Create (initialize sheet)

**Authentication:**

- OAuth 2.0 via Chrome Identity API
- Token caching
- Scoped to spreadsheets only

**Format:**

```
| Title | Date | Time | Location | Address | Post URL | Image URL | Added On |
```

## Development

### Prerequisites

- Node.js 18+
- Chrome browser
- OpenAI API key
- Google Cloud project

### Setup

```bash
# Install
npm install

# Development
npm run dev

# Production
npm run build

# Package
npm run package
```

### Development Workflow

1. Make changes to source files
2. Plasmo auto-rebuilds (dev mode)
3. Reload extension in Chrome
4. Test changes
5. Check console for errors

### Key Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Create distributable package
npm run package
```

### Environment Variables

```bash
PLASMO_PUBLIC_OPENAI_API_KEY=sk-...
PLASMO_PUBLIC_GOOGLE_CLIENT_ID=...
PLASMO_PUBLIC_GOOGLE_API_KEY=...
PLASMO_PUBLIC_GOOGLE_SHEET_ID=...
```

### Chrome Extension Permissions

- `storage`: Save settings
- `tabs`: Navigate collections
- `activeTab`: Access Instagram
- `identity`: Google OAuth
- `scripting`: Inject content scripts

### Host Permissions

- `https://www.instagram.com/*`
- `https://instagram.com/*`
- `https://sheets.googleapis.com/*`

## Code Style

- **TypeScript**: Strict mode
- **Vue**: Composition API, `<script setup>`
- **SCSS**: BEM-like naming, nested selectors
- **Formatting**: Prettier (2 spaces, single quotes)

## Performance

### Optimization Strategies

1. **Lazy Loading**: Load posts as needed
2. **Batching**: Process images in groups
3. **Caching**: Store API config, reuse tokens
4. **Progress Updates**: Keep UI responsive
5. **Error Recovery**: Continue on individual failures

### Benchmarks

- 10 posts: ~30 seconds
- 50 posts: ~2-3 minutes
- Memory: <500MB

## Security

### API Keys

- Stored in Chrome storage (encrypted)
- Never logged or exposed
- Configurable per-user

### Permissions

- Minimal required permissions
- Scoped to specific domains
- User must grant OAuth consent

### Data Privacy

- No data sent to third parties (except APIs)
- No tracking or analytics
- All processing happens locally

## Future Enhancements

### Potential Features

1. **Multiple Sheet Support**: Save to different sheets
2. **Filtering Options**: By event type, location
3. **Calendar Export**: iCal format
4. **Batch Collections**: Process multiple at once
5. **Scheduling**: Auto-run weekly
6. **Duplicate Detection**: Avoid saving same event
7. **Custom Prompts**: User-defined AI instructions
8. **Offline Mode**: Queue for later processing

### Known Limitations

1. Instagram may change HTML structure
2. AI not 100% accurate
3. Rate limits on APIs
4. Requires active Instagram session
5. English-optimized prompts

## Support & Contribution

### Getting Help

- Read documentation files
- Check TESTING.md for troubleshooting
- Review console errors
- Verify API configurations

### Contributing

- Follow existing code style
- Add tests for new features
- Update documentation
- Submit issues/PRs on GitHub

## License

MIT License - see LICENSE file

---

**Built with ❤️ for the Twin Cities Scout community**
