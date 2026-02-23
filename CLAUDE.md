# Agent Guide for Tandim Development

This document provides guidance for AI agents working on the Tandim codebase.

## Quick Start for Agents

### Inspecting the API Server

When the API server is running, you can inspect its state using several methods:

#### 1. HTTP Debug Endpoints

```bash
# Get server statistics
curl http://localhost:3000/api/debug/stats

# List all rooms
curl http://localhost:3000/api/debug/rooms

# Get specific room details
curl http://localhost:3000/api/debug/rooms/workspace-id/room-id

# List all connected sockets
curl http://localhost:3000/api/debug/sockets
```

#### 2. MCP Server Tools (Recommended for Agents)

Enable the Tandim MCP server in your configuration to get real-time introspection capabilities:

```json
{
  "mcpServers": {
    "tandim-api": {
      "command": "pnpm",
      "args": ["-C", "api", "run", "mcp"]
    }
  }
}
```

Then use these tools:
- `get_all_rooms` - List all active rooms with peer counts
- `get_room_details` - Get detailed information about a room
- `get_socket_info` - List all connected sockets
- `get_peer_by_socket` - Get peer details by socket ID
- `get_server_stats` - Get overall server statistics
- `simulate_peer_disconnect` - Test disconnection scenarios

#### 3. CLI Inspection

```bash
cd api

# Get stats
pnpm inspect stats

# List rooms
pnpm inspect rooms

# List sockets
pnpm inspect sockets
```

### Testing Your Changes

#### Automated Test Scenarios

Run comprehensive end-to-end tests:

```bash
cd api
pnpm test:scenarios
```

This runs:
1. Basic join/leave test
2. Screen sharing test
3. WebRTC signaling test
4. Multiple concurrent rooms test
5. Heartbeat test

#### Using Mock Clients

Create programmatic test clients:

```typescript
import { createMockClient, createMockRoom } from './api/test-utils/mock-client';

// Single client
const client = await createMockClient({
  apiUrl: 'http://localhost:3000',
  workspaceId: 'test',
  roomId: 'room1',
  userId: 'user1',
  displayName: 'Test User',
});

await client.joinRoom();

// Multiple clients in a room
const clients = await createMockRoom(
  'http://localhost:3000',
  'test-workspace',
  'test-room',
  3 // number of peers
);
```

#### Unit Tests

```bash
# API tests
cd api && pnpm test

# App tests
cd app && pnpm test

# E2E tests
cd app && pnpm test:e2e
```

## Architecture Overview

### API Server (Port 3000)

**Technologies:** Express + Socket.io + TypeScript

**Key Files:**
- `api/bin/www.ts` - HTTP server entrypoint
- `api/services/signalServer.ts` - WebRTC signaling logic
- `api/services/roomState.ts` - Room and peer state management
- `api/routes/debug.ts` - Debug endpoints for introspection

**WebSocket Events:**
```
Client → Server:
  - signal:join - Join a room
  - signal:heartbeat - Keep-alive
  - signal:offer/answer/ice-candidate - WebRTC signaling
  - signal:screen-share-start/stop - Screen sharing

Server → Client:
  - signal:joined - Join confirmation
  - signal:peer-joined/left - Peer events
  - signal:offer/answer/ice-candidate - WebRTC signaling relay
  - signal:screen-share-started/stopped - Screen share events
  - signal:error - Error notifications
```

### Electron App

**Technologies:** Electron + React + TypeScript + Vite

**Key Files:**
- `app/src/main.ts` - Electron main process (window management, IPC)
- `app/src/renderer/LobbyApp.tsx` - Lobby UI
- `app/src/renderer/CallApp.tsx` - Active call UI
- `app/src/webrtc/meshState.ts` - WebRTC mesh connection management
- `app/src/presence.ts` - User presence tracking

**IPC Messages:**
```
Renderer → Main:
  - deep-link:getPendingRoom - Get pending room from deep link
  - call:openWindow - Open a new call window
  - call:getSession - Get call session details

Main → Renderer:
  - deep-link:room - Room deep link received
```

## Development Workflow

### Starting the Development Environment

```bash
# Terminal 1: Start API server
cd api && pnpm dev

# Terminal 2: Start Electron app
cd app && pnpm start
```

### Making Changes

1. **Always read the relevant files first** before making changes
2. **Run tests** after your changes to verify behavior
3. **Use debug endpoints** to inspect state during development
4. **Check the logs** - both API and Electron output useful debug info

