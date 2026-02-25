# Local LLM Configuration Validation Checklist

**Date:** February 17, 2026  
**Purpose:** Verify that OpenClaw and Morio are properly configured to use the local LLaMA 2 model  

---

## Pre-Setup Checklist

- [ ] **System Requirements Met**
  - [ ] 8GB+ RAM available
  - [ ] 10GB+ disk space available
  - [ ] Supported OS (Windows, macOS, or Linux)
  - [ ] Node.js v18+ installed
  - [ ] npm v9+ installed

- [ ] **Model File Present**
  - [ ] File exists: `./models/llama-2-7b-chat.Q2_K.gguf`
  - [ ] File size is ~4GB
  - [ ] File is readable (permissions OK)

- [ ] **Configuration Files Created**
  - [ ] `./config/openclaw-llm.json` exists
  - [ ] `./config/morio-llm.json` exists
  - [ ] Both files have valid JSON syntax

---

## Installation Verification

### Ollama Installation
```bash
# Run this command:
ollama --version

# Expected output:
# ollama version 0.x.x
```

- [ ] **Ollama Version Check**
  - [ ] Version returned successfully
  - [ ] Version is latest (0.x.x or higher)

```bash
# Run this command:
ollama list

# Expected output:
# NAME          ID              SIZE    MODIFIED
# llama2:latest <long-hash>     3.8 GB  X hours ago
```

- [ ] **LLaMA 2 Model Check**
  - [ ] llama2 appears in list
  - [ ] Size is ~3-4GB
  - [ ] Modified date is recent

---

## Service Startup Verification

### Ollama Service
```bash
# Run in Terminal 1:
ollama serve

# Expected output should contain:
# listening on 127.0.0.1:11434
# loaded model...
```

- [ ] **Ollama Started Successfully**
  - [ ] No errors in output
  - [ ] Listening message appears
  - [ ] Model loaded message appears

```bash
# In another terminal, run:
curl http://localhost:11434/api/tags

# Expected response:
# {"models":[{"name":"llama2:latest","modified_at":"..."}]}
```

- [ ] **Ollama API Responding**
  - [ ] HTTP 200 response received
  - [ ] JSON response contains model data
  - [ ] No connection errors

### OpenClaw Service

```bash
# In Terminal 2, run:
cd OpenClaw
npm install
OPENCLAW_LLM_TYPE=local npm run start

# Expected output should contain:
# agent runtime starting
# Using local LLM: llama-2-7b-chat
# listening on port 5000
```

- [ ] **OpenClaw Started Successfully**
  - [ ] Installation completed without errors
  - [ ] Local LLM configuration detected
  - [ ] Server started on port 5000

```bash
# In another terminal, run:
curl http://localhost:5000/health

# Expected response:
# {"status":"ok"}
```

- [ ] **OpenClaw API Responding**
  - [ ] HTTP 200 response received
  - [ ] Status is "ok"
  - [ ] No connection errors

### Morio Service

```bash
# In Terminal 3, run:
npm install
MORIO_LLM_TYPE=local npm run dev

# Expected output should contain:
# Morio starting
# using local llm
# connected to http://localhost:11434
```

- [ ] **Morio Started Successfully**
  - [ ] Installation completed without errors
  - [ ] Local LLM detected
  - [ ] Connected to Ollama successfully

```bash
# In browser or terminal, run:
curl http://localhost:5173

# Expected response:
# HTML content (Morio interface)
```

- [ ] **Morio Web Interface Responding**
  - [ ] HTTP 200 response received
  - [ ] HTML content returned
  - [ ] No connection errors

---

## Configuration Verification

### OpenClaw Configuration

```bash
# Check if using local model:
curl -X GET http://localhost:5000/api/config/llm

# Expected response should include:
# "type": "local"
# "model": "llama-2-7b-chat"
# "provider": "local"
```

