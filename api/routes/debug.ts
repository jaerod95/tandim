/**
 * Debug routes for API introspection
 *
 * These endpoints allow HTTP-based inspection of the server state.
 * Useful for debugging and agent-based testing.
 */

import { Router } from "express";
import type { RoomStateStore } from "../services/roomState";
import type { Server as SocketIOServer } from "socket.io";

export interface DebugContext {
  roomStateStore: RoomStateStore;
  io: SocketIOServer;
}

export function createDebugRouter(context: DebugContext): Router {
  const router = Router();

  // Get all rooms
  router.get("/rooms", (_req, res) => {
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

    res.json({ rooms: roomList });
  });

  // Get specific room details
  router.get("/rooms/:workspaceId/:roomId", (req, res) => {
    const { workspaceId, roomId } = req.params;
    const rooms = (context.roomStateStore as any).rooms;
    const roomKey = `${workspaceId}:${roomId}`;
    const room = rooms.get(roomKey);

    if (!room) {
      res.status(404).json({
        code: "room_not_found",
        message: "Room not found",
        retryable: false,
      });
      return;
    }

    const peers = Array.from(room.peersByUserId.values()).map((peer: any) => ({
      userId: peer.userId,
      displayName: peer.displayName,
      socketId: peer.socketId,
      joinedAt: new Date(peer.joinedAt).toISOString(),
      lastHeartbeatAt: new Date(peer.lastHeartbeatAt).toISOString(),
      inactiveForMs: Date.now() - peer.lastHeartbeatAt,
    }));

    res.json({
      workspaceId,
      roomId,
      peerCount: peers.length,
      peers,
      activeScreenSharerUserId: room.activeScreenSharerUserId,
    });
  });

  // Get socket information
  router.get("/sockets", async (_req, res) => {
    const sockets = await context.io.fetchSockets();
    const socketInfo = sockets.map((socket) => ({
      id: socket.id,
      rooms: Array.from(socket.rooms),
      connected: socket.connected,
    }));

    res.json({ sockets: socketInfo });
  });

  // Get peer by socket ID
  router.get("/sockets/:socketId", (req, res) => {
    const { socketId } = req.params;
    const membership = context.roomStateStore.getMembershipBySocket(socketId);

    if (!membership) {
      res.status(404).json({
        code: "socket_not_found",
        message: "Socket not found or not in a room",
        retryable: false,
      });
      return;
    }

    res.json(membership);
  });

  // Get server statistics
  router.get("/stats", async (_req, res) => {
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
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.json(stats);
  });

  // Health check
  router.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Simulate peer disconnect (for testing)
  router.post("/simulate/disconnect/:socketId", async (req, res) => {
    const { socketId } = req.params;
    const sockets = await context.io.fetchSockets();
    const socket = sockets.find((s) => s.id === socketId);

    if (!socket) {
      res.status(404).json({
        code: "socket_not_found",
        message: "Socket not found",
        retryable: false,
      });
      return;
    }

    socket.disconnect(true);
    res.json({ success: true, socketId });
  });

  return router;
}