### Common Tasks

#### Adding a New WebSocket Event

1. Define the event schema in `api/services/signalServer.ts`
2. Add the event handler in the signal server
3. Update the client-side handler in `app/src/webrtc/` or `app/src/renderer/`
4. Add a test in `api/test-utils/test-scenarios.ts`

#### Adding a New API Endpoint

1. Add route in `api/routes/api.ts` or create new router
2. Add handler logic
3. Update tests in `api/tests/`

#### Adding a New UI Feature

1. Update React components in `app/src/renderer/`
2. Add any new IPC handlers in `app/src/main.ts` and `app/src/preload.ts`
3. Add E2E test in `app/tests/e2e/`

## Debugging Tips

### API Server Issues

1. Check server logs for errors
2. Use `pnpm inspect stats` to see server state
3. Use `pnpm inspect rooms` to see active rooms
4. Check specific room: `curl http://localhost:3000/api/debug/rooms/workspace/room`

### WebRTC Issues

1. Open browser DevTools in Electron: Menu → View → Toggle Developer Tools
2. Check the console for WebRTC errors
3. Use the MCP tool `get_room_details` to see peer states
4. Use mock clients to simulate connection scenarios

### Connection Issues

1. Verify API server is running: `curl http://localhost:3000/api/debug/health`
2. Check Socket.io connection: look for "Connected with socket" in logs
3. Verify room joining: check `signal:joined` event in console
4. Use `pnpm inspect sockets` to see active connections

## Testing Strategy

### Before Committing

1. Run unit tests: `pnpm test` in both `api/` and `app/`
2. Run test scenarios: `cd api && pnpm test:scenarios`
3. Manual smoke test: Start app, join a room, verify basic functionality

### After Major Changes

1. Run full E2E suite: `cd app && pnpm test:e2e`
2. Test multiple scenarios with mock clients
3. Check memory leaks with `get_server_stats` over time

## Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Run `pnpm lint` to check
- **Error Handling**: Use structured error codes and retryable flags
- **Logging**: Use `console.error` for logs (stdout reserved for MCP)
- **Types**: Define interfaces for all data structures

## Common Patterns

### Room State Management

```typescript
// Join a peer
const result = roomStateStore.joinPeer({
  workspaceId: 'workspace-id',
  roomId: 'room-id',
  userId: 'user-id',
  displayName: 'User Name',
  socketId: socket.id,
});

// Get room details (for debugging)
const details = roomStateStore.getRoomDetails('workspace-id', 'room-id');
```

### WebRTC Signaling

```typescript
// Relay signal to specific peer
io.to(targetSocketId).emit('signal:offer', {
  workspaceId,
  roomId,
  fromUserId,
  payload: offer,
});

// Broadcast to room
io.to(getRoomChannel(workspaceId, roomId)).emit('signal:peer-joined', {
  userId,
  displayName,
});
```

### Mock Testing

```typescript
// Create test scenario
const client1 = await createMockClient({...});
const client2 = await createMockClient({...});

await client1.joinRoom();
await client2.joinRoom();

// Verify behavior
client1.on('signal:peer-joined', (data) => {
  console.log('Peer joined:', data);
});
```

## Performance Considerations

- **Room Cleanup**: Empty rooms are automatically deleted
- **Heartbeats**: Sent every 30 seconds, peers inactive for >60s are pruned
- **Socket.io**: Uses WebSocket transport for low latency
- **WebRTC**: Mesh architecture - scales to ~4-6 peers per room

## Security Notes

- **CORS**: Enabled for all origins (development mode)
- **Input Validation**: All socket events validated with Zod schemas
- **No Authentication**: Currently no auth (add before production)
- **Deep Links**: Validated via `parseTandemDeepLink()`

## Future Improvements

Ideas for agents to consider:

1. **Add Authentication**: JWT or session-based auth
2. **Add Persistence**: Store room history, user profiles
3. **SFU Mode**: Switch from mesh to SFU for larger rooms
4. **Recording**: Add call recording capability
5. **Chat**: Add text chat to rooms
6. **Analytics**: Track usage metrics
7. **Rate Limiting**: Prevent abuse of API endpoints
8. **Encryption**: End-to-end encryption for calls

## Questions?

If you encounter issues or have questions:

1. Check the debug endpoints first
2. Review the test scenarios for examples
3. Read the source code (it's well-commented)
4. Check git history for recent changes
