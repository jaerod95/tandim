#!/usr/bin/env node
/**
 * MCP Server entrypoint
 *
 * This script starts the MCP server for Tandim API introspection.
 * It connects to a running API server and exposes tools for debugging.
 */

import http from "http";
import app, { mountErrorHandlers } from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";
import { startMCPServer } from "../mcp-server";
import { createDebugRouter } from "../routes/debug";
import { createRoomsRouter } from "../routes/api";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

app.set("port", port);

const server = http.createServer(app);
const roomStateStore = new RoomStateStore();
const io = createSignalServer(server, roomStateStore);

// Mount routes that require server context, then error handlers last
app.use("/api/debug", createDebugRouter({ roomStateStore, io }));
app.use("/api/rooms", createRoomsRouter(roomStateStore));
mountErrorHandlers();

// Start HTTP server
server.listen(port, () => {
  console.error(`API server listening on port ${port}`);
});

// Start MCP server
startMCPServer({ roomStateStore, io }).catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
