import http from "http";
import createDebug from "debug";

import app, { mountErrorHandlers } from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";
import { PresenceStore } from "../services/presenceStore";
import { createDebugRouter } from "../routes/debug";
import { createRoomsRouter, createPresenceRouter } from "../routes/api";

const debug = createDebug("api:server");
const port = normalizePort(process.env.PORT ?? "3000");

app.set("port", port);

const server = http.createServer(app);
const roomStateStore = new RoomStateStore();
const presenceStore = new PresenceStore();
const io = createSignalServer(server, roomStateStore, presenceStore);

// Mount routes that require server context, then error handlers last
app.use("/api/debug", createDebugRouter({ roomStateStore, io }));
app.use("/api/rooms", createRoomsRouter(roomStateStore));
app.use("/api/presence", createPresenceRouter(presenceStore));
mountErrorHandlers();

// Prune inactive peers every 30 seconds
setInterval(() => {
  const removed = roomStateStore.pruneInactivePeers(60_000);
  for (const { roomKey, userId, endedCrosstalkIds } of removed) {
    const channel = `${roomKey.workspaceId}:${roomKey.roomId}`;
    io.to(channel).emit("signal:peer-left", {
      userId,
      activeScreenSharerUserId: null,
    });
    for (const crosstalkId of endedCrosstalkIds) {
      io.to(channel).emit("signal:crosstalk-ended", { crosstalkId });
    }
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
