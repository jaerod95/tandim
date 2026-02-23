# Agent-Friendly Testing Infrastructure - Setup Complete ✓

## What Was Built

I've restructured the Tandim codebase to be highly agent-friendly for testing and debugging. Here's what's now available:

### 1. MCP Server for API Introspection ✓
**File:** `api/mcp-server.ts`

An MCP (Model Context Protocol) server that provides real-time introspection of the Tandim API server:

**Tools Available:**
- `get_all_rooms` - List all active rooms
- `get_room_details` - Get detailed room information
- `get_socket_info` - List connected sockets
- `get_peer_by_socket` - Get peer details by socket ID
- `simulate_peer_disconnect` - Test disconnection scenarios
- `get_server_stats` - Server statistics

**Usage:**
```bash
cd api && pnpm mcp
```

### 2. HTTP Debug Endpoints ✓
**File:** `api/routes/debug.ts`

RESTful endpoints for HTTP-based inspection:

```bash
curl http://localhost:3000/api/debug/health
curl http://localhost:3000/api/debug/stats
curl http://localhost:3000/api/debug/rooms
curl http://localhost:3000/api/debug/rooms/:workspaceId/:roomId
curl http://localhost:3000/api/debug/sockets
curl http://localhost:3000/api/debug/sockets/:socketId
curl -X POST http://localhost:3000/api/debug/simulate/disconnect/:socketId
```

### 3. Mock Client Library ✓
**File:** `api/test-utils/mock-client.ts`

Programmatic client for testing WebRTC signaling:

```typescript
import { createMockClient, createMockRoom } from './test-utils/mock-client';

// Single client
const client = await createMockClient({
  apiUrl: 'http://localhost:3000',
  workspaceId: 'test',
  roomId: 'room1',
  userId: 'user1',
  displayName: 'Test User',
});

await client.joinRoom();
client.sendHeartbeat();
client.disconnect();

// Multiple clients in a room
const clients = await createMockRoom(url, workspace, room, 3);
```

### 4. Automated Test Scenarios ✓
**File:** `api/test-utils/test-scenarios.ts`

End-to-end test scenarios:

1. Basic join/leave test
2. Screen sharing test
3. WebRTC signaling test
4. Multiple concurrent rooms test
5. Heartbeat test

**Usage:**
```bash
cd api && pnpm test:scenarios
```

### 5. CLI Inspection Tool ✓
**File:** `api/scripts/inspect-api.ts`

Command-line tool for quick inspection:

```bash
cd api
pnpm inspect stats    # Server stats
pnpm inspect rooms    # List rooms
pnpm inspect sockets  # List sockets
pnpm inspect health   # Health check
```

### 6. Enhanced RoomStateStore ✓
**File:** `api/services/roomState.ts`

Added introspection methods:
- `getAllRooms()` - Get all rooms
- `getRoomDetails(workspaceId, roomId)` - Get room details

### 7. Documentation ✓

Created comprehensive documentation:

- **README.md** - Project overview and quick start
- **CLAUDE.md** - Agent-specific development guide
- **TESTING.md** - Complete testing guide
- **mcp-config.json** - MCP server configuration

## Quick Start for Agents

### 1. Start API Server
```bash
cd api && pnpm dev
```

### 2. Test with Debug Endpoints
```bash
curl http://localhost:3000/api/debug/stats
```

### 3. Run Automated Tests
```bash
cd api && pnpm test:scenarios
```

### 4. Use MCP Server (For AI Agents)
Add to your MCP config:
```json
{
  "mcpServers": {
    "tandim-api": {
      "command": "pnpm",
      "args": ["-C", "/path/to/tandim/api", "run", "mcp"]
    }
  }
}
```

## File Structure

