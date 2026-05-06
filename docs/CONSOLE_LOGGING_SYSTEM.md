# Server Console Logging System

A comprehensive logging system that automatically captures all server console output to timestamped log files with rich metadata.

## ✨ Features

- **Automatic Boot Logging**: Every server start creates a unique timestamped log file
- **Rich Metadata**: Each log entry includes timestamp, uptime, log level, and memory stats
- **Boot Metadata**: Records Node version, platform, environment, port, PID, and more
- **Zero Configuration**: Works out of the box, no setup needed
- **Graceful Shutdown**: Logs finalized properly when server shuts down
- **API Endpoints**: Query logs programmatically via REST API
- **Multi-log Management**: View current logs, list all historical logs, stream live updates

---

## 🗂️ Files Created

### Core Logging System
- **`server/utils/console-logger.ts`** - Main logging service that captures console output
- **`server/routes/logs.ts`** - REST API endpoints for log queries

### Integration Points
- **`server/index.ts`** - Modified to initialize logger on startup and finalize on shutdown

---

## 📁 Log File Locations

All logs are stored in:
```
e:\repos\litmajor\mtaa-dao\logs\
```

Each run generates a unique file:
```
server-2025-03-04T14-32-15-123.log
server-2025-03-04T14-45-22-456.log
server-2025-03-04T15-00-10-789.log
```

---

## 📊 Log File Structure

### Boot Header (Automatic)
```
════════════════════════════════════════════════════════════════════════════════
🚀 SERVER BOOT METADATA
════════════════════════════════════════════════════════════════════════════════
Boot Time:          2025-03-04T14:32:15.123Z
Node Version:       v20.11.0
Platform:           win32
Architecture:       x64
Environment:        development
Port:               5000
Process ID (PID):   12345
Working Directory:  e:\repos\litmajor\mtaa-dao
Log File:           e:\repos\litmajor\mtaa-dao\logs\server-2025-03-04T14-32-15-123.log
════════════════════════════════════════════════════════════════════════════════
```

### Log Entries (Per Line)
```
[2025-03-04T14:32:15.234Z] [LOG] [0.11s] [STARTUP] Server listening on port 5000
[2025-03-04T14:32:16.567Z] [INFO] [1.44s] ✅ Redis connection complete
[2025-03-04T14:32:17.123Z] [WARN] [2.00s] ⚠️ Backup system disabled
[2025-03-04T14:32:18.456Z] [ERROR] [3.33s] 🔴 Failed to connect to database
```

### Shutdown Footer (Automatic)
```
════════════════════════════════════════════════════════════════════════════════
🛑 SERVER SHUTDOWN
Shutdown Time: 2025-03-04T14:45:22.789Z
Total Uptime: 782.63s
════════════════════════════════════════════════════════════════════════════════
```

---

## 🔌 REST API Endpoints

### 1. Get Current Log File Info
```bash
GET /api/logs/current
```

**Response:**
```json
{
  "success": true,
  "currentLogFile": "e:\\repos\\litmajor\\mtaa-dao\\logs\\server-2025-03-04T14-32-15-123.log",
  "bootMetadata": {
    "bootTime": "2025-03-04T14:32:15.123Z",
    "nodeVersion": "v20.11.0",
    "platform": "win32",
    "arch": "x64",
    "environment": "development",
    "port": "5000",
    "pid": 12345,
    "workingDirectory": "e:\\repos\\litmajor\\mtaa-dao"
  },
  "timestamp": "2025-03-04T14:32:15.234Z"
}
```

---

### 2. Get Recent Log Tail
```bash
# Default: 50 lines
GET /api/logs/tail

# Custom: 100 lines (max 200)
GET /api/logs/tail?lines=100
```

**Response:**
```json
{
  "success": true,
  "lines": 50,
  "tail": "[2025-03-04T14:32:15.234Z] [LOG] [0.11s] [STARTUP] Server listening on port 5000\n...",
  "timestamp": "2025-03-04T14:32:15.234Z"
}
```

---

### 3. List All Log Files
```bash
GET /api/logs/list
```

**Response:**
```json
{
  "success": true,
  "logsDirectory": "e:\\repos\\litmajor\\mtaa-dao\\logs",
  "fileCount": 3,
  "files": [
    {
      "path": "e:\\repos\\litmajor\\mtaa-dao\\logs\\server-2025-03-04T15-00-10-789.log",
      "order": 1
    },
    {
      "path": "e:\\repos\\litmajor\\mtaa-dao\\logs\\server-2025-03-04T14-45-22-456.log",
      "order": 2
    },
    {
      "path": "e:\\repos\\litmajor\\mtaa-dao\\logs\\server-2025-03-04T14-32-15-123.log",
      "order": 3
    }
  ],
  "timestamp": "2025-03-04T14:32:15.234Z"
}
```

---

### 4. Get Boot Metadata & Statistics
```bash
GET /api/logs/stats
```

