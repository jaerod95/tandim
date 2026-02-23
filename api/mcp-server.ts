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
  const server = new Server(
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

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
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
    ],
  }));

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "get_all_rooms": {
          const roomList = context.roomStateStore.getAllRooms().map(room => ({
            ...room,
            activeScreenSharerUserId: null, // Add this via enhanced getter if needed
          }));

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
          const roomDetails = context.roomStateStore.getRoomDetails(workspaceId, roomId);

          if (!roomDetails) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: "Room not found" }),
                },
              ],
            };
          }

          const peers = roomDetails.peers.map((peer) => ({
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
                    activeScreenSharerUserId: roomDetails.activeScreenSharerUserId,
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
          const rooms = context.roomStateStore.getAllRooms();
          const sockets = await context.io.fetchSockets();

          const stats = {
            totalRooms: rooms.length,
            totalSockets: sockets.length,
            totalPeers: rooms.reduce((sum, room) => sum + room.peerCount, 0),
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
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error("Tandim API MCP Server running");
}
