/**
 * Debug routes for API introspection
 *
 * These endpoints allow HTTP-based inspection of the server state.
 * Useful for debugging and agent-based testing.
 */

import { Router } from "express";
import type { Server } from "socket.io";
import type { RoomStateStore } from "../services/roomState";
import fs from "fs";
import path from "path";

export type DebugContext = {
  roomStateStore: RoomStateStore;
  io: Server;
};

export function createDebugRouter(context: DebugContext): Router {
  const router = Router();

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  router.get("/rooms", (_req, res) => {
    const roomList = context.roomStateStore.getAllRooms();
    res.json({ rooms: roomList });
  });

  router.get("/rooms/:workspaceId/:roomId", (req, res) => {
    const { workspaceId, roomId } = req.params;
    const roomDetails = context.roomStateStore.getRoomDetails(workspaceId, roomId);

    if (!roomDetails) {
      res.status(404).json({
        code: "room_not_found",
        message: "Room not found",
        retryable: false,
      });
      return;
    }

    const peers = roomDetails.peers.map((peer) => ({
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
      activeScreenSharerUserId: roomDetails.activeScreenSharerUserId,
    });
  });

  router.get("/sockets", async (_req, res) => {
    const sockets = await context.io.fetchSockets();
    const socketInfo = sockets.map((socket) => ({
      id: socket.id,
      rooms: Array.from(socket.rooms),
    }));

    res.json({ sockets: socketInfo });
  });

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

  router.get("/stats", async (_req, res) => {
    const rooms = context.roomStateStore.getAllRooms();
    const sockets = await context.io.fetchSockets();

    const stats = {
      totalRooms: rooms.length,
      totalSockets: sockets.length,
      totalPeers: rooms.reduce((sum, room) => sum + room.peerCount, 0),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };

    res.json(stats);
  });

  router.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

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

  router.post("/log", (req, res) => {
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
      res.status(400).json({ error: "Expected { logs: LogMessage[] }" });
      return;
    }

    try {
      for (const log of logs) {
        const { source, level, message, timestamp, data } = log;

        if (!source || !level || !message) {
          continue;
        }

        const logFile = path.join(logsDir, `${source}.log`);
        const logLine = `[${timestamp || new Date().toISOString()}] [${level.toUpperCase()}] ${message}${
          data ? ` ${JSON.stringify(data)}` : ""
        }\n`;

        fs.appendFileSync(logFile, logLine);
      }

      res.json({ success: true, count: logs.length });
    } catch (error) {
      console.error("Failed to write logs:", error);
      res.status(500).json({ error: "Failed to write logs" });
    }
  });

  return router;
}
