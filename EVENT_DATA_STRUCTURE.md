# Event Data Structure

This document describes the event data structure used throughout the Instagram Event Agent extension.

## Overview

The extension now uses the same data structure as `sustainable_events.csv` to ensure consistency with your existing event data.

## Event Interface

```typescript
interface Event {
  name?: string // Event name/title
  url?: string // Instagram post URL
  date?: string // Event date (MM/DD/YYYY format preferred)
  start?: string // Start time (e.g., "7:00:00 PM", "6:30:00 PM")
  location?: string // Venue/location name with address if available
  organizer?: string // Event organizer/host name
  cost?: string // Cost information (e.g., "Free", "$15", "Free (registration required)")
  summary?: string // Event description/summary
  imageUrl?: string // Instagram image URL (optional, for reference)
  caption?: string // Original Instagram caption (optional, for reference)
}
```

## Google Sheets Columns

When events are saved to Google Sheets, they're saved in the following order:

| Column | Field     | Description        | Example                                                        |
| ------ | --------- | ------------------ | -------------------------------------------------------------- |
| A      | Name      | Event title/name   | "A Mayoral Forum for Minneapolis' Future"                      |
| B      | URL       | Instagram post URL | "https://www.instagram.com/p/ABC123/"                          |
| C      | Date      | Event date         | "10/15/2025"                                                   |
| D      | Start     | Start time         | "5:00:00 PM"                                                   |
| E      | Location  | Venue with address | "The Capri Theater, 2027 West Broadway, Minneapolis, MN 55411" |
| F      | Organizer | Event organizer    | "The African American Leadership Forum"                        |
| G      | Cost      | Cost information   | "Free (registration required)"                                 |
| H      | Summary   | Event description  | "Shape the conversation about Minneapolis's future..."         |

## AI Extraction

The AI is configured to extract these fields in this exact format:

### From Captions (GPT-4-mini)

- Analyzes Instagram post captions
- Extracts structured event information
- Looks for dates, times, locations, organizers, costs, and descriptions

### From Images (GPT-4-vision)

- Analyzes event flyers, posters, screenshots
- Reads visible text from images
- Falls back to this if caption doesn't contain event info

## Date Format

**Preferred format:** `MM/DD/YYYY`

Examples:

- `10/15/2025`
- `12/31/2025`
- `01/05/2026`

The AI is instructed to convert dates to this format when possible.

## Time Format

**Preferred format:** `HH:MM:SS AM/PM`

Examples:

- `7:00:00 PM`
- `6:30:00 PM`
- `9:00:00 AM`

## Cost Format

Be as specific as possible:

Good examples:

- `Free`
- `$15`
- `Free (registration required)`
- `$10-$15 suggested donation`
- `$60 per person`
- `$70 ($60 ASI member) + $30 material fee`
- `Advance Registration Required` (when cost not specified)

## Location Format

Include as much detail as possible:

Good examples:

- `The Capri Theater, 2027 West Broadway, Minneapolis, MN 55411`
- `Lake Harriet Upper`
- `Dayton's Bluff Library, 645 E 7th St, Saint Paul, MN`
- `3675 Arboretum Drive, Chaska, MN 55318`

## Summary/Description

A brief but engaging description of the event (max 25 words) written in newsletter style to appeal to local community readers:

Good examples:

- "Shape the conversation about Minneapolis's future at this community mayoral forum."
- "Learn the principles of capsule wardrobing, identify your personal style, and discover sustainable garment sourcing."
- "Create art in a relaxed setting and connect with fellow community members during this open art night."

## Example Event

Here's a complete example matching the CSV structure:

```javascript
{
  name: "Community Seed Circles",
  url: "https://www.instagram.com/p/ABC123/",
  date: "10/15/2025",
  start: "6:00:00 PM",
  location: "Dayton's Bluff Library, 645 E 7th St, Saint Paul, MN",
  organizer: "Urban Roots MN",
  cost: "Free",
  summary: "Help sort seeds, replenish the seed library, and chat with neighbors about gardens. Volunteers receive orientation and tea.",
  imageUrl: "https://instagram.fxxx.jpg", // Instagram CDN URL
  caption: "Join us tonight for Community Seed Circles! 6pm at Dayton's Bluff Library..." // Original caption
}
```

## UI Display

In the extension popup, events are displayed with Lucide icons:

- Calendar icon - Date
- Clock icon - Start time
- MapPin icon - Location
- Users icon - Organizer
- DollarSign icon - Cost
- FileText icon - Summary

## Migration from Old Structure

### Old Structure (deprecated)

```typescript
{
  title: string // → now: name
  date: string // → same
  time: string // → now: start
  location: string // → same
  address: string // → merged into location
  postUrl: string // → now: url
  imageUrl: string // → same
}
```

### Changes Made

1. `title` → `name` (matches CSV header)
2. `time` → `start` (matches CSV header)
3. `address` → merged into `location` field
4. `postUrl` → `url` (matches CSV header)
5. Added `organizer` field
6. Added `cost` field
7. Added `summary` field

## Data Flow

```
Instagram Post
    ↓
Content Script (scrape image & caption)
    ↓
AI Analysis (caption first, then image if needed)
    ↓
Extract Event Data (match structure)
    ↓
Display in Popup (with icons)
    ↓
Google Sheets (8 columns: Name, URL, Date, Start, Location, Organizer, Cost, Summary)
```

## Validation

An event is considered valid if it has:

- **Minimum required:** `date` AND `location`
- **Recommended:** All fields filled when available
- `hasEventInfo: true` flag from AI

## Tips for Best Results

1. **Save posts with clear event information**

   - Event flyers work best
   - Detailed captions are ideal
   - Avoid vague posts

2. **Date range selection**

   - Narrow ranges (7-14 days) work best
   - Match the dates visible in posts

3. **Review before saving**

   - AI isn't perfect
   - Verify extracted information
   - Edit manually in Google Sheets if needed

4. **Organizer field**

   - Often found in post caption or image
   - May be Instagram account name
   - Leave blank if not found

5. **Summary field**
   - AI extracts from captions or flyer text
   - Written in engaging, newsletter-style tone for local community readers
   - Highlights what makes the event special and worth attending

## Future Enhancements

Potential additions to the structure:

- `endTime` - event end time
- `registrationUrl` - separate from Instagram URL
- `category` - event type/category
- `tags` - searchable tags
- `capacity` - event capacity/size
- `ageRestriction` - age requirements
- `accessibility` - accessibility information

---

For technical implementation details, see:

- `lib/googleSheets.ts` - Google Sheets integration
- `lib/ai.ts` - AI extraction prompts
- `types/index.ts` - TypeScript interfaces
- `popup.vue` - UI display logic
