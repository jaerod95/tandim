#!/usr/bin/env node
/**
 * MCP Server entrypoint
 *
 * This script starts the MCP server for Tandim API introspection.
 * It connects to a running API server and exposes tools for debugging.
 */

import http from "http";
import app, { setDebugContext } from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";
import { startMCPServer } from "../mcp-server";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

app.set("port", port);

const server = http.createServer(app);
const roomStateStore = new RoomStateStore();
const io = createSignalServer(server, roomStateStore);

// Set debug context
setDebugContext({ roomStateStore, io });

// Start HTTP server
server.listen(port, () => {
  console.error(`API server listening on port ${port}`);
});

// Start MCP server
startMCPServer({ roomStateStore, io }).catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
