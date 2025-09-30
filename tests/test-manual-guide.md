# NRC ADAMS MCP - Manual Test Guide

## Test Set Template

Each test follows these 5 steps:

### Step 1: Search
```
Search for "[keyword]"
```
**Expected**: Document [ML_NUMBER] appears in results

### Step 2: Download
```
Download document [ML_NUMBER]
```
**Expected**: "Downloaded successfully" message

### Step 3: Verify Cache
Check logs or file system:
```bash
ls downloaded_pdfs/*/[ML_NUMBER].pdf
ls pdf-text-cache/[ML_NUMBER].txt  # Optional
```
**Expected**: PDF file exists

### Step 4: Q&A with Specific Document
```
Ask about [ML_NUMBER]: [question]
```
**Expected**: Answer contains relevant information

### Step 5: Verify Filtering
Check logs:
```bash
grep "Filter results" logs/mcp/mcp-server-*.log | tail -5
```
**Expected**: `afterFilter > 0`, results from correct document

---

## Test Set 1: ML081710326

### Documents
- **ID**: ML081710326
- **Keyword**: ACRS Safety Research
- **Question**: What is this ACRS meeting about? Who attended?
- **Expected**: Response contains "ACRS", "meeting", "safety"

### Test Steps

1. **Search**:
   ```
   Search for "ACRS Safety Research"
   ```

2. **Download**:
   ```
   Download ML081710326
   ```

3. **Verify**:
   ```bash
   ls downloaded_pdfs/*/ML081710326.pdf
   ```

4. **Q&A**:
   ```
   Ask about ML081710326: What is this ACRS meeting about? Who attended?
   ```

5. **Check Logs**:
   ```bash
   grep "ML081710326" logs/mcp/mcp-server-*.log | grep "Filter results" | tail -1
   ```

---

## Test Set 2: ML020920623

### Documents
- **ID**: ML020920623
- **Keyword**: Virgil Summer emergency
- **Question**: What is the emergency classification system?
- **Expected**: Response contains "emergency", "classification"

### Test Steps

1. **Search**:
   ```
   Search for "Virgil Summer emergency"
   ```

2. **Download**:
   ```
   Download ML020920623
   ```

3. **Verify**:
   ```bash
   ls downloaded_pdfs/*/ML020920623.pdf
   ```

4. **Q&A**:
   ```
   Ask about ML020920623: What is the emergency classification system?
   ```

5. **Check Logs**:
   ```bash
   grep "ML020920623" logs/mcp/mcp-server-*.log | grep "Filter results" | tail -1
   ```

---

## Test Set 3: ML19014A039

### Documents
- **ID**: ML19014A039
- **Keyword**: Prairie Island emergency
- **Question**: What are the protective action recommendations?
- **Expected**: Response contains "protective", "action"

### Test Steps

1. **Search**:
   ```
   Search for "Prairie Island emergency"
   ```

2. **Download**:
   ```
   Download ML19014A039
   ```

3. **Verify**:
   ```bash
   ls downloaded_pdfs/*/ML19014A039.pdf
   ```

4. **Q&A**:
   ```
   Ask about ML19014A039: What are the protective action recommendations?
   ```

5. **Check Logs**:
   ```bash
   grep "ML19014A039" logs/mcp/mcp-server-*.log | grep "Filter results" | tail -1
   ```

---

## Test Set 4: ML12305A251

### Documents
- **ID**: ML12305A251
- **Keyword**: diesel generator capacity
- **Question**: What are the diesel generator capacity requirements?
- **Expected**: Response contains "diesel", "generator", "capacity"

### Test Steps

1. **Search**:
   ```
   Search for "diesel generator capacity"
   ```

2. **Download**:
   ```
   Download ML12305A251
   ```

3. **Verify**:
   ```bash
   ls downloaded_pdfs/*/ML12305A251.pdf
   ```

4. **Q&A**:
   ```
   Ask about ML12305A251: What are the diesel generator capacity requirements?
   ```

5. **Check Logs**:
   ```bash
   grep "ML12305A251" logs/mcp/mcp-server-*.log | grep "Filter results" | tail -1
   ```

---

## Success Criteria

For each test set:
- ✅ All 5 steps pass
- ✅ document_number filtering works (check logs show `afterFilter > 0`)
- ✅ Q&A returns relevant content
- ✅ No errors in logs

## Test Results Template

| Test | Search | Download | Cache | Q&A | Filtering | Result |
|------|--------|----------|-------|-----|-----------|--------|
| 1    | ✅/❌  | ✅/❌    | ✅/❌ | ✅/❌| ✅/❌     | PASS/FAIL |
| 2    | ✅/❌  | ✅/❌    | ✅/❌ | ✅/❌| ✅/❌     | PASS/FAIL |
| 3    | ✅/❌  | ✅/❌    | ✅/❌ | ✅/❌| ✅/❌     | PASS/FAIL |
| 4    | ✅/❌  | ✅/❌    | ✅/❌ | ✅/❌| ✅/❌     | PASS/FAIL |

---

## Quick Verification Commands

### Check all PDFs:
```bash
ls -lh downloaded_pdfs/*/*.pdf | grep -E "ML081710326|ML020920623|ML19014A039|ML12305A251"
```

### Check all cache files:
```bash
ls -lh pdf-text-cache/*.txt | grep -E "ML081710326|ML020920623|ML19014A039|ML12305A251"
```

### Check all filter logs:
```bash
grep "Filter results" logs/mcp/mcp-server-*.log | grep -E "ML081710326|ML020920623|ML19014A039|ML12305A251" | tail -20
```

### Summary statistics:
```bash
echo "=== PDF Files ==="
ls downloaded_pdfs/*/*.pdf 2>/dev/null | wc -l
echo "=== Cache Files ==="
ls pdf-text-cache/*.txt 2>/dev/null | wc -l
echo "=== Q&A Success ==="
grep "Q&A completed successfully" logs/mcp/mcp-server-*.log | tail -10
```