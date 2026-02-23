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

describe("signal server", () => {
  let server: http.Server;
  let port: number;
  let clientA: ClientSocket | null = null;
  let clientB: ClientSocket | null = null;

  beforeEach(async () => {
    server = http.createServer(app);
    createSignalServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    clientA?.disconnect();
    clientB?.disconnect();
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("broadcasts join/leave and relays offer signals", async () => {
    clientA = ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
    clientB = ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });

    await Promise.all([onceEvent(clientA, "connect"), onceEvent(clientB, "connect")]);

    const clientAJoined = onceEvent<{ peers: Array<{ userId: string }> }>(clientA, "signal:joined");
    clientA.emit("signal:join", {
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u1",
      displayName: "User One"
    });
    await clientAJoined;

    const peerJoined = onceEvent<{ userId: string }>(clientA, "signal:peer-joined");
    const clientBJoined = onceEvent<{ peers: Array<{ userId: string }> }>(clientB, "signal:joined");
    clientB.emit("signal:join", {
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u2",
      displayName: "User Two"
    });

    const joinedEvent = await clientBJoined;
    expect(joinedEvent.peers.map((peer) => peer.userId).sort()).toEqual(["u1", "u2"]);
    expect((await peerJoined).userId).toBe("u2");

    const offerEvent = onceEvent<{ fromUserId: string; payload: unknown }>(clientB, "signal:offer");
    clientA.emit("signal:offer", {
      workspaceId: "ws1",
      roomId: "room1",
      toUserId: "u2",
      payload: { sdp: "offer-sdp" }
    });
    const offerPayload = await offerEvent;
    expect(offerPayload.fromUserId).toBe("u1");
    expect(offerPayload.payload).toEqual({ sdp: "offer-sdp" });

    const peerLeft = onceEvent<{ userId: string }>(clientA, "signal:peer-left");
    clientB.disconnect();
    expect((await peerLeft).userId).toBe("u2");
  });

  it("handles screen share start and stop", async () => {
    clientA = ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
    clientB = ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
    await Promise.all([onceEvent(clientA, "connect"), onceEvent(clientB, "connect")]);

    const joinedA = onceEvent(clientA, "signal:joined");
    const joinedB = onceEvent(clientB, "signal:joined");
    clientA.emit("signal:join", {
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u1",
      displayName: "User One"
    });
    clientB.emit("signal:join", {
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u2",
      displayName: "User Two"
    });
    await Promise.all([joinedA, joinedB]);

    const started = onceEvent<{ userId: string }>(clientB, "signal:screen-share-started");
    clientA.emit("signal:screen-share-start");
    expect((await started).userId).toBe("u1");

    const stopped = onceEvent<{ activeScreenSharerUserId: string | null }>(clientB, "signal:screen-share-stopped");
    clientA.emit("signal:screen-share-stop");
    expect((await stopped).activeScreenSharerUserId).toBeNull();
  });
});