**Response:**
```json
{
  "success": true,
  "bootMetadata": {
    "bootTime": "2025-03-04T14:32:15.123Z",
    "nodeVersion": "v20.11.0",
    "platform": "win32",
    "arch": "x64",
    "environment": "development",
    "port": "5000",
    "pid": 12345,
    "workingDirectory": "e:\\repos\\litmajor\\mtaa-dao"
  },
  "logsDirectory": "e:\\repos\\litmajor\\mtaa-dao\\logs",
  "timestamp": "2025-03-04T14:32:15.234Z"
}
```

---

### 5. Stream Real-Time Log Updates (SSE)
```bash
GET /api/logs/stream
```

**Usage (JavaScript):**
```typescript
const eventSource = new EventSource('/api/logs/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'initial') {
    console.log('Initial log lines:', data.lines);
  } else if (data.type === 'heartbeat') {
    console.log('Server alive at:', data.timestamp);
  }
};

eventSource.onerror = () => {
  console.error('Stream error');
  eventSource.close();
};

// Close after 5 minutes
setTimeout(() => eventSource.close(), 5 * 60 * 1000);
```

---

## 🔄 Usage Examples

### Example 1: Get Last 30 Lines of Current Log
```bash
curl "http://localhost:5000/api/logs/tail?lines=30" | jq '.tail'
```

### Example 2: Check Server Boot Time
```bash
curl "http://localhost:5000/api/logs/current" | jq '.bootMetadata.bootTime'
```

### Example 3: List All Available Logs
```bash
curl "http://localhost:5000/api/logs/list" | jq '.files[].path'
```

### Example 4: Monitor Logs in Real-Time
```typescript
// Browser console
const es = new EventSource('/api/logs/stream');
es.onmessage = e => console.log(JSON.parse(e.data));
```

---

## ⚙️ How It Works

### 1. **Startup Initialization**
When the server boots:
1. `initializeConsoleLogger()` is called
2. Creates `logs/` directory if it doesn't exist
3. Generates unique filename based on ISO timestamp
4. Creates write stream to log file
5. Intercepts all `console.*` methods
6. Writes boot metadata header to file

### 2. **Console Hooking**
The logger replaces all console methods:
- `console.log()` → Logged with `[LOG]` level
- `console.info()` → Logged with `[INFO]` level
- `console.warn()` → Logged with `[WARN]` level
- `console.error()` → Logged with `[ERROR]` level
- `console.debug()` → Logged with `[DEBUG]` level

Each message includes:
- ISO timestamp
- Log level
- Server uptime in seconds
- Original message

### 3. **Graceful Shutdown**
When server stops:
1. All shutdown logs are captured
2. `closeLogging()` writes shutdown footer
3. Log stream is finalized and closed
4. Server exits cleanly

---

## 📊 Log Entry Format

```
[ISO-TIMESTAMP] [LOG-LEVEL] [UPTIME-SECONDS] MESSAGE
```

**Example:**
```
[2025-03-04T14:32:15.234Z] [LOG] [0.11s] [STARTUP] Server listening on port 5000
```

Breaking down:
- `2025-03-04T14:32:15.234Z` - When the log was created
- `LOG` - Log level (ERROR, WARN, INFO, LOG, DEBUG)
- `0.11s` - Seconds since server started
- `[STARTUP] Server listening on port 5000` - Your message

---

## 🛠️ Configuration

### Log Directory
Currently hardcoded to `e:\repos\litmajor\mtaa-dao\logs\`

To customize, edit `server/utils/console-logger.ts`:
```typescript
this.logDir = path.join(dirname(__dirname), 'logs'); // Change this path
```

### Log Retention
Currently all logs are kept. To implement rotation, add to `ConsoleLoggerService`:
```typescript
// Add log rotation after N files or X days
// See Node fs module for more details
```

### Filters
To add log filtering by level, modify `hookConsoleLog()`:
```typescript
if (process.env.LOG_LEVEL === 'error') {
  // Only log errors
}
```

---

## 🐛 Troubleshooting

### Logs Not Being Written
1. Check `logs/` directory exists in project root
2. Verify write permissions on the directory
3. Check `console-logger.ts` is imported before other services

### Log File Too Large
1. Implement log rotation
2. Add log level filtering
3. Consider archiving old logs

### API Returns Empty
1. Ensure logs have been written (wait a few seconds after startup)
2. Check file permissions are readable
3. Verify log file path in response

---

## 📝 Notes

- Each server run gets a **unique** log file - they never overwrite
- Log files are **human-readable** and indexed by timestamp
- The logger **mirrors console output** - nothing is hidden
- Boot metadata helps **debug environment issues**
- API endpoints are **public** - consider adding authentication if needed

---

## 🔮 Future Enhancements

1. **Log Rotation** - Archive logs after N MB or N days
2. **Log Compression** - Gzip old logs to save space
3. **Database Storage** - Store logs in PostgreSQL for querying
4. **Log Levels Filter** - Only log errors/warnings in production
5. **Webhook Alerts** - Alert on critical errors
6. **Metrics Dashboard** - Visualize server health over time
7. **Search Functionality** - Search logs by keyword
8. **Log Aggregation** - Combine logs from multiple instances

---

Created: 2025-03-04
Last Updated: 2025-03-04