- [ ] **OpenClaw Using Local Model**
  - [ ] Config endpoint responds
  - [ ] type is "local"
  - [ ] model is correct
  - [ ] provider is "local"

### Morio Configuration

```bash
# Check Morio LLM config:
curl -X GET http://localhost:5173/api/config/llm

# Expected response should include:
# "type": "local"
# "provider": "ollama"
# "model": "llama2"
```

- [ ] **Morio Using Local Model**
  - [ ] Config endpoint responds
  - [ ] type is "local"
  - [ ] provider is "ollama"
  - [ ] model is "llama2"

### Environment Variables

```bash
# Verify .env file includes:
grep "OPENCLAW_LLM_TYPE" .env
grep "MORIO_LLM_TYPE" .env
grep "OLLAMA_HOST" .env
```

- [ ] **OpenClaw LLM variables set**
  - [ ] OPENCLAW_LLM_TYPE=local
  - [ ] OPENCLAW_LLM_PROVIDER=local
  - [ ] OPENCLAW_LLM_MODEL=llama-2-7b-chat
  - [ ] OPENCLAW_LLM_BASE_URL=http://localhost:11434

- [ ] **Morio LLM variables set**
  - [ ] MORIO_LLM_TYPE=local
  - [ ] MORIO_LLM_PROVIDER=ollama
  - [ ] MORIO_LLM_MODEL=llama2
  - [ ] MORIO_LLM_BASE_URL=http://localhost:11434

---

## Functional Testing

### Test Ollama Generation

```bash
# Test prompt generation:
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "What is 2 plus 2?",
    "stream": false
  }'

# Expected: Response containing generated text
```

- [ ] **Ollama Can Generate**
  - [ ] HTTP 200 response received
  - [ ] Response contains generated text
  - [ ] Text is relevant to prompt
  - [ ] Response time is acceptable (< 30 seconds for first response)

### Test OpenClaw Execution

```bash
# Test agent execution:
curl -X POST http://localhost:5000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "openclaw",
    "prompt": "Introduce yourself",
    "model": "llama-2-7b-chat"
  }'

# Expected: Agent response
```

- [ ] **OpenClaw Can Execute**
  - [ ] HTTP 200 response received
  - [ ] Response contains agent output
  - [ ] Output is coherent and relevant
  - [ ] No API key errors

### Test Morio Query

```javascript
// In browser console:
fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama2',
    prompt: 'Hello, how are you?',
    stream: false
  })
})
.then(r => r.json())
.then(d => console.log(d))

// Expected: Generated response in console
```

- [ ] **Morio Can Query Model**
  - [ ] Request succeeds
  - [ ] Response contains generated text
  - [ ] Text is relevant to prompt

---

## Error Handling

### Test Error Handling

```bash
# Test with invalid model:
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "invalid-model", "prompt": "test"}'

# Expected: Error response
```

- [ ] **Proper Error Responses**
  - [ ] HTTP 4xx response for invalid request
  - [ ] Error message is descriptive
  - [ ] No crashes or hangs

### Test Timeout Handling

```bash
# Test with very long prompt:
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "llama2", "prompt": "repeat 100 times: hello ", "stream": false}'

# Should complete or timeout gracefully
```

- [ ] **Timeout Handling Works**
  - [ ] Request completes or times out gracefully
  - [ ] No hanging processes
  - [ ] Error message if timeout occurs

---

## Performance Testing

### Benchmark Response Time

```bash
# Measure first token latency:
time curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "llama2", "prompt": "test", "stream": false}'

# Expected: < 2-5 seconds
```

- [ ] **Acceptable Response Time**
  - [ ] First response: < 5 seconds
  - [ ] Subsequent responses: ~ 1-3 seconds
  - [ ] Memory usage stable

### Check Resource Usage

```bash
# Monitor during generation:
# Windows (PowerShell):
Get-Process ollama | Select-Object ProjectName, Memory

# macOS/Linux:
ps aux | grep ollama
top -p $(pgrep ollama)
```

