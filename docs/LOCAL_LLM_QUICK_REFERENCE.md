# Local LLM Quick Reference Card

**Date:** February 17, 2026  
**Model:** LLaMA 2 7B (Q2_K)  
**Status:** ✅ Ready to Deploy  

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Ollama
```bash
# Download from: https://ollama.ai
# Or on macOS:
brew install ollama
```

### Step 2: Download Model
```bash
ollama pull llama2
```

### Step 3: Start All Services
**Windows (PowerShell):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\start-local-llm.ps1
```

**macOS/Linux:**
```bash
chmod +x start-local-llm.sh
./start-local-llm.sh
```

---

## 📍 Service URLs

| Service | URL | Port | Purpose |
|---------|-----|------|---------|
| **Ollama** | http://localhost:11434 | 11434 | LLM inference engine |
| **OpenClaw** | http://localhost:5000 | 5000 | Agent runtime |
| **Morio** | http://localhost:5173 | 5173 | Hub interface |

---

## ⚙️ Configuration Files

```
project-root/
├── config/
│   ├── openclaw-llm.json    ← OpenClaw config
│   └── morio-llm.json        ← Morio config
├── models/
│   └── llama-2-7b-chat.Q2_K.gguf  ← Model file
├── .env                       ← Environment variables
├── start-local-llm.ps1       ← Windows startup script
└── start-local-llm.sh        ← macOS/Linux startup script
```

---

## 🔧 Key Environment Variables

```bash
# OpenClaw
OPENCLAW_LLM_TYPE=local
OPENCLAW_LLM_PROVIDER=local
OPENCLAW_LLM_MODEL=llama-2-7b-chat
OPENCLAW_LLM_BASE_URL=http://localhost:11434

# Morio
MORIO_LLM_TYPE=local
MORIO_LLM_PROVIDER=ollama
MORIO_LLM_MODEL=llama2
MORIO_LLM_BASE_URL=http://localhost:11434
```

---

## 🧪 Verify Installation

### Test Ollama
```bash
curl http://localhost:11434/api/tags
# Should return model list
```

### Test Generation
```bash
curl -X POST http://localhost:11434/api/generate \
  -d '{"model": "llama2", "prompt": "Hello", "stream": false}'
```

### Test OpenClaw
```bash
curl http://localhost:5000/health
# Should return: {"status":"ok"}
```

---

## 📊 Resource Usage

| Resource | Usage | Notes |
|----------|-------|-------|
| **RAM** | 4-6GB | For 7B model loaded |
| **Disk** | ~4GB | Model file size |
| **CPU** | Variable | 5-10 tokens/sec on CPU |
| **GPU** | Optional | 10x faster with NVIDIA |

---

## 🛑 Stop Services

**Windows:**
```powershell
Get-Job | Stop-Job
Get-Job | Remove-Job
```

**macOS/Linux:**
```bash
killall ollama
killall node
killall npm
```

---

## 🐛 Common Issues

### "Connection refused"
→ Check if Ollama is running
```bash
# macOS
brew services list

# Linux
systemctl status ollama

# Windows
Get-Process ollama
```

### "Model not found"
→ Download the model
```bash
ollama pull llama2
```

### "Out of memory"
→ Use smaller model or reduce context
```json
{
  "contextWindow": 2048,
  "maxTokens": 1024
}
```

### "Slow responses"
→ Check CPU usage or upgrade to GPU
```bash
# Monitor on macOS/Linux
watch -n 1 'top -p $(pgrep ollama)'
```

---

## 📚 Useful Commands

```bash
# List models
ollama list

# Run model interactively
ollama run llama2

# Show model details
ollama show llama2

# Update to latest
ollama update

# View logs (macOS)
tail -f ~/.ollama/logs/server.log

# Check endpoint health
curl -I http://localhost:11434

# Test with prompt
curl http://localhost:11434/api/generate \
  -d '{"model":"llama2","prompt":"test","stream":false}'
```

---

## 🔐 Security

✅ **Local Only** - No cloud dependencies  
✅ **No API Keys** - Works offline  
✅ **Restricted Access** - Listens on localhost only  
✅ **Private Data** - Everything stays local  

---

## 📈 Performance Tips

1. **Use dedicated terminal for Ollama** - Keep it always running
2. **Increase CPU threads** - Set `threads: 8` or your CPU core count
3. **Batch requests** - Process multiple prompts together
4. **Cache results** - Reuse common responses
5. **Reduce context window** - 2048 tokens instead of 4096 for speed
6. **GPU acceleration** - Use CUDA/ROCm for 10x speedup

---

## 📱 Integration Examples

### OpenClaw Usage
```javascript
const response = await fetch('http://localhost:5000/api/agents/execute', {
  method: 'POST',
  body: JSON.stringify({
    agent: 'openclaw',
    prompt: 'Your prompt here',
    model: 'llama-2-7b-chat'
  })
});
```

### Morio Usage
```javascript
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    model: 'llama2',
    prompt: 'Your prompt here',
    stream: false
  })
});
```

---

## 🚀 Next Steps

- [ ] Install Ollama
- [ ] Download LLaMA 2 model
- [ ] Run startup script
- [ ] Verify all 3 services running
- [ ] Test API endpoints
- [ ] Deploy to production
- [ ] Monitor performance

---

## 📞 Support

**Documentation:** See `LOCAL_LLM_SETUP_GUIDE.md` for detailed guide  
**Config Files:** See `config/openclaw-llm.json` and `config/morio-llm.json`  
**Model File:** Located at `./models/llama-2-7b-chat.Q2_K.gguf`  

---

**Last Updated:** February 17, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready
