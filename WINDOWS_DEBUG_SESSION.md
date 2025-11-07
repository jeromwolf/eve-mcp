# Windows Debugging Session Quick Reference

**Date**: 2025-11-06
**Branch**: `fix/windows-puppeteer-v3`
**Status**: ❌ UNRESOLVED - 8+ hours debugging
**Issue**: Windows search returns 0 results, Mac returns 25 results

## The Core Problem

Browser initialization function `_initializeBrowser()` is **NEVER CALLED** on Windows:

```
Expected logs (MISSING):
✅ "🔧 Platform: win32, Headless: false, Timeout: 120000ms"
✅ "✅ Browser initialized successfully"

Actual timeline:
05:07:07.488: "Initializing ADAMS scraper"
05:07:08.421: "Performing real ADAMS search" (0.9s - too fast!)
05:07:12.864: "Search failed: Connection closed"
```

## Root Cause Hypothesis

**File**: `src/adams-real-improved.ts` (Line 44)

```typescript
async initialize() {
  if (this.browser) return;  // ← THIS IS THE PROBLEM!

  if (this.browserInitPromise) {
    await this.browserInitPromise;
    return;
  }

  this.browserInitPromise = this._initializeBrowser();
  await this.browserInitPromise;
}
```

**Theory**: Browser instance already exists (from previous init or failed state), causing early return and skipping `_initializeBrowser()` which has all the Windows-specific fixes.

## Immediate Next Steps

### 1. Add Diagnostic Logging (PRIORITY)

**Location**: `src/adams-real-improved.ts:44`

```typescript
async initialize() {
  logger.info('🔍 INIT START: browser exists?', {
    exists: !!this.browser,
    promiseExists: !!this.browserInitPromise,
    platform: process.platform
  });

  if (this.browser) {
    logger.info('⚠️ Browser already initialized, skipping _initializeBrowser()');
    logger.info('⚠️ Browser details:', {
      isConnected: this.browser.isConnected(),
      wsEndpoint: this.browser.wsEndpoint()
    });
    return;
  }

  if (this.browserInitPromise) {
    logger.info('⏳ Browser init in progress, waiting...');
    await this.browserInitPromise;
    return;
  }

  logger.info('✅ Starting new browser initialization...');
  this.browserInitPromise = this._initializeBrowser();
  await this.browserInitPromise;
}
```

### 2. Add Logging Inside _initializeBrowser()

**Location**: `src/adams-real-improved.ts:58` (first line of function)

```typescript
private async _initializeBrowser() {
  logger.info('🚀 _initializeBrowser() CALLED - Windows fixes active');

  const perf = measurePerformance('Browser initialization');
  try {
    const isWindows = process.platform === 'win32';
    logger.info('🔧 Platform detected:', { isWindows, platform: process.platform });

    // ... rest of function
```

### 3. Force Browser Recreation Option

Add parameter to force re-init even if browser exists:

```typescript
async initialize(forceNew = false) {
  logger.info('🔍 INIT START', {
    forceNew,
    browserExists: !!this.browser,
    platform: process.platform
  });

  if (forceNew && this.browser) {
    logger.info('🔄 Force flag set - closing existing browser');
    try {
      await this.close();
      this.browser = null;
      this.browserInitPromise = null;
      logger.info('✅ Browser closed successfully');
    } catch (error) {
      logger.error('❌ Error closing browser:', error);
    }
  }

  // ... rest of initialize() logic
}
```

Then call with `await this.scraper.initialize(true);` from search-service.ts

## Files to Modify

1. **src/adams-real-improved.ts** (lines 44-56, 58-96)
2. **src/services/search-service.ts** (line 75) - optional forceNew parameter

## Testing Commands (Windows)

```bash
# 1. Make changes to src/adams-real-improved.ts
# 2. Rebuild
npm run build

# 3. Check build file has changes
findstr "INIT START" build\adams-real-improved.js

# 4. Run Claude Desktop and test search
# 5. Check logs
type logs\mcp\mcp-server-2025-11-06.log | findstr "INIT"
```

## Expected Outcome After Fix

With the new logging, we will see one of these scenarios:

### Scenario A: Browser exists (skipping init)
```
🔍 INIT START: browser exists? { exists: true, ... }
⚠️ Browser already initialized, skipping _initializeBrowser()
⚠️ Browser details: { isConnected: false, wsEndpoint: '...' }
```
→ **Solution**: Force browser recreation or fix existing browser state

### Scenario B: Browser init called but failing
```
🔍 INIT START: browser exists? { exists: false, ... }
✅ Starting new browser initialization...
🚀 _initializeBrowser() CALLED - Windows fixes active
🔧 Platform detected: { isWindows: true, platform: 'win32' }
❌ Error: [actual error message]
```
→ **Solution**: Fix the specific error in browser launch

### Scenario C: Browser init not called for other reason
```
🔍 INIT START: browser exists? { exists: false, promiseExists: true, ... }
⏳ Browser init in progress, waiting...
```
→ **Solution**: Check if promise is hanging or rejected

## Alternative Approaches if Still Failing

1. **Try Playwright** instead of Puppeteer:
   - More reliable on Windows
   - Better error messages
   - Modern API

2. **Check Windows Security**:
   - Windows Defender logs
   - Firewall blocking Puppeteer
   - Event Viewer for blocked processes

3. **Network Environment**:
   - Test from different network
   - Check corporate proxy settings
   - Try VPN on/off

4. **ADAMS API Direct Access**:
   - Skip browser automation
   - Use API calls if available
   - May require different authentication

## Success Criteria

✅ Browser initialization logs appear in Windows logs
✅ Chrome window opens and navigates to ADAMS
✅ Search returns > 0 results
✅ Same behavior as Mac (25 documents found)

## Current Files State

- ✅ Branch: `fix/windows-puppeteer-v3` created
- ✅ Windows-specific code added (headless: false, longer timeouts)
- ✅ Code verified in both src/ and build/ files
- ❌ Still not working - root cause identified but not fixed

## Time Investment

- Started: 2025-11-06 morning
- Current: 2025-11-06 evening
- Total: 8+ hours
- Status: Root cause identified, solution ready to implement

---

**When you resume on Windows**:
1. Read this document
2. Implement the 3 logging additions above
3. Rebuild with `npm run build`
4. Test in Claude Desktop
5. Analyze new logs to determine which scenario (A, B, or C)
6. Apply appropriate solution
