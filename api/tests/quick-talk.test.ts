import http from "http";
import { io as ioclient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore } from "../services/roomState";
import { PresenceStore } from "../services/presenceStore";

type ClientSocket = Socket;

function onceEvent<T>(socket: ClientSocket, eventName: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${eventName}`)), timeoutMs);
    socket.once(eventName, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

function connect(port: number): ClientSocket {
  return ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
}

async function connectPresence(
  port: number,
  userId: string,
  displayName: string,
  workspaceId = "ws1"
): Promise<ClientSocket> {
  const client = connect(port);
  await onceEvent(client, "connect");

  const snapshot = onceEvent(client, "presence:snapshot");
  client.emit("presence:connect", { userId, displayName, workspaceId });
  await snapshot;

  return client;
}

describe("quick talk signaling", () => {
  let server: http.Server;
  let port: number;
  let rooms: RoomStateStore;
  let presence: PresenceStore;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    rooms = new RoomStateStore();
    presence = new PresenceStore();
    server = http.createServer(app);
    createSignalServer(server, rooms, presence);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients.length = 0;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it("sends quick-talk-incoming to target and quick-talk-created to requester", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(alice, bob);

    const created = onceEvent<{ roomId: string; targetUserId: string }>(alice, "signal:quick-talk-created");
    const incoming = onceEvent<{ roomId: string; fromUserId: string; fromDisplayName: string; workspaceId: string }>(
      bob,
      "signal:quick-talk-incoming"
    );

    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });

    const [createdEvent, incomingEvent] = await Promise.all([created, incoming]);

    expect(createdEvent.roomId).toMatch(/^quick-talk-/);
    expect(createdEvent.targetUserId).toBe("bob");
    expect(incomingEvent.roomId).toBe(createdEvent.roomId);
    expect(incomingEvent.fromUserId).toBe("alice");
    expect(incomingEvent.fromDisplayName).toBe("Alice");
    expect(incomingEvent.workspaceId).toBe("ws1");
  });

  it("notifies requester when target accepts", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(alice, bob);

    const created = onceEvent<{ roomId: string }>(alice, "signal:quick-talk-created");
    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });
    const { roomId } = await created;

    // Wait for bob to receive the incoming event too
    await onceEvent(bob, "signal:quick-talk-incoming");

    const accepted = onceEvent<{ roomId: string; targetUserId: string }>(alice, "signal:quick-talk-accepted");
    bob.emit("signal:quick-talk-accept", { roomId });

    const acceptedEvent = await accepted;
    expect(acceptedEvent.roomId).toBe(roomId);
    expect(acceptedEvent.targetUserId).toBe("bob");
  });

  it("notifies requester when target declines", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(alice, bob);

    const created = onceEvent<{ roomId: string }>(alice, "signal:quick-talk-created");
    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });
    const { roomId } = await created;

    await onceEvent(bob, "signal:quick-talk-incoming");

    const declined = onceEvent<{ roomId: string; targetUserId: string }>(alice, "signal:quick-talk-declined");
    bob.emit("signal:quick-talk-decline", { roomId });

    const declinedEvent = await declined;
    expect(declinedEvent.roomId).toBe(roomId);
    expect(declinedEvent.targetUserId).toBe("bob");
  });

  it("emits error when target user is not online", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    clients.push(alice);

    const error = onceEvent<{ code: string }>(alice, "signal:error");
    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "ghost" });

    const errorEvent = await error;
    expect(errorEvent.code).toBe("target_not_found");
  });

  it("emits error when target user is in DND mode", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(alice, bob);

    // Set bob to DND
    bob.emit("presence:status-change", { status: "dnd" });
    // Wait for presence update to propagate
    await onceEvent(alice, "presence:user-updated");

    const error = onceEvent<{ code: string }>(alice, "signal:error");
    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });

    const errorEvent = await error;
    expect(errorEvent.code).toBe("target_dnd");
  });

  it("emits error when requester has no presence connection", async () => {
    const client = connect(port);
    await onceEvent(client, "connect");
    clients.push(client);

    const error = onceEvent<{ code: string }>(client, "signal:error");
    client.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });

    const errorEvent = await error;
    expect(errorEvent.code).toBe("not_connected");
  });

  it("emits error for invalid quick-talk-request payload", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    clients.push(alice);

    const error = onceEvent<{ code: string }>(alice, "signal:error");
    alice.emit("signal:quick-talk-request", { bad: "data" });

    const errorEvent = await error;
    expect(errorEvent.code).toBe("invalid_quick_talk_payload");
  });

  it("emits error when accepting a non-existent quick talk", async () => {
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(bob);

    const error = onceEvent<{ code: string }>(bob, "signal:error");
    bob.emit("signal:quick-talk-accept", { roomId: "nonexistent-room" });

    const errorEvent = await error;
    expect(errorEvent.code).toBe("quick_talk_not_found");
  });

  it("emits error when declining a non-existent quick talk", async () => {
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(bob);

    const error = onceEvent<{ code: string }>(bob, "signal:error");
    bob.emit("signal:quick-talk-decline", { roomId: "nonexistent-room" });

    const errorEvent = await error;
    expect(errorEvent.code).toBe("quick_talk_not_found");
  });

  it("cancels pending quick talk when requester disconnects", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(alice, bob);

    const created = onceEvent<{ roomId: string }>(alice, "signal:quick-talk-created");
    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });
    const { roomId } = await created;

    await onceEvent(bob, "signal:quick-talk-incoming");

    const cancelled = onceEvent<{ roomId: string }>(bob, "signal:quick-talk-cancelled");
    alice.disconnect();

    const cancelledEvent = await cancelled;
    expect(cancelledEvent.roomId).toBe(roomId);
  });

  it("creates a quick talk room in room state", async () => {
    const alice = await connectPresence(port, "alice", "Alice");
    const bob = await connectPresence(port, "bob", "Bob");
    clients.push(alice, bob);

    const created = onceEvent<{ roomId: string }>(alice, "signal:quick-talk-created");
    alice.emit("signal:quick-talk-request", { workspaceId: "ws1", targetUserId: "bob" });
    const { roomId } = await created;

    expect(rooms.isQuickTalkRoom("ws1", roomId)).toBe(true);
  });
});
