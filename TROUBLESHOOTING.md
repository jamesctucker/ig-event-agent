# Troubleshooting Guide

Common issues and solutions for Instagram Event Agent.

## Installation Issues

### Error: `gyp: binding.gyp not found` with @parcel/watcher

**Symptoms:**

```
npm error gyp: binding.gyp not found (cwd: /Users/.../node_modules/@parcel/watcher)
npm error gyp ERR! configure error
```

**Cause:**
The `@parcel/watcher` package (used by Plasmo) requires native compilation which can fail on macOS with newer Node versions.

**Solution:**

1. **Quick Fix** - Install with --ignore-scripts:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps --ignore-scripts
```

2. **Permanent Fix** - Add `.npmrc` file to project root:

```
# .npmrc
ignore-scripts=true
legacy-peer-deps=true
```

Then run:

```bash
npm install
```

3. **Alternative** - Use pnpm instead of npm:

```bash
npm install -g pnpm
pnpm install
```

### Error: ENOTEMPTY when removing node_modules

**Cause:**
File system lock or process using the files.

**Solution:**

```bash
# Kill any Node processes
pkill -f node

# Remove with force
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

## Build Issues

### Plasmo dev server won't start

**Check:**

1. Is port 1012 or 1815 already in use?

```bash
lsof -i :1012
lsof -i :1815
```

2. Kill the process if needed:

```bash
kill -9 <PID>
```

3. Try building instead:

```bash
npm run build
```

### TypeScript errors

**Common fixes:**

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache

# Reinstall types
npm install --save-dev @types/chrome @types/node

# Check tsconfig
cat tsconfig.json
```

### SCSS compilation errors

**Solution:**

```bash
# Ensure sass is installed
npm install --save-dev sass

# Check version compatibility
npm list sass
```

## Runtime Issues

### Extension won't load in Chrome

**Checklist:**

1. Build the extension first: `npm run dev` or `npm run build`
2. Load the `build/chrome-mv3-dev` directory (not the project root)
3. Check Chrome DevTools console for errors
4. Verify manifest.json was created in build directory

### "Failed to load extension"

**Common causes:**

- Missing manifest.json
- Invalid manifest syntax
- Missing required files

**Solution:**

```bash
# Rebuild
rm -rf build .plasmo
npm run build

# Check build directory
ls -la build/chrome-mv3-prod/
```

### Content script not injecting

**Debug:**

1. Check if you're on Instagram.com
2. Open DevTools → Sources → Content Scripts
3. Verify the script is listed
4. Check Console for injection errors

**Fix:**

1. Reload the extension
2. Refresh the Instagram page
3. Check host_permissions in manifest

## API Issues

### OpenAI API errors

**Error: "Invalid API key"**

- Verify key in Options page
- Check key starts with `sk-`
- Verify key is active on platform.openai.com

**Error: "Rate limit exceeded"**

- You've hit your API quota
- Wait a few minutes
- Check usage at platform.openai.com/usage
- Upgrade your plan if needed

**Error: "Model not found"**

- You may not have access to GPT-4
- Update lib/ai.ts to use `gpt-3.5-turbo` instead
- Check your OpenAI account tier

### Google Sheets API errors

**Error: "Authentication failed"**

1. Verify OAuth client ID is correct
2. Check extension ID is added to OAuth settings
3. Try revoking and re-granting permissions:

```javascript
// In extension console
chrome.identity.clearAllCachedAuthTokens()
```

**Error: "Permission denied"**

- Check Sheet ID is correct
- Verify you have edit access to the sheet
- Ensure Sheet API is enabled in Google Cloud Console

**Error: "Quota exceeded"**

- Google Sheets has 60 writes/minute limit
- Wait a minute and try again
- Consider batching requests

## Instagram Scraping Issues

### No collections found

**Causes:**

- Not on the /saved page
- Instagram changed their HTML structure
- Page not fully loaded

**Solutions:**

1. Navigate to exact URL: `instagram.com/[username]/saved`
2. Wait for page to fully load
3. Refresh the page
4. Open extension after page loads

### Posts not loading

**Debug:**

1. Open DevTools Console
2. Look for content script errors
3. Check if Instagram's HTML changed

**Fix if selectors broke:**
Edit `contents/instagram.ts` and update selectors:

```typescript
// Old selector might be:
const posts = document.querySelectorAll('a[href*="/p/"]')

// Try alternatives:
const posts = document.querySelectorAll('article a')
```

### Images not extracted

**Causes:**

- Instagram lazy-loads images
- Image URLs are in data attributes
- Dynamic content

**Solution:**
Scroll manually first to load images, then run extraction.

## Performance Issues

### Extension is slow

**Optimizations:**

1. Reduce scrollCount in extractEvents.ts:

```typescript
scrollCount: 2 // instead of 5
```

2. Process fewer posts:

```typescript
const maxPosts = 20 // limit posts to analyze
```

3. Skip image analysis if caption has info

### High memory usage

**Causes:**

- Too many images in memory
- Large collections

**Solutions:**

1. Process in smaller batches
2. Clear cache between runs
3. Restart browser

### API costs too high

**Reduce costs:**

1. Use gpt-4o-mini for both caption and image
2. Skip image analysis unless needed:

```typescript
// In extractEvents.ts
if (post.caption && post.caption.length > 50) {
  // Only analyze captions, skip images
}
```

## Development Issues

### Hot reload not working

**Solution:**

```bash
# Stop dev server
# Clear Plasmo cache
rm -rf .plasmo

# Restart
npm run dev

# In Chrome, reload extension manually
```

### Changes not reflecting

1. Save your files
2. Wait for Plasmo to rebuild (check terminal)
3. Click "Reload" on extension in chrome://extensions
4. Refresh Instagram page

## Getting Help

### Enable Debug Mode

Add to popup.vue:

```javascript
onMounted(() => {
  console.log('Popup mounted')
  console.log('Collections:', collections.value)
  console.log('Config:', getApiConfig())
})
```

### Check Logs

1. Extension popup console: Right-click extension icon → Inspect popup
2. Background service worker: chrome://extensions → "Service worker" link
3. Content script: F12 on Instagram page → Console
4. Network requests: DevTools → Network tab

### Report Issues

Include:

- Chrome version
- Extension version
- Node version (`node -v`)
- Error messages
- Console logs
- Steps to reproduce

### Useful Commands

```bash
# Check what's running
ps aux | grep node

# Check ports in use
lsof -i -P | grep LISTEN

# Clear npm cache
npm cache clean --force

# Verify installation
npm list plasmo vue openai

# Check file permissions
ls -la

# View full npm log
cat ~/.npm/_logs/*-debug-0.log | tail -n 100
```

## Still Stuck?

1. Read the SETUP_GUIDE.md again carefully
2. Check GitHub Issues
3. Try a clean reinstall:

```bash
rm -rf node_modules package-lock.json .plasmo build
npm install
npm run dev
```

4. Use a different Node version:

```bash
nvm install 20
nvm use 20
npm install
```

5. Ask for help with specific error messages and steps to reproduce
