# Testing Guide

This guide helps you test the Instagram Event Agent extension.

## Pre-Testing Checklist

- [ ] All API keys configured (OpenAI, Google Sheets)
- [ ] Extension loaded in Chrome
- [ ] Google OAuth setup completed
- [ ] Instagram account logged in
- [ ] Some posts saved to collections

## Manual Testing Steps

### 1. Test Extension Installation

**Expected:**

- Extension icon appears in Chrome toolbar
- Options page opens on first install

**Steps:**

1. Load unpacked extension
2. Check if icon is visible
3. Verify options page opens

### 2. Test Options Page

**Expected:**

- All form fields are present
- Settings save successfully
- Test connection works

**Steps:**

1. Right-click extension icon → Options
2. Enter API keys
3. Click "Save Settings"
4. Click "Test Connection"
5. Verify success message

### 3. Test Collection Detection

**Expected:**

- Extension detects saved collections
- Dropdown populates with collection names

**Steps:**

1. Go to `instagram.com/[your-username]/saved`
2. Open extension popup
3. Verify collections are shown in dropdown
4. If no collections, create one on Instagram first

**Troubleshooting:**

- If collections don't load, refresh the page
- Make sure you're on the exact `/saved` URL
- Check console for errors (F12)

### 4. Test Collection Navigation

**Expected:**

- Selecting a collection navigates to it

**Steps:**

1. Select a collection from dropdown
2. Page should navigate to that collection URL
3. Verify URL changed to `/saved/[collection-id]`

### 5. Test Event Extraction

**Expected:**

- Extension scrolls and loads posts
- Progress bar updates
- Events are extracted and displayed

**Test Cases:**

#### A. Caption with Event Info

**Post:** Caption like "Art Gallery Opening! Friday, Oct 25, 7pm at The Modern, 123 Main St"
**Expected:** Should extract all details from caption

#### B. Image Flyer

**Post:** Image of event flyer with clear text
**Expected:** Should use vision AI to extract from image

#### C. No Event Info

**Post:** Regular photo with no event details
**Expected:** Should skip this post

**Steps:**

1. Select a collection with test posts
2. Set date range to include your test posts
3. Click "Extract Events"
4. Wait for processing (watch progress bar)
5. Verify extracted events match actual content

### 6. Test Date Filtering

**Expected:**

- Only posts in date range are processed

**Steps:**

1. Set narrow date range (e.g., 1 day)
2. Extract events
3. Verify only relevant posts processed

### 7. Test Google Sheets Export

**Expected:**

- Events save to Google Sheet
- Correct formatting and data

**Steps:**

1. After extracting events
2. Click "Save to Google Sheets"
3. Open your Google Sheet
4. Verify:
   - Headers exist (Title, Date, Time, Location, etc.)
   - Events are added as new rows
   - Data is correctly formatted
   - Links work

### 8. Test Error Handling

**Expected:**

- Graceful error messages
- No crashes

**Test Cases:**

#### A. Invalid API Key

1. Enter wrong OpenAI key
2. Try to extract events
3. Should show clear error message

#### B. No Internet

1. Disconnect internet
2. Try any operation
3. Should show connection error

#### C. Empty Collection

1. Select collection with no posts
2. Try to extract
3. Should show "No posts found" message

#### D. Invalid Date Range

1. Set end date before start date
2. Button should be disabled

### 9. Test Performance

**Expected:**

- Handles large collections
- No memory leaks
- Reasonable processing time

**Steps:**

1. Test with collection of 50+ posts
2. Monitor memory usage (Chrome Task Manager)
3. Verify it completes without crashing

**Benchmarks:**

- 10 posts: ~30 seconds
- 50 posts: ~2-3 minutes
- Should not exceed 500MB memory

### 10. Test UI/UX

**Expected:**

- Responsive design
- Clear feedback
- Professional appearance

**Checklist:**

- [ ] All buttons have hover states
- [ ] Loading states show properly
- [ ] Error messages are clear
- [ ] Success messages appear
- [ ] Progress updates in real-time
- [ ] Event cards display correctly
- [ ] Icons render properly

## Integration Testing

### Full Workflow Test

1. Start at Instagram home page
2. Navigate to saved collections
3. Open extension
4. Select a collection
5. Set date range
6. Extract events
7. Review results
8. Save to Google Sheets
9. Verify in Google Sheets

**Expected:** Complete flow without errors

## API Testing

### OpenAI API

**Test Caption Analysis:**

```javascript
// In console
const caption = 'Join us for Summer Festival! Saturday June 15, 2pm-8pm at Central Park'
// Should extract: title, date, time, location
```

**Test Image Analysis:**

- Use clear event flyer
- Should extract all visible text

### Google Sheets API

**Test Authentication:**

- First save should request permissions
- Subsequent saves use cached token

**Test Write:**

- Data appears in correct columns
- Special characters handled
- URLs are clickable

## Automated Testing Ideas

While this extension is primarily manual testing, here are areas for potential automation:

1. **Unit Tests:**

   - Date parsing functions
   - Text cleaning utilities
   - Event validation

2. **Mock API Tests:**

   - Mock OpenAI responses
   - Test extraction logic
   - Verify formatting

3. **E2E Tests:**
   - Puppeteer to automate Chrome
   - Test full workflow
   - Screenshot comparisons

## Known Limitations

1. **Instagram Structure Changes:**

   - Instagram may update their HTML structure
   - Content script selectors may need updates

2. **Rate Limits:**

   - OpenAI: 60 requests/minute (free tier)
   - Google Sheets: 60 writes/minute

3. **Image Quality:**

   - Low-res images may not extract well
   - Handwritten text may fail

4. **Date Parsing:**
   - Informal dates ("next Friday") may not work
   - Different languages not fully supported

## Reporting Issues

When reporting bugs, include:

1. Chrome version
2. Extension version
3. Steps to reproduce
4. Expected vs actual behavior
5. Console errors (F12)
6. Screenshot if relevant

## Testing Checklist

Use this for each release:

- [ ] Fresh install works
- [ ] Update preserves settings
- [ ] All API integrations work
- [ ] UI renders correctly
- [ ] Error handling works
- [ ] Performance acceptable
- [ ] Documentation accurate
- [ ] No console errors
- [ ] Works on different accounts
- [ ] Mobile Instagram (desktop view) works

## Test Data

### Sample Event Captions

Use these for testing caption extraction:

```
1. "🎉 New Year's Party! December 31, 2025, 9pm-2am @ The Grand Ballroom, 456 Party Ave"

2. "Art Exhibition Opening
   Friday, January 10th, 6-9 PM
   Gallery Modern
   789 Art Street, Downtown"

3. "Food Truck Festival this Saturday! Noon to 8pm at Riverfront Park"

4. "Concert Alert! The Rockers live on 2/14/25 at 8pm, City Arena"
```

### Sample Test Collections

Create Instagram collections with:

- Mix of event flyers and captions
- Different date formats
- Various event types
- Some non-event posts

## Success Criteria

For the extension to be "working":

✅ Extracts events from at least 70% of valid posts
✅ No crashes during normal use
✅ Google Sheets integration works
✅ Clear user feedback at all steps
✅ Handles errors gracefully
✅ Completes in reasonable time
✅ Uses appropriate amount of API credits

Happy Testing! 🧪
