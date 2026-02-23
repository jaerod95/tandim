# Tandim - Running Locally

## Current Status

✅ **API Server**: Running on http://localhost:3000
✅ **Electron App**: Running
✅ **UI Updated**: Matching Tandem design

## Quick Start

### 1. Start API Server

```bash
cd api
pnpm dev
```

The API server will start on port 3000.

### 2. Start Electron App

In a new terminal:

```bash
cd app
pnpm start
```

The Electron app will open automatically.

## What's New

### Lobby View ✨

- **Left Sidebar**: Room list with emojis and quick join buttons
  - Team Standup 👥
  - Lounge 🏖️
  - Meeting Room 📋
  - Help Needed ⚡
  - Coffee Break ☕
  - Library - Co-Working 📚

- **Center Panel**: Team member list
  - Shows your avatar and name
  - Shows other team members (Jordin - offline)
  - "Invite Teammates" button

- **Right Panel** (optional): Room details panel
  - Shows when you select a room
  - Join button (with audio)
  - Listen button (listen-only mode)
  - Join w/o audio button
  - Add Kiosks button
  - Room description
  - Chat input

### Call View ✨

- **Top Bar**:
  - Room name and workspace indicator
  - Connection/notification icons
  - Grid view toggle
  - Pin and more options

- **Main Stage**:
  - Shows "There's no one here!" when you're alone
  - Grid view of participants when others join

- **Bottom Controls**:
  - Mute/Unmute (with visual indicator)
  - Camera on/off
  - Screen share (with active indicator)
  - Chat button
  - Reactions
  - Widgets
  - More options
  - LEAVE button (red)
  - Current user indicator

## Testing the App

### Test 1: Basic Navigation

1. Open the app
2. You should see the lobby with rooms on the left
3. Click on a room (e.g., "Team Standup")
4. The right panel should appear with room details
5. Click the "X" to close the right panel

### Test 2: Joining a Room

1. Select "Team Standup"
2. Click the blue "Join" button
3. A new call window should open
4. You should see "There's no one here!" message
5. Controls at the bottom should be interactive

### Test 3: Multiple Users (Requires 2 Instances)

1. Start the app twice (or use different browsers)
2. Both join the same room
3. You should see each other in the call
4. Try muting/unmuting
5. Try sharing screen

### Test 4: Debug Endpoints

Check server state:

```bash
# Server health
curl http://localhost:3000/api/debug/health

# Server stats
curl http://localhost:3000/api/debug/stats

# List rooms
curl http://localhost:3000/api/debug/rooms
```

### Test 5: Automated Scenarios

Run automated test scenarios:

```bash
cd api
pnpm test:scenarios
```

## Features Implemented

### Lobby Features
- ✅ Dark theme matching Tandem
- ✅ Room list with emojis
- ✅ Team member list with avatars
- ✅ Room details panel (collapsible)
- ✅ Multiple join options (Join, Listen, Join w/o audio)
- ✅ Developer settings (collapsible)
- ✅ Clean, modern UI

### Call Features
- ✅ "There's no one here!" empty state
- ✅ Proper control layout (Mute, Camera, Screen, etc.)
- ✅ Visual indicators for active states
- ✅ Red LEAVE button
- ✅ Current user display
- ✅ Top bar with connection info
- ✅ WebRTC mesh connections

### Backend Features
- ✅ Socket.io signal server
- ✅ Room state management
- ✅ Peer tracking
- ✅ Screen share coordination
- ✅ Heartbeat mechanism
- ✅ Debug endpoints
- ✅ MCP server for agent debugging

## Architecture

```
┌─────────────────────────────────────────────┐
│          Electron App (Port random)         │
│  ┌───────────┐         ┌──────────────┐    │
│  │  Lobby    │  ──────▶│  Call Window │    │
│  │  (Main)   │         │  (Separate)  │    │
│  └───────────┘         └──────────────┘    │
└─────────────────────────────────────────────┘
                    │
                    │ Socket.io + WebRTC
                    │
                    ▼
┌─────────────────────────────────────────────┐
│        API Server (Port 3000)               │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │ HTTP Routes  │  │ Socket.io Server   │  │
│  │ /api/...     │  │ /api/signal        │  │
│  └──────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │ Debug Routes │  │ Room State Store   │  │
│  │ /api/debug/..│  │ (In-memory)        │  │
│  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Development Workflow

### Making UI Changes

1. Edit files in `app/src/renderer/`
2. Changes hot-reload automatically
3. If they don't, restart with `pnpm start`

### Making API Changes

1. Edit files in `api/`
2. Server auto-restarts (nodemon/tsx watch)
3. Check logs in terminal

### Debugging

**Using Debug Endpoints:**
```bash
# Check server state
curl http://localhost:3000/api/debug/stats

# List active rooms
curl http://localhost:3000/api/debug/rooms

# Get specific room
curl http://localhost:3000/api/debug/rooms/team-local/Team%20Standup
```

**Using Chrome DevTools:**
- In Electron: Menu → View → Toggle Developer Tools
- Check console for errors
- Check Network tab for WebSocket connections

**Using MCP Server:**
```bash
cd api
pnpm mcp
```

Then use MCP tools to inspect server state.

## Known Issues

1. **Camera Permission**: First time enabling camera will ask for permission
2. **Screen Share**: Requires screen recording permission on macOS
3. **Multiple Tabs**: Each tab/window needs separate user ID
4. **Audio Echo**: Mute yourself when testing alone to avoid feedback

## Next Steps

### Planned Features
- [ ] Persistent room state (database)
- [ ] User authentication
- [ ] Chat functionality
- [ ] Reactions with animations
- [ ] Widgets (timer, polls, etc.)
- [ ] Recording
- [ ] Background blur
- [ ] Virtual backgrounds
- [ ] Meeting scheduling
- [ ] Slack integration

### UI Improvements
- [ ] Add loading states
- [ ] Add error messages
- [ ] Add tooltips
- [ ] Add keyboard shortcuts
- [ ] Add settings panel
- [ ] Add user profile editing

### Backend Improvements
- [ ] Add Redis for room state
- [ ] Add PostgreSQL for users/meetings
- [ ] Add SFU mode for larger calls
- [ ] Add TURN server fallback
- [ ] Add rate limiting
- [ ] Add authentication

## Troubleshooting

### API Server Won't Start

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill the process
kill -9 <PID>

# Start again
cd api && pnpm dev
```

### Electron App Won't Start

```bash
# Clear cache
rm -rf app/.vite app/out

# Reinstall dependencies
cd app && pnpm install

# Start again
pnpm start
```

### WebRTC Connection Issues

1. Check browser console for errors
2. Verify both users are in the same room
3. Check firewall settings
4. Try on same network first

### Build Issues

```bash
# Clean and rebuild
cd api && rm -rf dist node_modules && pnpm install && pnpm build
cd app && rm -rf .vite out node_modules && pnpm install
```

## Resources

- **Documentation**: See README.md, CLAUDE.md, TESTING.md
- **Debug Tools**: http://localhost:3000/api/debug/*
- **MCP Server**: `cd api && pnpm mcp`
- **Test Scenarios**: `cd api && pnpm test:scenarios`

## Support

- Check logs in `/tmp/tandim-api.log` and `/tmp/tandim-app.log`
- Use debug endpoints to inspect server state
- Run test scenarios to verify functionality
- Check CLAUDE.md for development guidance

---

**Status**: ✅ Running and ready for development!
**Last Updated**: 2026-02-23
