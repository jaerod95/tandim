# Testing Guide for Tandim

This guide explains how to test the Tandim system using the agent-friendly testing tools.

## Quick Start

### 1. Start the API Server

```bash
cd api
pnpm dev
```

The API server will start on `http://localhost:3000`.

### 2. Test with Debug Endpoints

In another terminal:

```bash
# Check server health
curl http://localhost:3000/api/debug/health

# Get server stats
curl http://localhost:3000/api/debug/stats

# List all rooms
curl http://localhost:3000/api/debug/rooms
```

### 3. Run Automated Test Scenarios

```bash
cd api
pnpm test:scenarios
```

This will run all automated test scenarios:
- ✓ Basic join/leave test
- ✓ Screen sharing test
- ✓ WebRTC signaling test
- ✓ Multiple concurrent rooms test
- ✓ Heartbeat test

### 4. Use MCP Server (For AI Agents)

Start the API with MCP server enabled:

```bash
cd api
pnpm mcp
```

Then configure your MCP client (e.g., Claude Code) to connect to it.

## Debug Endpoints Reference

All debug endpoints are available at `/api/debug/*`:

### GET /api/debug/health
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-02-23T...",
  "uptime": 123.45
}
```

### GET /api/debug/stats
Overall server statistics.

**Response:**
```json
{
  "totalRooms": 3,
  "totalSockets": 8,
  "totalPeers": 12,
  "timestamp": "2024-02-23T...",
  "uptime": 123.45,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 18874368,
    "external": 1234567
  }
}
```

### GET /api/debug/rooms
List all active rooms.

**Response:**
```json
{
  "rooms": [
    {
      "workspaceId": "workspace-1",
      "roomId": "room-1",
      "peerCount": 3
    }
  ]
}
```

### GET /api/debug/rooms/:workspaceId/:roomId
Get detailed information about a specific room.

**Response:**
```json
{
  "workspaceId": "workspace-1",
  "roomId": "room-1",
  "peerCount": 2,
  "peers": [
    {
      "userId": "user-1",
      "displayName": "Alice",
      "socketId": "abc123",
      "joinedAt": "2024-02-23T...",
      "lastHeartbeatAt": "2024-02-23T...",
      "inactiveForMs": 1234
    }
  ],
  "activeScreenSharerUserId": null
}
```

### GET /api/debug/sockets
List all connected sockets.

**Response:**
```json
{
  "sockets": [
    {
      "id": "abc123",
      "rooms": ["workspace-1:room-1"]
    }
  ]
}
```

### GET /api/debug/sockets/:socketId
Get information about a specific peer by socket ID.

**Response:**
```json
{
  "workspaceId": "workspace-1",
  "roomId": "room-1",
  "userId": "user-1"
}
```

### POST /api/debug/simulate/disconnect/:socketId
Simulate a peer disconnection (for testing).

**Response:**
```json
{
  "success": true,
  "socketId": "abc123"
}
```

## CLI Inspection Tool

Use the CLI tool to quickly inspect the server:

```bash
cd api

# Show available commands
pnpm inspect

# Get server stats
pnpm inspect stats

# List all rooms
pnpm inspect rooms

# List all sockets
pnpm inspect sockets
```

## Automated Test Scenarios

### Running All Scenarios

```bash
cd api
pnpm test:scenarios
```

### Running Against a Different Server

```bash
API_URL=http://example.com pnpm test:scenarios
```

### Available Scenarios

1. **Basic Join/Leave**
   - Tests basic room joining and leaving
   - Verifies peer-joined and peer-left events
   - Duration: ~500ms

2. **Screen Sharing**
   - Tests screen share start and stop
   - Verifies screen-share-started and screen-share-stopped events
   - Duration: ~500ms

3. **WebRTC Signaling**
   - Tests offer/answer/ICE candidate exchange
   - Verifies signal relay between peers
   - Duration: ~500ms

4. **Multiple Concurrent Rooms**
   - Creates 3 rooms with 2-4 peers each
   - Tests concurrent room management
   - Duration: ~1s

5. **Heartbeat**
   - Tests heartbeat mechanism
   - Sends periodic heartbeats for 3 seconds
   - Duration: ~3s

## Using Mock Clients

Create programmatic test clients in TypeScript:

```typescript
import { createMockClient, createMockRoom } from './test-utils/mock-client';

