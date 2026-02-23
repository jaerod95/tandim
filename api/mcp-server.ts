/**
 * MCP Server for Tandim API Introspection
 *
 * Provides tools for agents to inspect and debug the Tandim API server.
 * This enables real-time querying of room state, connections, and WebRTC sessions.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { RoomStateStore } from "./services/roomState";
import type { Server as SocketIOServer } from "socket.io";

interface MCPServerContext {
  roomStateStore: RoomStateStore;
  io: SocketIOServer;
}

export function createMCPServer(context: MCPServerContext) {
  const server = new StdioServer(
    {
      name: "tandim-api-inspector",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools: Tool[] = [
    {
      name: "get_all_rooms",
      description: "Get a list of all active rooms with peer counts",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_room_details",
      description: "Get detailed information about a specific room including all peers",
      inputSchema: {
        type: "object",
        properties: {
          workspaceId: {
            type: "string",
            description: "The workspace ID",
          },
          roomId: {
            type: "string",
            description: "The room ID",
          },
        },
        required: ["workspaceId", "roomId"],
      },
    },
    {
      name: "get_socket_info",
      description: "Get information about connected sockets",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_peer_by_socket",
      description: "Get peer information by socket ID",
      inputSchema: {
        type: "object",
        properties: {
          socketId: {
            type: "string",
            description: "The socket ID",
          },
        },
        required: ["socketId"],
      },
    },
    {
      name: "simulate_peer_disconnect",
      description: "Simulate a peer disconnection for testing",
      inputSchema: {
        type: "object",
        properties: {
          socketId: {
            type: "string",
            description: "The socket ID to disconnect",
          },
        },
        required: ["socketId"],
      },
    },
    {
      name: "get_server_stats",
      description: "Get overall server statistics",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_all_rooms": {
          // Access internal state through reflection (add getter methods to RoomStateStore)
          const rooms = (context.roomStateStore as any).rooms;
          const roomList = Array.from(rooms.entries()).map(([key, room]: [string, any]) => {
            const [workspaceId, roomId] = key.split(":");
            return {
              workspaceId,
              roomId,
              peerCount: room.peersByUserId.size,
              activeScreenSharerUserId: room.activeScreenSharerUserId,
            };
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(roomList, null, 2),
              },
            ],
          };
        }

        case "get_room_details": {
          const { workspaceId, roomId } = args as { workspaceId: string; roomId: string };
          const rooms = (context.roomStateStore as any).rooms;
          const roomKey = `${workspaceId}:${roomId}`;
          const room = rooms.get(roomKey);

          if (!room) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: "Room not found" }),
                },
              ],
            };
          }

          const peers = Array.from(room.peersByUserId.values()).map((peer: any) => ({
            userId: peer.userId,
            displayName: peer.displayName,
            socketId: peer.socketId,
            joinedAt: new Date(peer.joinedAt).toISOString(),
            lastHeartbeatAt: new Date(peer.lastHeartbeatAt).toISOString(),
            inactiveForMs: Date.now() - peer.lastHeartbeatAt,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    workspaceId,
                    roomId,
                    peerCount: peers.length,
                    peers,
                    activeScreenSharerUserId: room.activeScreenSharerUserId,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "get_socket_info": {
          const sockets = await context.io.fetchSockets();
          const socketInfo = sockets.map((socket) => ({
            id: socket.id,
            rooms: Array.from(socket.rooms),
            connected: socket.connected,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(socketInfo, null, 2),
              },
            ],
          };
        }

        case "get_peer_by_socket": {
          const { socketId } = args as { socketId: string };
          const membership = context.roomStateStore.getMembershipBySocket(socketId);

          if (!membership) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: "Socket not found or not in a room" }),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(membership, null, 2),
              },
            ],
          };
        }

        case "simulate_peer_disconnect": {
          const { socketId } = args as { socketId: string };
          const socket = (await context.io.fetchSockets()).find((s) => s.id === socketId);

          if (!socket) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: "Socket not found" }),
                },
              ],
            };
          }

          socket.disconnect(true);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, socketId }),
              },
            ],
          };
        }

        case "get_server_stats": {
          const rooms = (context.roomStateStore as any).rooms;
          const sockets = await context.io.fetchSockets();

          const stats = {
            totalRooms: rooms.size,
            totalSockets: sockets.length,
            totalPeers: Array.from(rooms.values()).reduce(
              (sum: number, room: any) => sum + room.peersByUserId.size,
              0
            ),
            timestamp: new Date().toISOString(),
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(stats, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: `Unknown tool: ${name}` }),
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: String(error) }),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMCPServer(context: MCPServerContext) {
  const server = createMCPServer(context);
  await server.connect({
    reader: process.stdin,
    writer: process.stdout,
  });

  console.error("Tandim API MCP Server running");
}
