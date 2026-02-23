import http from "node:http";
import { io as clientIo } from "socket.io-client";
import app from "../app";
import { createSignalServer } from "../services/signalServer";

async function run(): Promise<void> {
  const baseUrl = process.env.RENDER_API_URL;
  if (baseUrl) {
    await smokeAgainstBaseUrl(baseUrl);
    return;
  }

  const server = http.createServer(app);
  createSignalServer(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as { port: number }).port;
  try {
    await smokeAgainstBaseUrl(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

async function smokeAgainstBaseUrl(baseUrl: string): Promise<void> {
  const health = await fetch(`${baseUrl}/api/health`);
  if (!health.ok) {
    throw new Error(`Health check failed: ${health.status}`);
  }

  const slack = await fetch(`${baseUrl}/api/slack/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ type: "noop" })
  });
  if (![202, 401].includes(slack.status)) {
    throw new Error(`Slack endpoint check failed: ${slack.status}`);
  }

  await new Promise<void>((resolve, reject) => {
    const socket = clientIo(baseUrl, { path: "/api/signal", transports: ["websocket"] });
    socket.once("connect", () => {
      socket.disconnect();
      resolve();
    });
    socket.once("connect_error", (error) => reject(error));
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
