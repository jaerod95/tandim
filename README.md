# Tandim - Tandem Clone

A lightweight screen sharing and collaboration tool inspired by Tandem.

## Architecture

This is a monorepo with three main packages:

- **api**: Express + Socket.io signal server for WebRTC
- **app**: Electron desktop application with React UI
- **slack-app**: Slack integration (optional)

## Development

```bash
# Install dependencies
pnpm install

# Start API server
cd api && pnpm dev

# Start Electron app (in another terminal)
cd app && pnpm start
```

## Testing & Debugging

### HTTP Debug Endpoints

The API server exposes debug endpoints for introspection:

```bash
# Health check
curl http://localhost:3000/api/debug/health

# Server statistics
curl http://localhost:3000/api/debug/stats

# List all active rooms
curl http://localhost:3000/api/debug/rooms

# Get room details
curl http://localhost:3000/api/debug/rooms/workspace-id/room-id

# List connected sockets
curl http://localhost:3000/api/debug/sockets

# Get peer by socket ID
curl http://localhost:3000/api/debug/sockets/socket-id

# Simulate peer disconnect (for testing)
curl -X POST http://localhost:3000/api/debug/simulate/disconnect/socket-id
```

### CLI Inspection Tool

```bash
cd api

# Show available commands
pnpm inspect

# Get server stats
pnpm inspect stats

# List rooms
pnpm inspect rooms

# List sockets
pnpm inspect sockets
```

### MCP Server

The API includes an MCP (Model Context Protocol) server that exposes tools for agent-based debugging:

```bash
# Start API with MCP server
cd api && pnpm mcp
```

**Available MCP Tools:**

- `get_all_rooms` - List all active rooms
- `get_room_details` - Get detailed room information
- `get_socket_info` - Get connected socket information
- `get_peer_by_socket` - Get peer by socket ID
- `simulate_peer_disconnect` - Simulate disconnection for testing
- `get_server_stats` - Get server statistics

To use with Claude Code, add to your MCP configuration:

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

### Automated Test Scenarios

Run automated end-to-end test scenarios:

```bash
cd api

# Run all test scenarios
pnpm test:scenarios

# Run against a different server
API_URL=http://example.com pnpm test:scenarios
```

**Test Scenarios:**

1. **Basic Join/Leave** - Tests room joining and peer events
2. **Screen Sharing** - Tests screen share start/stop
3. **WebRTC Signaling** - Tests offer/answer/ICE candidate exchange
4. **Multiple Rooms** - Tests concurrent room management
5. **Heartbeat** - Tests heartbeat mechanism

### Mock Client Library

The `MockClient` class provides a programmatic way to test the API:

```typescript
import { createMockClient, createMockRoom } from './test-utils/mock-client';

// Create a single client
const client = await createMockClient({
  apiUrl: 'http://localhost:3000',
  workspaceId: 'test-workspace',
  roomId: 'test-room',
  userId: 'user-1',
  displayName: 'Test User',
});

await client.joinRoom();
client.sendHeartbeat();
client.disconnect();

// Create a room with multiple peers
const clients = await createMockRoom(
  'http://localhost:3000',
  'workspace-1',
  'room-1',
  3 // number of peers
);
```

## Project Structure

```
tandim/
├── api/                    # Signal server
│   ├── bin/               # Server entrypoints
│   │   ├── www.ts        # HTTP server
│   │   └── mcp.ts        # MCP server
│   ├── routes/            # HTTP routes
│   │   ├── api.ts        # Public API routes
│   │   └── debug.ts      # Debug endpoints
│   ├── services/          # Business logic
│   │   ├── roomState.ts  # Room state management
│   │   └── signalServer.ts # WebRTC signaling
│   ├── test-utils/        # Testing utilities
│   │   ├── mock-client.ts # Mock client for testing
│   │   └── test-scenarios.ts # Automated test scenarios
│   ├── scripts/           # Utility scripts
│   │   ├── inspect-api.ts # CLI inspection tool
│   │   └── run-test-scenarios.ts # Test runner
│   └── mcp-server.ts      # MCP server implementation
├── app/                   # Electron app
│   ├── src/
│   │   ├── main.ts       # Electron main process
│   │   ├── preload.ts    # Preload script
│   │   ├── renderer/     # React UI components
│   │   └── webrtc/       # WebRTC client logic
│   └── tests/            # E2E tests
└── slack-app/            # Slack integration

```

## Features

- **WebRTC-based calls** - Mesh architecture for low latency
- **Screen sharing** - Share your screen with room participants
- **Presence tracking** - See who's online and in which rooms
- **Deep linking** - Join rooms via tandim:// URLs
- **Multi-window** - Separate windows for lobby and active calls

## API Reference

### WebSocket Events (Socket.io)

**Client → Server:**

- `signal:join` - Join a room
- `signal:heartbeat` - Send heartbeat
- `signal:offer` - Send WebRTC offer
- `signal:answer` - Send WebRTC answer
- `signal:ice-candidate` - Send ICE candidate
- `signal:screen-share-start` - Start screen sharing
- `signal:screen-share-stop` - Stop screen sharing

**Server → Client:**

- `signal:joined` - Room joined successfully
- `signal:peer-joined` - Another peer joined
- `signal:peer-left` - Peer left the room
- `signal:offer` - Received WebRTC offer
- `signal:answer` - Received WebRTC answer
- `signal:ice-candidate` - Received ICE candidate
- `signal:screen-share-started` - Screen share started
- `signal:screen-share-stopped` - Screen share stopped
- `signal:error` - Error occurred

## License

MIT
