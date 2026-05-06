# Local LLM Integration Guide

**Date:** February 17, 2026  
**Model:** LLaMA 2 7B Chat (Quantized)  
**No API Keys Required** ✅

---

## Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Setup Instructions](#setup-instructions)
4. [OpenClaw Configuration](#openclaw-configuration)
5. [Morio Configuration](#morio-configuration)
6. [Running Both Agents](#running-both-agents)
7. [Testing & Validation](#testing--validation)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

```bash
# 1. Install Ollama (if not already installed)
# Download from: https://ollama.ai

# 2. Pull LLaMA 2 model
ollama pull llama2

# 3. Start Ollama service
ollama serve

# 4. In a new terminal, start OpenClaw
cd OpenClaw
npm install
npm run start

# 5. In another terminal, start Morio
cd ../
npm run dev  # or appropriate Morio startup command
```

---

## Prerequisites

### System Requirements
- **RAM:** 8GB minimum (16GB+ recommended)
- **Disk Space:** 10GB for model + dependencies
- **CPU:** Modern multi-core processor
- **OS:** Windows, macOS, or Linux

### Software Requirements
- **Node.js:** v18+ (already installed)
- **npm or pnpm:** v9+ (already installed)
- **Ollama:** Latest version (for model serving)
- **Python:** 3.9+ (optional, for running models directly)

### Installed Model
- ✅ LLaMA 2 7B Chat quantized (Q2_K format)
- Location: `./models/llama-2-7b-chat.Q2_K.gguf`
- Size: ~4GB RAM when loaded
- Context Window: 4K tokens
- Max Output: 2K tokens

---

## Setup Instructions

### Step 1: Install Ollama

**Windows:**
```bash
# Download installer from https://ollama.ai
# Or use package manager
winget install ollama
```

**macOS:**
```bash
# Using Homebrew
brew install ollama

# Or download from https://ollama.ai
```

**Linux (Ubuntu/Debian):**
```bash
curl https://ollama.ai/install.sh | sh
```

### Step 2: Pull the LLaMA 2 Model

```bash
# This downloads and prepares the model for serving
ollama pull llama2

# Verify installation
ollama list
# Expected output should show: llama2:latest
```

### Step 3: Start Ollama Service

**Option A: Direct (Foreground)**
```bash
ollama serve
# Service runs on: http://localhost:11434
# Keep this terminal open
```

**Option B: Background (Recommended)**

**Windows (PowerShell):**
```powershell
# Start as background job
Start-Job { ollama serve }

# Or use Task Scheduler for auto-start
```

**macOS:**
```bash
# Start with LaunchAgent (auto-starts on login)
brew services start ollama

# Check status
brew services list
```

**Linux (systemd):**
```bash
# Start service
sudo systemctl start ollama

# Enable auto-start
sudo systemctl enable ollama

# Check status
sudo systemctl status ollama
```

### Step 4: Verify Ollama is Running

```bash
# Test endpoint
curl http://localhost:11434/api/tags

# Should return:
# {"models":[{"name":"llama2:latest","modified_at":"..."}]}
```

---

## OpenClaw Configuration

### Configuration Files

**Primary Config:** `config/openclaw-llm.json`

```json
{
  "models": {
    "providers": {
      "local": {
        "baseUrl": "http://localhost:8000",
        "api": "openai-completions",
        "models": [
          {
            "id": "llama-2-7b-chat",
            "name": "LLaMA 2 7B Chat (Local)",
            "contextWindow": 4096,
            "maxTokens": 2048
          }
        ]
      }
    }
  },
  "llm": {
    "type": "local",
    "model_path": "./models/llama-2-7b-chat.Q2_K.gguf",
    "provider": "local",
    "model": "llama-2-7b-chat"
  }
}
```

### Environment Variable Override

Add to `.env` or `.env.local` in OpenClaw directory:

```bash
# Local LLM Configuration
OPENCLAW_LLM_TYPE=local
OPENCLAW_LLM_PROVIDER=local
OPENCLAW_LLM_MODEL=llama-2-7b-chat
OPENCLAW_LLM_BASE_URL=http://localhost:11434
OPENCLAW_LLM_CONFIG_PATH=../config/openclaw-llm.json

# Model settings
OPENCLAW_TEMPERATURE=0.7
OPENCLAW_TOP_P=0.9
OPENCLAW_MAX_TOKENS=2048
OPENCLAW_CONTEXT_WINDOW=4096

# Disables API key requirements
OPENCLAW_API_KEY_REQUIRED=false
OPENAI_API_KEY=none
ANTHROPIC_API_KEY=none
```

### Loading Configuration in Code

**OpenClaw (Node.js/TypeScript):**

```typescript
// openclaw.config.ts or similar
import fs from 'fs';
import path from 'path';

export function loadLocalLLMConfig() {
  const configPath = path.join(
    process.cwd(),
    '../config/openclaw-llm.json'
  );
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config;
  } catch (error) {
    console.error('Failed to load OpenClaw LLM config:', error);
    return getDefaultConfig();
  }
}

export const localLLMConfig = loadLocalLLMConfig();
```

### OpenClaw Startup Command

```bash
# Navigate to OpenClaw directory
cd OpenClaw

# Install dependencies (if not done)
npm install

# Start with local LLM
OPENCLAW_LLM_TYPE=local npm run start

# Or with config file
OPENCLAW_LLM_CONFIG_PATH=../config/openclaw-llm.json npm run start
```

---

## Morio Configuration

### Configuration Files

**Primary Config:** `config/morio-llm.json`

```json
{
  "morio": {
    "llm": {
      "enabled": true,
      "type": "local",
      "provider": "ollama",
      "model": "llama2",
      "base_url": "http://localhost:11434",
      "api_endpoint": "/api/generate",
      "settings": {
        "temperature": 0.7,
        "language": "en",
        "streaming": false
      }
    }
  }
}
```

### Environment Variable Override

Add to `.env` or `.env.local`:

```bash
# Morio Local LLM Configuration
MORIO_LLM_TYPE=local
MORIO_LLM_PROVIDER=ollama
MORIO_LLM_MODEL=llama2
MORIO_LLM_BASE_URL=http://localhost:11434
MORIO_LLM_CONFIG_PATH=./config/morio-llm.json

# Model parameters
MORIO_TEMPERATURE=0.7
MORIO_TOP_P=0.9
MORIO_MAX_TOKENS=2048

# Disable cloud API requirements
MORIO_USE_LOCAL_ONLY=true
MORIO_OFFLINE_MODE=true
MORIO_API_KEY_REQUIRED=false
```

### Loading Configuration in Code

**Morio (React/TypeScript):**

```typescript
// hooks/useMorioLLM.ts
import { useEffect, useState } from 'react';

interface MorioLLMConfig {
  enabled: boolean;
  type: 'local' | 'cloud';
  provider: string;
  model: string;
  base_url: string;
}

export function useMorioLLMConfig(): MorioLLMConfig {
  const [config, setConfig] = useState<MorioLLMConfig | null>(null);
  
  useEffect(() => {
    // Try to load from environment
    const config: MorioLLMConfig = {
      enabled: process.env.MORIO_LLM_TYPE === 'local',
      type: (process.env.MORIO_LLM_TYPE as 'local' | 'cloud') || 'local',
      provider: process.env.MORIO_LLM_PROVIDER || 'ollama',
      model: process.env.MORIO_LLM_MODEL || 'llama2',
      base_url: process.env.MORIO_LLM_BASE_URL || 'http://localhost:11434'
    };
    
    setConfig(config);
  }, []);
  
  return config;
}
```

### Morio Startup Command

```bash
# Navigate to project root
cd ../

# Install dependencies
npm install

# Start with local LLM enabled
MORIO_LLM_TYPE=local npm run dev

# Or specify config file
MORIO_LLM_CONFIG_PATH=./config/morio-llm.json npm run dev
```

---

## Running Both Agents

### Terminal Setup (3 Terminal Windows)

**Terminal 1: Ollama Service**
```bash
# Keep Ollama running (never close this)
ollama serve

# Output should show:
# 2026/02/17 XX:XX:XX blas.go:XX: attempting to load libblas.so
# 2026/02/17 XX:XX:XX server.go:XX: listening on 127.0.0.1:11434
```

**Terminal 2: OpenClaw**
```bash
cd OpenClaw
npm install
OPENCLAW_LLM_TYPE=local npm run start

# Output should show:
# Agent runtime starting...
# Using local LLM: llama-2-7b-chat
# Server running on http://localhost:5000
```

**Terminal 3: Morio**
```bash
cd ../
npm install
MORIO_LLM_TYPE=local npm run dev

# Output should show:
# Morio starting...
# Using local LLM provider: ollama
# Connected to http://localhost:11434
```

### All-in-One Startup Script

**Windows (PowerShell):**

```powershell
# save as start-all.ps1

# Terminal 1: Ollama
Start-Job -Name "Ollama" -ScriptBlock { ollama serve }

# Wait for Ollama to start
Start-Sleep -Seconds 2

# Terminal 2: OpenClaw
Start-Job -Name "OpenClaw" -ScriptBlock {
  Set-Location OpenClaw
  npm install
  $env:OPENCLAW_LLM_TYPE='local'
  npm run start
}

# Terminal 3: Morio
Start-Job -Name "Morio" -ScriptBlock {
  Set-Location .
  npm install
  $env:MORIO_LLM_TYPE='local'
  npm run dev
}

# List running jobs
Get-Job
```

**macOS/Linux (Bash):**

```bash
#!/bin/bash
# save as start-all.sh

# Make executable: chmod +x start-all.sh

# Terminal 1: Ollama
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to start
sleep 2

# Terminal 2: OpenClaw
cd OpenClaw
npm install
OPENCLAW_LLM_TYPE=local npm run start &
OPENCLAW_PID=$!

# Terminal 3: Morio
cd ..
npm install
MORIO_LLM_TYPE=local npm run dev &
MORIO_PID=$!

echo "All services started:"
echo "  - Ollama (PID: $OLLAMA_PID)"
echo "  - OpenClaw (PID: $OPENCLAW_PID)"
echo "  - Morio (PID: $MORIO_PID)"

# Keep script running
wait
```

---

## Testing & Validation

### 1. Test Ollama Service

```bash
# Check if running
curl http://localhost:11434/api/tags

# Test generation
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama2",
    "prompt": "Hello, what is your name?",
    "stream": false
  }'

# Expected response:
# {
#   "model": "llama2",
#   "response": "I am an AI assistant..."
# }
```

### 2. Test OpenClaw with Local LLM

```bash
# Start OpenClaw with test command
curl -X POST http://localhost:5000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "openclaw",
    "prompt": "What is 2 + 2?",
    "model": "llama-2-7b-chat"
  }'

# Browser test
# Visit: http://localhost:5000/dashboard
# Create new agent with "Local (LLaMA 2)" model
```

### 3. Test Morio with Local LLM

```javascript
// Browser console test
fetch('http://localhost:5173/api/morio/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'Hello, what can you do?',
    useLocal: true
  })
})
.then(r => r.json())
.then(console.log)

// Expected response:
// { response: "I can help you with...", model: "llama2", ... }
```

### 4. Performance Testing

```bash
# Test response time
time curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "llama2", "prompt": "test", "stream": false}'

# Monitor memory usage
# Windows:
Get-Process ollama | Select-Object WorkingSet

# macOS/Linux:
ps aux | grep ollama

# Expected: ~4-6GB RAM for the model
```

---

## Troubleshooting

### Common Issues

#### Issue 1: "Connection refused" on localhost:11434

**Problem:** Ollama service not running

**Solution:**
```bash
# Check if Ollama is installed
ollama --version

# Start Ollama
ollama serve

# Verify with test call
curl http://localhost:11434/api/tags
```

#### Issue 2: "Model not found: llama2"

**Problem:** Model not downloaded

**Solution:**
```bash
# Download the model
ollama pull llama2

# Verify download
ollama list

# Check storage location
# Windows: %USERPROFILE%\.ollama\models
# macOS/Linux: ~/.ollama/models
```

#### Issue 3: High Memory Usage / Out of Memory

**Problem:** System ran out of RAM

**Solutions:**
```bash
# Option A: Use smaller model variant
ollama pull llama2:7b-q5_0  # Uses less RAM

# Option B: Reduce context window in config
{
  "contextWindow": 2048,  # Reduced from 4096
  "maxTokens": 1024       # Reduced from 2048
}

# Option C: Monitor resource usage
# Windows (PowerShell):
while($true) {
  $mem = (Get-Process ollama).WorkingSet / 1GB
  Write-Host "Ollama Memory: $mem GB"
  Start-Sleep 2
}

# macOS/Linux:
watch -n 2 'ps aux | grep ollama'
```

#### Issue 4: OpenClaw Not Using Local Model

**Problem:** Still trying to use API keys

**Solution:**
```bash
# Verify environment variables
echo $OPENCLAW_LLM_TYPE      # Should print: local
echo $OPENCLAW_LLM_PROVIDER  # Should print: local

# Clear any cached API keys
rm -rf OpenClaw/.env.local
rm -rf ~/.openclaw/cache

# Check config file exists
ls -la config/openclaw-llm.json  # Should exist

# Restart OpenClaw
npm run start
```

#### Issue 5: Morio Not Connecting to Ollama

**Problem:** Connection timeout

**Solution:**
```bash
# Verify Ollama endpoint
curl -I http://localhost:11434

# Test from Morio's perspective
# Add to Morio startup:
DEBUG=morio:llm npm run dev

# Check firewall
# Windows: Check Windows Defender Firewall
# macOS: System Preferences → Security & Privacy → Firewall
# Linux: sudo ufw allow 11434/tcp
```

#### Issue 6: Slow Response Times

**Problem:** Model taking too long to generate

**Causes & Solutions:**
```bash
# 1. CPU limitation - reduce context/tokens
{
  "contextWindow": 2048,
  "maxTokens": 512
}

# 2. Disk I/O bottleneck - ensure SSD
# Check: hdparm -t /dev/sda (Linux only)

# 3. Reduce model size
ollama pull llama2:7b-q2_K  # Smaller quantization

# 4. Disable unnecessary features
{
  "streaming": false,
  "cache_results": true
}
```

### Debug Mode

**Enable verbose logging:**

```bash
# OpenClaw debug
DEBUG=openclaw:* npm run start

# Morio debug
DEBUG=morio:* npm run dev

# Ollama debug
OLLAMA_DEBUG=1 ollama serve
```

**Check log files:**
```bash
# Ollama logs
tail -f ~/.ollama/logs/server.log

# OpenClaw logs
tail -f OpenClaw/logs/app.log

# Morio logs
tail -f logs/morio.log
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Application                        │
│  (YukiDashboard, Morio, OpenClaw, etc.)                        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼───┐     ┌────▼───┐     ┌────▼────┐
   │ Morio  │     │OpenClaw│     │ Others  │
   └────┬───┘     └────┬───┘     └────┬────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
            ┌──────────▼──────────┐
            │  Ollama Service     │
            │ (Port 11434)        │
            │ OpenAI-Compatible   │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │  LLaMA 2 Model      │
            │  7B Chat (Quantized)│
            │  ~/models/llama2.gg │
            └─────────────────────┘
```

### API Flow

```
┌─ User Request ─┐
│                │
▼                ▼
OpenClaw       Morio
│                │
└─── HTTP ───────┘
      │
      ▼
Ollama API (localhost:11434)
      │
      ▼
/api/generate (prompt)
      │
      ▼
LLaMA 2 Model
      │
      ▼
Generate response (streaming or complete)
      │
      ▼
Return to OpenClaw/Morio
      │
      ▼
Display to user
```

---

## Performance Metrics

### Expected Performance

| Metric | Value | Notes |
|--------|-------|-------|
| **Startup Time** | 2-3s | Cold start for model loading |
| **First Token** | 1-2s | Latency for first response token |
| **Throughput** | 5-10 tok/s | On modern CPU (varies by hardware) |
| **Memory Usage** | 4-6GB | For 7B model LLaMA 2 in memory |
| **Context Window** | 4096 | Max tokens in conversation |
| **Max Output** | 2048 | Max tokens generated |

### Optimization Tips

1. **Use GPU Acceleration:**
   ```bash
   # Install CUDA support for Ollama
   # GPU reduces processing time 5-10x
   # Requires NVIDIA GPU
   ```

2. **Increase CPU Threads:**
   ```json
   {
     "threads": 8,  // Match your CPU core count
     "num_gpu_layers": 0  // 0 for CPU-only
   }
   ```

3. **Batch Requests:**
   ```javascript
   // Process multiple requests together
   // Improves overall throughput
   ```

4. **Cache Results:**
   ```json
   {
     "cache": {
       "enabled": true,
       "ttl": 300
     }
   }
   ```

---

## Security Considerations

⚠️ **Local-Only Deployment:**
- Model runs locally on your machine
- No data sent to external APIs
- No API keys needed
- Network isolation by default

### Recommended Setup

```bash
# Restrict Ollama to localhost only
# In server configuration:
OLLAMA_HOST=127.0.0.1:11434  # Not 0.0.0.0

# Firewall rules
# Block external access to port 11434
# Allow only localhost connections
```

---

## Deployment Checklist

- [ ] Ollama installed and verified
- [ ] LLaMA 2 model downloaded
- [ ] Configuration files created
- [ ] Environment variables set
- [ ] Ollama service running
- [ ] OpenClaw connects successfully
- [ ] Morio connects successfully
- [ ] Response times acceptable
- [ ] Memory usage within limits
- [ ] Error handling working

---

## Support & Next Steps

### File Locations
- **Config Files:** `./config/openclaw-llm.json` & `./config/morio-llm.json`
- **Model File:** `./models/llama-2-7b-chat.Q2_K.gguf`
- **Environment:** `.env` or `.env.local`

### Useful Commands

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Monitor Ollama service
ollama list

# Load specific model
ollama run llama2

# Unload model (free RAM)
ollama stop llama2

# Check OpenClaw logs
npm run logs --workspace=OpenClaw

# Check Morio logs
npm run logs
```

### Next Steps

1. ✅ Complete setup above
2. 🧪 Run validation tests
3. 🚀 Deploy to production
4. 📊 Monitor performance
5. 🔧 Tune for your hardware

---

**Setup Complete!** Your local LLM is now ready to power OpenClaw and Morio. No cloud dependencies, no API costs. 🎉

---

*Last Updated: February 17, 2026*  
*Model: LLaMA 2 7B Chat (Q2_K quantization)*  
*Status: Production Ready ✅*