// Create a single mock client
const client = await createMockClient({
  apiUrl: 'http://localhost:3000',
  workspaceId: 'test-workspace',
  roomId: 'test-room',
  userId: 'user-1',
  displayName: 'Test User 1',
});

// Join the room
const joinResult = await client.joinRoom();
console.log('Joined room:', joinResult);

// Send heartbeat
client.sendHeartbeat();

// Listen for events
client.on('signal:peer-joined', (data) => {
  console.log('Peer joined:', data);
});

// Disconnect
client.disconnect();
```

### Create a Room with Multiple Peers

```typescript
import { createMockRoom } from './test-utils/mock-client';

// Create a room with 3 peers
const clients = await createMockRoom(
  'http://localhost:3000',
  'test-workspace',
  'test-room',
  3 // number of peers
);

// All clients are connected and in the room
console.log('Created room with', clients.length, 'peers');

// Cleanup
clients.forEach(client => client.disconnect());
```

### Simulate WebRTC Signaling

```typescript
// Create two clients
const client1 = await createMockClient({...});
const client2 = await createMockClient({...});

await client1.joinRoom();
await client2.joinRoom();

// Client 1 sends offer to client 2
const mockOffer = {
  type: 'offer',
  sdp: 'mock-sdp-offer',
};

client2.on('signal:offer', (data) => {
  console.log('Received offer:', data);

  // Send answer back
  const mockAnswer = {
    type: 'answer',
    sdp: 'mock-sdp-answer',
  };
  client2.sendAnswer(data.fromUserId, mockAnswer);
});

client1.sendOffer('user-2', mockOffer);
```

## MCP Server Tools

When connected via MCP, the following tools are available:

### get_all_rooms
Get a list of all active rooms with peer counts.

**No arguments required**

**Returns:**
```json
[
  {
    "workspaceId": "workspace-1",
    "roomId": "room-1",
    "peerCount": 3,
    "activeScreenSharerUserId": null
  }
]
```

### get_room_details
Get detailed information about a specific room.

**Arguments:**
- `workspaceId` (string): The workspace ID
- `roomId` (string): The room ID

**Returns:**
```json
{
  "workspaceId": "workspace-1",
  "roomId": "room-1",
  "peerCount": 2,
  "peers": [...],
  "activeScreenSharerUserId": null
}
```

### get_socket_info
Get information about all connected sockets.

**No arguments required**

### get_peer_by_socket
Get peer information by socket ID.

**Arguments:**
- `socketId` (string): The socket ID

### simulate_peer_disconnect
Simulate a peer disconnection for testing.

**Arguments:**
- `socketId` (string): The socket ID to disconnect

### get_server_stats
Get overall server statistics.

**No arguments required**

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use: `lsof -i :3000`
- Kill existing process: `kill -9 <PID>`

### Test scenarios fail
- Ensure API server is running on localhost:3000
- Check server logs for errors
- Use debug endpoints to inspect server state

### MCP server not connecting
- Ensure the API server is started with `pnpm mcp`
- Check that stdout is not being used for other output
- Verify MCP client configuration

### WebRTC signaling issues
- Check socket connection: `pnpm inspect sockets`
- Verify peers are in the same room: `pnpm inspect rooms`
- Check for errors in server logs

## Best Practices

1. **Always check server health before running tests**
   ```bash
   curl http://localhost:3000/api/debug/health
   ```

2. **Use debug endpoints to verify state**
   - Check rooms and peers before and after operations
   - Monitor socket connections during tests

3. **Clean up after tests**
   - Disconnect mock clients properly
   - Wait for cleanup between test runs

4. **Monitor server stats**
   - Watch memory usage during long-running tests
   - Check for connection leaks via socket count

5. **Use MCP tools for interactive debugging**
   - Great for exploring server state
   - Helps understand behavior during development

## Next Steps

- Add more test scenarios for edge cases
- Implement load testing with many concurrent connections
- Add performance metrics and monitoring
- Create visual debugging UI (optional)
- Add replay/recording of test sessions