```
tandim/
├── README.md                    # Project overview
├── CLAUDE.md                    # Agent development guide
├── TESTING.md                   # Testing guide
├── mcp-config.json             # MCP configuration
│
├── api/
│   ├── mcp-server.ts           # MCP server implementation
│   ├── bin/
│   │   ├── www.ts              # HTTP server
│   │   └── mcp.ts              # MCP server entrypoint
│   ├── routes/
│   │   ├── api.ts              # Public API routes
│   │   └── debug.ts            # Debug endpoints ✨ NEW
│   ├── services/
│   │   ├── roomState.ts        # Room state (enhanced) ✨
│   │   └── signalServer.ts     # WebRTC signaling
│   ├── test-utils/             ✨ NEW
│   │   ├── mock-client.ts      # Mock client library
│   │   └── test-scenarios.ts   # Automated scenarios
│   ├── scripts/                ✨ NEW
│   │   ├── inspect-api.ts      # CLI inspection tool
│   │   └── run-test-scenarios.ts # Test runner
│   └── package.json            # Updated scripts
│
└── app/                        # Electron app (unchanged)
```

## New NPM Scripts

Added to `api/package.json`:

```json
{
  "scripts": {
    "mcp": "tsx ./bin/mcp.ts",
    "test:scenarios": "tsx ./scripts/run-test-scenarios.ts",
    "inspect": "tsx ./scripts/inspect-api.ts"
  }
}
```

## Dependencies Added

- `@modelcontextprotocol/sdk@^1.26.0` - MCP server SDK
- `@types/supertest@^6.0.3` - Testing types

## Testing the Setup

### 1. Verify Build
```bash
cd api && pnpm build
```
✓ Should complete without errors

### 2. Start Server
```bash
cd api && pnpm dev
```
✓ Server should start on port 3000

### 3. Check Health
```bash
curl http://localhost:3000/api/debug/health
```
✓ Should return `{"status":"healthy",...}`

### 4. Run Tests
```bash
cd api && pnpm test:scenarios
```
✓ All 5 scenarios should pass

## What Agents Can Now Do

### 1. Real-Time Inspection
- Query active rooms and peers
- Monitor socket connections
- Track screen sharing state
- View server statistics

### 2. Programmatic Testing
- Create mock clients
- Simulate user connections
- Test WebRTC signaling flows
- Verify room state changes

### 3. Automated Testing
- Run end-to-end scenarios
- Validate behavior automatically
- Test edge cases
- Simulate network events

### 4. Debugging
- Inspect server state at any time
- Simulate disconnections
- Monitor heartbeats
- Track room lifecycle

## Next Steps

Now that the infrastructure is in place, you can:

1. **Continue Development**
   - Use debug endpoints to verify behavior
   - Run test scenarios after changes
   - Use MCP tools for interactive debugging

2. **Add More Tests**
   - Create custom test scenarios
   - Add performance/load tests
   - Test edge cases and error handling

3. **Build Features**
   - Use mock clients to test new features
   - Verify behavior with automated scenarios
   - Check state with debug endpoints

4. **Monitor Production**
   - Use debug endpoints for health checks
   - Monitor room and peer counts
   - Track memory and uptime

## Example: Testing a New Feature

```typescript
// 1. Create mock clients
const clients = await createMockRoom('http://localhost:3000', 'workspace', 'room', 3);

// 2. Test your feature
// ... your feature code ...

// 3. Verify state via debug endpoint
const response = await fetch('http://localhost:3000/api/debug/rooms/workspace/room');
const roomState = await response.json();
console.log('Room state:', roomState);

// 4. Or use MCP tools
// get_room_details(workspaceId: "workspace", roomId: "room")

// 5. Cleanup
clients.forEach(c => c.disconnect());
```

## Troubleshooting

### Build Errors
- Run `pnpm install` to ensure dependencies are installed
- Check TypeScript version: `tsc --version`

### Server Won't Start
- Check if port 3000 is in use: `lsof -i :3000`
- Look for errors in console output

### Tests Fail
- Ensure server is running: `curl http://localhost:3000/api/debug/health`
- Check server logs for errors
- Verify no stale connections: `pnpm inspect sockets`

### MCP Server Issues
- Ensure started with `pnpm mcp`
- Check MCP client configuration
- Verify stdio is not being used by other processes

## Summary

The Tandim codebase is now fully instrumented for agent-friendly development:

✅ MCP server for real-time introspection
✅ HTTP debug endpoints for easy querying
✅ Mock client library for programmatic testing
✅ Automated test scenarios
✅ CLI tools for quick inspection
✅ Comprehensive documentation

You can now efficiently test, debug, and develop Tandim with full visibility into the system state at all times.

---

**Built:** February 23, 2026
**Status:** ✅ Production Ready
**Next:** Start building Tandem-like features!
