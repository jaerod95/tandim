import http from "http";
import { io as ioclient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { createSignalServer } from "../services/signalServer";

type ClientSocket = Socket;

function onceEvent<T>(socket: ClientSocket, eventName: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(eventName, (payload: T) => resolve(payload));
  });
}

describe("crosstalk signaling", () => {
  let server: http.Server;
  let port: number;
  let clientA: ClientSocket | null = null;
  let clientB: ClientSocket | null = null;
  let clientC: ClientSocket | null = null;

  beforeEach(async () => {
    server = http.createServer(app);
    createSignalServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    clientA?.disconnect();
    clientB?.disconnect();
    clientC?.disconnect();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  async function connectAndJoin(userId: string, displayName: string): Promise<ClientSocket> {
    const client = ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
    await onceEvent(client, "connect");
    const joined = onceEvent(client, "signal:joined");
    client.emit("signal:join", {
      workspaceId: "ws1",
      roomId: "room1",
      userId,
      displayName
    });
    await joined;
    return client;
  }

  it("broadcasts crosstalk-started to all room members", async () => {
    clientA = await connectAndJoin("u1", "User One");
    clientB = await connectAndJoin("u2", "User Two");
    clientC = await connectAndJoin("u3", "User Three");

    const startedA = onceEvent<{ crosstalkId: string; participantUserIds: string[]; initiatorUserId: string }>(clientA, "signal:crosstalk-started");
    const startedB = onceEvent<{ crosstalkId: string; participantUserIds: string[]; initiatorUserId: string }>(clientB, "signal:crosstalk-started");
    const startedC = onceEvent<{ crosstalkId: string; participantUserIds: string[]; initiatorUserId: string }>(clientC, "signal:crosstalk-started");

    clientA.emit("signal:crosstalk-start", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["u2"]
    });

    const [eventA, eventB, eventC] = await Promise.all([startedA, startedB, startedC]);

    // All room members receive the event
    expect(eventA.crosstalkId).toBeTruthy();
    expect(eventA.initiatorUserId).toBe("u1");
    expect(eventA.participantUserIds.sort()).toEqual(["u1", "u2"]);

    expect(eventB.crosstalkId).toBe(eventA.crosstalkId);
    expect(eventC.crosstalkId).toBe(eventA.crosstalkId);
  });

  it("broadcasts crosstalk-ended to all room members", async () => {
    clientA = await connectAndJoin("u1", "User One");
    clientB = await connectAndJoin("u2", "User Two");
    clientC = await connectAndJoin("u3", "User Three");

    const started = onceEvent<{ crosstalkId: string }>(clientA, "signal:crosstalk-started");
    clientA.emit("signal:crosstalk-start", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["u2"]
    });
    const { crosstalkId } = await started;

    const endedA = onceEvent<{ crosstalkId: string }>(clientA, "signal:crosstalk-ended");
    const endedB = onceEvent<{ crosstalkId: string }>(clientB, "signal:crosstalk-ended");
    const endedC = onceEvent<{ crosstalkId: string }>(clientC, "signal:crosstalk-ended");

    clientB.emit("signal:crosstalk-end", {
      workspaceId: "ws1",
      roomId: "room1",
      crosstalkId
    });

    const [eA, eB, eC] = await Promise.all([endedA, endedB, endedC]);
    expect(eA.crosstalkId).toBe(crosstalkId);
    expect(eB.crosstalkId).toBe(crosstalkId);
    expect(eC.crosstalkId).toBe(crosstalkId);
  });

  it("auto-ends crosstalk when participant disconnects", async () => {
    clientA = await connectAndJoin("u1", "User One");
    clientB = await connectAndJoin("u2", "User Two");

    const started = onceEvent<{ crosstalkId: string }>(clientA, "signal:crosstalk-started");
    clientA.emit("signal:crosstalk-start", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["u2"]
    });
    const { crosstalkId } = await started;

    const ended = onceEvent<{ crosstalkId: string }>(clientA, "signal:crosstalk-ended");
    clientB.disconnect();
    clientB = null;

    const event = await ended;
    expect(event.crosstalkId).toBe(crosstalkId);
  });

  it("emits error for invalid crosstalk-start payload", async () => {
    clientA = await connectAndJoin("u1", "User One");

    const error = onceEvent<{ code: string }>(clientA, "signal:error");
    clientA.emit("signal:crosstalk-start", { bad: "data" });
    const event = await error;
    expect(event.code).toBe("invalid_crosstalk_start_payload");
  });

  it("emits error when starting crosstalk for non-room member", async () => {
    clientA = await connectAndJoin("u1", "User One");
    clientB = await connectAndJoin("u2", "User Two");

    const error = onceEvent<{ code: string }>(clientA, "signal:error");
    clientA.emit("signal:crosstalk-start", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["nobody"]
    });
    const event = await error;
    expect(event.code).toBe("target_not_in_room");
  });

  it("emits error when ending a non-existent crosstalk", async () => {
    clientA = await connectAndJoin("u1", "User One");

    const error = onceEvent<{ code: string }>(clientA, "signal:error");
    clientA.emit("signal:crosstalk-end", {
      workspaceId: "ws1",
      roomId: "room1",
      crosstalkId: "ct_nonexistent"
    });
    const event = await error;
    expect(event.code).toBe("crosstalk_not_found");
  });
});
