import http from "http";
import createDebug from "debug";

import app, { mountErrorHandlers } from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";
import { createDebugRouter } from "../routes/debug";
import { createRoomsRouter } from "../routes/api";

const debug = createDebug("api:server");
const port = normalizePort(process.env.PORT ?? "3000");

app.set("port", port);

const server = http.createServer(app);
const roomStateStore = new RoomStateStore();
const io = createSignalServer(server, roomStateStore);

// Mount routes that require server context, then error handlers last
app.use("/api/debug", createDebugRouter({ roomStateStore, io }));
app.use("/api/rooms", createRoomsRouter(roomStateStore));
mountErrorHandlers();

// Prune inactive peers every 30 seconds
setInterval(() => {
  const removed = roomStateStore.pruneInactivePeers(60_000);
  for (const { roomKey, userId } of removed) {
    io.to(`${roomKey.workspaceId}:${roomKey.roomId}`).emit("signal:peer-left", {
      userId,
      activeScreenSharerUserId: null,
    });
  }
}, 30_000);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val: string): number | string | false {
  const parsedPort = Number.parseInt(val, 10);

  if (Number.isNaN(parsedPort)) {
    return val;
  }

  if (parsedPort >= 0) {
    return parsedPort;
  }

  return false;
}

function onError(error: NodeJS.ErrnoException): never | void {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? `Pipe ${port}` : `Port ${port}`;

  switch (error.code) {
    case "EACCES":
      console.error(`${bind} requires elevated privileges`);
      process.exit(1);
      return;
    case "EADDRINUSE":
      console.error(`${bind} is already in use`);
      process.exit(1);
      return;
    default:
      throw error;
  }
}

function onListening(): void {
  const addr = server.address();

  if (!addr) {
    return;
  }

  const bind = typeof addr === "string" ? `pipe ${addr}` : `port ${addr.port}`;
  debug(`Listening on ${bind}`);
}
