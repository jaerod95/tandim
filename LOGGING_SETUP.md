# Remote Logging Setup

Both the Electron app and browser test client now send their console logs to the API server, which writes them to files.

## Setup

1. **Restart the API server** (to load the new logging endpoint):
   ```bash
   cd api
   pnpm dev
   ```

2. **Start watching logs** (in another terminal):
   ```bash
   cd api
   ./watch-logs.sh
   ```

   Or manually:
   ```bash
   tail -f api/logs/electron.log api/logs/browser.log
   ```

3. **Start Electron app**:
   ```bash
   cd app
   pnpm start
   ```

4. **Open browser test client**:
   ```bash
   open app/test-browser-client.html
   ```

## What You'll See

All `console.log`, `console.error`, `console.warn` calls from both clients will appear in:
- `api/logs/electron.log` - Electron app logs
- `api/logs/browser.log` - Browser test client logs

## Testing Video

After both clients join the room:

1. In browser: Click **"Camera On"**
2. Watch the logs for:
   - **Browser**: `➕ Adding video track...`
   - **Browser**: `🔄 Negotiation needed...`
   - **Browser**: `📤 Auto-negotiating... audio=true, video=true`
   - **Electron**: `Received offer from ... audio=true, video=true`
   - **Electron**: `Sending answer to ... audio=true, video=true`
   - **Electron**: `Receiving video track from ...` ← **KEY LOG**

If you DON'T see "Receiving video track", that's where the bug is!

## Clear Logs

```bash
# Clear all logs
rm api/logs/*.log

# Or clear specific log
rm api/logs/electron.log
# or
rm api/logs/browser.log
```

## Debugging

If logs aren't appearing:
1. Check API server is running: `curl http://localhost:3000/api/debug/health`
2. Check logs directory exists: `ls -la api/logs/`
3. Check logs endpoint: `curl -X POST http://localhost:3000/api/debug/log -H "Content-Type: application/json" -d '{"logs":[{"source":"test","level":"log","message":"test","timestamp":"2024-01-01T00:00:00.000Z"}]}'`
