import http from "http";
import { io as ioclient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";

type ClientSocket = Socket;

function onceEvent<T>(socket: ClientSocket, eventName: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(eventName, (payload: T) => resolve(payload));
  });
}

function connect(port: number): ClientSocket {
  return ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
}

async function joinClient(
  port: number,
  userId: string,
  displayName: string,
  workspaceId = "ws1",
  roomId = "room1"
): Promise<ClientSocket> {
  const client = connect(port);
  await onceEvent(client, "connect");

  const joined = onceEvent(client, "signal:joined");
  client.emit("signal:join", { workspaceId, roomId, userId, displayName });
  await joined;

  return client;
}

describe("crosstalk signaling", () => {
  let server: http.Server;
  let port: number;
  let rooms: RoomStateStore;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    rooms = new RoomStateStore();
    server = http.createServer(app);
    createSignalServer(server, rooms);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients.length = 0;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("broadcasts crosstalk-started to all room members", async () => {
    const a = await joinClient(port, "u1", "User 1");
    const b = await joinClient(port, "u2", "User 2");
    const c = await joinClient(port, "u3", "User 3");
    clients.push(a, b, c);

    const startedB = onceEvent<{ crosstalk: { id: string; initiatorUserId: string; participantUserIds: string[] } }>(b, "signal:crosstalk-started");
    const startedC = onceEvent<{ crosstalk: { id: string; initiatorUserId: string; participantUserIds: string[] } }>(c, "signal:crosstalk-started");

    a.emit("signal:crosstalk-start", { targetUserIds: ["u2"] });

    const [eventB, eventC] = await Promise.all([startedB, startedC]);

    expect(eventB.crosstalk.initiatorUserId).toBe("u1");
    expect(eventB.crosstalk.participantUserIds.sort()).toEqual(["u1", "u2"]);
    expect(eventC.crosstalk.id).toBe(eventB.crosstalk.id);
  });

  it("broadcasts crosstalk-ended when explicitly ended", async () => {
    const a = await joinClient(port, "u1", "User 1");
    const b = await joinClient(port, "u2", "User 2");
    clients.push(a, b);

    const started = onceEvent<{ crosstalk: { id: string } }>(b, "signal:crosstalk-started");
    a.emit("signal:crosstalk-start", { targetUserIds: ["u2"] });
    const { crosstalk } = await started;

    const ended = onceEvent<{ crosstalkId: string }>(b, "signal:crosstalk-ended");
    a.emit("signal:crosstalk-end", { crosstalkId: crosstalk.id });
    const endEvent = await ended;

    expect(endEvent.crosstalkId).toBe(crosstalk.id);
  });

  it("emits crosstalk-ended for auto-left crosstalks when starting a new one", async () => {
    const a = await joinClient(port, "u1", "User 1");
    const b = await joinClient(port, "u2", "User 2");
    const c = await joinClient(port, "u3", "User 3");
    clients.push(a, b, c);

    const started1 = onceEvent<{ crosstalk: { id: string } }>(b, "signal:crosstalk-started");
    a.emit("signal:crosstalk-start", { targetUserIds: ["u2"] });
    const { crosstalk: ct1 } = await started1;

    // u1 starts a new crosstalk with u3 — should auto-end ct1
    const ended = onceEvent<{ crosstalkId: string }>(b, "signal:crosstalk-ended");
    const started2 = onceEvent<{ crosstalk: { id: string } }>(b, "signal:crosstalk-started");

    a.emit("signal:crosstalk-start", { targetUserIds: ["u3"] });

    const endEvent = await ended;
    expect(endEvent.crosstalkId).toBe(ct1.id);

    const { crosstalk: ct2 } = await started2;
    expect(ct2.id).not.toBe(ct1.id);
  });

  it("cleans up crosstalks on disconnect", async () => {
    const a = await joinClient(port, "u1", "User 1");
    const b = await joinClient(port, "u2", "User 2");
    const c = await joinClient(port, "u3", "User 3");
    clients.push(a, b, c);

    const started = onceEvent<{ crosstalk: { id: string } }>(b, "signal:crosstalk-started");
    a.emit("signal:crosstalk-start", { targetUserIds: ["u2"] });
    const { crosstalk } = await started;

    const ended = onceEvent<{ crosstalkId: string }>(b, "signal:crosstalk-ended");
    a.disconnect();
    const endEvent = await ended;

    expect(endEvent.crosstalkId).toBe(crosstalk.id);
  });

  it("supports two concurrent crosstalks in the same room", async () => {
    const a = await joinClient(port, "u1", "User 1");
    const b = await joinClient(port, "u2", "User 2");
    const c = await joinClient(port, "u3", "User 3");
    const d = await joinClient(port, "u4", "User 4");
    clients.push(a, b, c, d);

    // Start first crosstalk and wait for it to propagate
    const started1 = onceEvent<{ crosstalk: { id: string } }>(b, "signal:crosstalk-started");
    a.emit("signal:crosstalk-start", { targetUserIds: ["u2"] });
    const { crosstalk: ct1 } = await started1;

    // Now start second crosstalk — d will receive both started events,
    // so we need to wait for the one that matches u3/u4
    const started2 = new Promise<{ crosstalk: { id: string; participantUserIds: string[] } }>((resolve) => {
      d.on("signal:crosstalk-started", (data: { crosstalk: { id: string; participantUserIds: string[] } }) => {
        if (data.crosstalk.participantUserIds.includes("u4")) {
          resolve(data);
        }
      });
    });
    c.emit("signal:crosstalk-start", { targetUserIds: ["u4"] });
    const { crosstalk: ct2 } = await started2;

    expect(ct1.id).not.toBe(ct2.id);

    // Both crosstalks exist in room state
    const crosstalks = rooms.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(2);
  });

  it("includes crosstalks in the joined event for late joiners", async () => {
    const a = await joinClient(port, "u1", "User 1");
    const b = await joinClient(port, "u2", "User 2");
    clients.push(a, b);

    const started = onceEvent<{ crosstalk: { id: string } }>(b, "signal:crosstalk-started");
    a.emit("signal:crosstalk-start", { targetUserIds: ["u2"] });
    const { crosstalk } = await started;

    // A new user joins and should see the existing crosstalk
    const c = connect(port);
    await onceEvent(c, "connect");
    clients.push(c);

    const joinedData = onceEvent<{ crosstalks: Array<{ id: string; participantUserIds: string[] }> }>(c, "signal:joined");
    c.emit("signal:join", { workspaceId: "ws1", roomId: "room1", userId: "u3", displayName: "User 3" });
    const data = await joinedData;

    expect(data.crosstalks).toHaveLength(1);
    expect(data.crosstalks[0].id).toBe(crosstalk.id);
  });

  it("emits error for invalid crosstalk-start payload", async () => {
    const a = await joinClient(port, "u1", "User 1");
    clients.push(a);

    const error = onceEvent<{ code: string }>(a, "signal:error");
    a.emit("signal:crosstalk-start", { bad: "payload" });
    const errorEvent = await error;

    expect(errorEvent.code).toBe("invalid_crosstalk_payload");
  });

  it("emits error for invalid crosstalk-end payload", async () => {
    const a = await joinClient(port, "u1", "User 1");
    clients.push(a);

    const error = onceEvent<{ code: string }>(a, "signal:error");
    a.emit("signal:crosstalk-end", {});
    const errorEvent = await error;

    expect(errorEvent.code).toBe("invalid_crosstalk_payload");
  });
});
