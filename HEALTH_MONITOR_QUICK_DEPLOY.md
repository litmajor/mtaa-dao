# 🚀 Health Monitor Agent - Quick Deploy Checklist

**Time required:** 5-10 minutes  
**Difficulty:** Easy  
**Risk:** None (monitoring only, no data modification)

---

## ✅ Pre-Deployment Checklist

- [ ] Agent code created: `server/agents/healthMonitorAgent.ts`
- [ ] Wired in server: `server/index.ts` imports and initializes agent
- [ ] .env updated with `SLACK_WEBHOOK_HEALTH_MONITOR` (optional)
- [ ] Build passes: `npm run build:backend`

---

## 🎯 Deployment Steps

### 1. Get Slack Webhook (Optional - Skip if not needed)

```
Go to: https://api.slack.com/apps → Create New App
→ Incoming Webhooks → Add to Workspace
→ Copy webhook URL to .env file
```

If skipping, just leave `SLACK_WEBHOOK_HEALTH_MONITOR=` empty in `.env`

### 2. Start Server

```powershell
cd e:\repos\litmajor\mtaa-dao
npm run dev
```

**Expected output:**
```
[STARTUP] ✅ Server listening on port 5000
✅ Real-time metrics reporting job started
🏥 Health Monitor Agent started (polling every 15s)
```

### 3. Verify It Works (30 seconds)

```powershell
# In a NEW PowerShell window:

# Test 1: Agent can fetch health
curl http://localhost:5000/api/docs/health

# Test 2: Agent can fetch summary
curl http://localhost:5000/api/docs/stats/summary

# Test 3: Slack webhook (if configured)
# Check your Slack channel - should see no alerts (good!)
```

### 4. Done! 🎉

Agent is now:
- ✅ Polling every 15 seconds
- ✅ Monitoring all 877 endpoints
- ✅ Tracking health history
- ✅ Sending Slack alerts (if configured)

---

## 📊 What's Being Monitored

| What | How Often | Where |
|------|-----------|-------|
| **System health** | Every 15 sec | `/api/docs/health` |
| **Error rate** | Every 15 sec | Agent calculates |
| **Latency (avg, p99)** | Every 15 sec | Agent tracks |
| **Unhealthy endpoints** | Every 15 sec | Counted in real-time |
| **Slack alerts** | When threshold hit | Your Slack channel |
| **Health history** | Every 15 sec | 24-hour sliding window |

---

## 🚨 Alerts You Might See

Once enabled, you'll receive Slack alerts for:

```
🚨 ERROR_SPIKE - Error rate at 7.2% (threshold: 5%)
🚨 LATENCY_SPIKE - Average latency at 1250ms (threshold: 1000ms)
🚨 CASCADING_FAILURE - 12 endpoints unhealthy (threshold: 10)
✅ RECOVERY - System recovered after 4m 32s in alert state
```

---

## 🔍 Verify Agent is Running

Open a new terminal and run:

```powershell
# Check if agent is responding
$response = curl -Uri "http://localhost:5000/api/docs/health" -UseBasicParsing | ConvertFrom-Json
$response.status  # Should print: "healthy", "degraded", or "critical"
```

---

## ❌ If Something Goes Wrong

| Issue | Fix |
|-------|-----|
| Build fails | Run `npm run build:backend` to see errors |
| Server won't start | Check port 5000 is free: `netstat -ano \| findstr :5000` |
| Agent not starting | Check logs for "[HEALTH_MONITOR]" messages |
| No Slack alerts | Verify webhook URL in .env is correct |
| Webhook URL not working | Test at: https://api.slack.com/messaging/webhooks |

---

## 📞 Need Help?

Full details in: [HEALTH_MONITOR_DEPLOYMENT_GUIDE.md](HEALTH_MONITOR_DEPLOYMENT_GUIDE.md)

---

**Status:** Ready to deploy ✅  
**Next step:** Run `npm run dev` and monitor the console output