- [ ] **Resource Usage Acceptable**
  - [ ] RAM usage: 4-6GB
  - [ ] CPU usage: < 90%
  - [ ] No memory leaks (stable over time)

---

## Integration Testing

### Test OpenClaw ↔ Ollama

```bash
# Verify OpenClaw is using Ollama backend:
tail -f OpenClaw/logs/app.log

# Should show entries like:
# [INFO] Using local LLM provider
# [INFO] Connected to http://localhost:11434
# [INFO] Model: llama-2-7b-chat
```

- [ ] **OpenClaw Connected to Ollama**
  - [ ] Connection logs appear
  - [ ] No authentication errors
  - [ ] Model correctly identified

### Test Morio ↔ Ollama

```bash
# Verify Morio is using Ollama:
# Browser DevTools → Network tab
# Make a query and check requests
# Should see POST to http://localhost:11434/api/generate
```

- [ ] **Morio Connected to Ollama**
  - [ ] API requests visible in network tab
  - [ ] Correct endpoint URL
  - [ ] Successful responses (200 status)

### Test Multi-Client Scenario

```bash
# Open 2 browser tabs, both using Morio
# Send concurrent queries

# Expected:
# Both get responses
# Second response slower due to queue
# No timeouts or crashes
```

- [ ] **Concurrent Requests Handled**
  - [ ] Multiple requests can be sent
  - [ ] All requests get responses
  - [ ] No crashes under load

---

## Production Readiness Checklist

- [ ] **All Services Running**
  - [ ] Ollama service running
  - [ ] OpenClaw service running
  - [ ] Morio service running

- [ ] **All Tests Passing**
  - [ ] Connectivity tests passed
  - [ ] Configuration tests passed
  - [ ] Functional tests passed
  - [ ] Performance acceptable

- [ ] **Error Handling Working**
  - [ ] Invalid requests handled
  - [ ] Timeouts handled gracefully
  - [ ] Resource limits respected

- [ ] **No API Keys Needed**
  - [ ] OPENAI_API_KEY not required
  - [ ] ANTHROPIC_API_KEY not required
  - [ ] No 3rd party authentication needed

- [ ] **Documentation Complete**
  - [ ] Setup guide read and understood
  - [ ] Configuration files reviewed
  - [ ] Startup scripts executable

---

## Sign-Off

- [ ] **All checklist items verified**
- [ ] **Ready for production deployment**
- [ ] **Issues documented (if any)**

---

## Troubleshooting Notes

**Issues Found:**
```
[Document any issues discovered during verification]
_____________________________________________________
_____________________________________________________
_____________________________________________________
```

**Resolution Actions:**
```
[Document steps taken to resolve issues]
_____________________________________________________
_____________________________________________________
_____________________________________________________
```

**Sign-Off Date:** _________________

**Verified By:** ___________________

---

## Quick Fixes

If any tests fail, try these in order:

1. **Restart all services:**
   ```bash
   # Kill existing processes
   killall ollama node npm 2>/dev/null || true
   sleep 2
   # Restart via script
   ./start-local-llm.sh  # or .ps1 on Windows
   ```

2. **Clear caches:**
   ```bash
   rm -rf ~/.ollama/cache
   rm -rf OpenClaw/node_modules/.cache
   rm -rf node_modules/.cache
   ```

3. **Reinstall dependencies:**
   ```bash
   cd OpenClaw && npm install && cd ..
   npm install
   ```

4. **Reset Ollama:**
   ```bash
   ollama pull llama2  # Re-download model
   ```

5. **Check system resources:**
   ```bash
   # Ensure 8GB+ RAM free
   # Ensure 10GB+ disk space
   # Monitor CPU usage
   ```

---

**Last Updated:** February 17, 2026  
**Next Review:** After deployment to production  
**Status:** ✅ Ready for Validation
