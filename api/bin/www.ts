import http from "http";
import createDebug from "debug";

import app, { setDebugContext } from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";

const debug = createDebug("api:server");
const port = normalizePort(process.env.PORT ?? "3000");

app.set("port", port);

const server = http.createServer(app);
const roomStateStore = new RoomStateStore();
const io = createSignalServer(server, roomStateStore);

// Set debug context for introspection
setDebugContext({ roomStateStore, io });

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
