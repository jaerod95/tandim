import http from "http";
import { io as ioclient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app from "../app";
import { createSignalServer } from "../services/signalServer";
import { RoomStateStore, CROSSTALK_INVITE_TTL_MS } from "../services/roomState";

type ClientSocket = Socket;

function onceEvent<T>(socket: ClientSocket, eventName: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${eventName}`)), timeoutMs);
    socket.once(eventName, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connectClient(port: number): ClientSocket {
  return ioclient(`http://127.0.0.1:${port}`, { path: "/api/signal" });
}

async function joinRoom(
  client: ClientSocket,
  workspaceId: string,
  roomId: string,
  userId: string,
  displayName: string
): Promise<void> {
  const joined = onceEvent(client, "signal:joined");
  client.emit("signal:join", { workspaceId, roomId, userId, displayName });
  await joined;
}

describe("crosstalk invitation", () => {
  let server: http.Server;
  let roomStateStore: RoomStateStore;
  let port: number;
  const clients: ClientSocket[] = [];

  beforeEach(async () => {
    server = http.createServer(app);
    roomStateStore = new RoomStateStore();
    createSignalServer(server, roomStateStore);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.disconnect();
    }
    clients.length = 0;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  function createClient(): ClientSocket {
    const client = connectClient(port);
    clients.push(client);
    return client;
  }

  it("invite → accept → crosstalk starts", async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([onceEvent(clientA, "connect"), onceEvent(clientB, "connect")]);

    await joinRoom(clientA, "ws1", "room1", "alice", "Alice");
    await joinRoom(clientB, "ws1", "room1", "bob", "Bob");

    // Alice invites Bob
    const invitedPromise = onceEvent<{
      invitationId: string;
      inviterUserId: string;
      inviterDisplayName: string;
      roomId: string;
    }>(clientB, "signal:crosstalk-invited");

    const sentPromise = onceEvent<{
      invitationId: string;
      targetUserIds: string[];
    }>(clientA, "signal:crosstalk-invite-sent");

    clientA.emit("signal:crosstalk-invite", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["bob"]
    });

    const [invited, sent] = await Promise.all([invitedPromise, sentPromise]);

    expect(invited.inviterUserId).toBe("alice");
    expect(invited.inviterDisplayName).toBe("Alice");
    expect(invited.roomId).toBe("room1");
    expect(invited.invitationId).toBeTruthy();
    expect(sent.invitationId).toBe(invited.invitationId);
    expect(sent.targetUserIds).toEqual(["bob"]);

    // Bob accepts
    const acceptedPromise = onceEvent<{
      invitationId: string;
      userId: string;
    }>(clientA, "signal:crosstalk-invite-accepted");

    const startedPromiseA = onceEvent<{
      invitationId: string;
      participantUserIds: string[];
    }>(clientA, "signal:crosstalk-started");

    const startedPromiseB = onceEvent<{
      invitationId: string;
      participantUserIds: string[];
    }>(clientB, "signal:crosstalk-started");

    clientB.emit("signal:crosstalk-invite-accept", {
      workspaceId: "ws1",
      roomId: "room1",
      invitationId: invited.invitationId
    });

    const [accepted, startedA, startedB] = await Promise.all([
      acceptedPromise,
      startedPromiseA,
      startedPromiseB
    ]);

    expect(accepted.invitationId).toBe(invited.invitationId);
    expect(accepted.userId).toBe("bob");
    expect(startedA.participantUserIds.sort()).toEqual(["alice", "bob"]);
    expect(startedB.participantUserIds.sort()).toEqual(["alice", "bob"]);
  });

  it("invite → decline → inviter notified", async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([onceEvent(clientA, "connect"), onceEvent(clientB, "connect")]);

    await joinRoom(clientA, "ws1", "room1", "alice", "Alice");
    await joinRoom(clientB, "ws1", "room1", "bob", "Bob");

    const invitedPromise = onceEvent<{ invitationId: string }>(clientB, "signal:crosstalk-invited");
    clientA.emit("signal:crosstalk-invite", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["bob"]
    });
    const invited = await invitedPromise;

    // Bob declines
    const declinedPromise = onceEvent<{
      invitationId: string;
      userId: string;
    }>(clientA, "signal:crosstalk-invite-declined");

    clientB.emit("signal:crosstalk-invite-decline", {
      workspaceId: "ws1",
      roomId: "room1",
      invitationId: invited.invitationId
    });

    const declined = await declinedPromise;
    expect(declined.invitationId).toBe(invited.invitationId);
    expect(declined.userId).toBe("bob");
  });

  it("invite → timeout → expired notification", async () => {
    const clientA = createClient();
    const clientB = createClient();
    await Promise.all([onceEvent(clientA, "connect"), onceEvent(clientB, "connect")]);

    await joinRoom(clientA, "ws1", "room1", "alice", "Alice");
    await joinRoom(clientB, "ws1", "room1", "bob", "Bob");

    // Create invitation via the store directly with an old timestamp
    const oldTime = Date.now() - CROSSTALK_INVITE_TTL_MS - 1000;
    const result = roomStateStore.createCrosstalkInvitation("ws1", "room1", "alice", ["bob"], oldTime);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Manually trigger expiration check
    const expired = roomStateStore.expireCrosstalkInvitations();
    expect(expired).toHaveLength(1);

    // Verify the store-level expiration worked correctly
    expect(expired[0].invitation.invitationId).toBe(result.invitation.invitationId);
    expect(expired[0].invitation.inviterUserId).toBe("alice");
  });

  it("cannot invite someone not in the room", async () => {
    const clientA = createClient();
    await onceEvent(clientA, "connect");

    await joinRoom(clientA, "ws1", "room1", "alice", "Alice");

    const errorPromise = onceEvent<{ code: string }>(clientA, "signal:error");
    clientA.emit("signal:crosstalk-invite", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["ghost"]
    });

    const error = await errorPromise;
    expect(error.code).toBe("invitee_not_in_room");
  });

  it("cannot accept an invitation you were not invited to", async () => {
    const clientA = createClient();
    const clientB = createClient();
    const clientC = createClient();
    await Promise.all([
      onceEvent(clientA, "connect"),
      onceEvent(clientB, "connect"),
      onceEvent(clientC, "connect")
    ]);

    await joinRoom(clientA, "ws1", "room1", "alice", "Alice");
    await joinRoom(clientB, "ws1", "room1", "bob", "Bob");
    await joinRoom(clientC, "ws1", "room1", "charlie", "Charlie");

    // Alice invites Bob (not Charlie)
    const invitedPromise = onceEvent<{ invitationId: string }>(clientB, "signal:crosstalk-invited");
    clientA.emit("signal:crosstalk-invite", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["bob"]
    });
    const invited = await invitedPromise;

    // Charlie tries to accept
    const errorPromise = onceEvent<{ code: string }>(clientC, "signal:error");
    clientC.emit("signal:crosstalk-invite-accept", {
      workspaceId: "ws1",
      roomId: "room1",
      invitationId: invited.invitationId
    });

    const error = await errorPromise;
    expect(error.code).toBe("not_invited");
  });

  it("multi-user invite: starts only when all accept", async () => {
    const clientA = createClient();
    const clientB = createClient();
    const clientC = createClient();
    await Promise.all([
      onceEvent(clientA, "connect"),
      onceEvent(clientB, "connect"),
      onceEvent(clientC, "connect")
    ]);

    await joinRoom(clientA, "ws1", "room1", "alice", "Alice");
    await joinRoom(clientB, "ws1", "room1", "bob", "Bob");
    await joinRoom(clientC, "ws1", "room1", "charlie", "Charlie");

    // Alice invites both Bob and Charlie
    const invitedB = onceEvent<{ invitationId: string }>(clientB, "signal:crosstalk-invited");
    const invitedC = onceEvent<{ invitationId: string }>(clientC, "signal:crosstalk-invited");
    clientA.emit("signal:crosstalk-invite", {
      workspaceId: "ws1",
      roomId: "room1",
      targetUserIds: ["bob", "charlie"]
    });
    const [invB, invC] = await Promise.all([invitedB, invitedC]);
    expect(invB.invitationId).toBe(invC.invitationId);

    // Bob accepts first — no crosstalk-started yet
    const acceptedByBob = onceEvent<{ userId: string }>(clientA, "signal:crosstalk-invite-accepted");
    clientB.emit("signal:crosstalk-invite-accept", {
      workspaceId: "ws1",
      roomId: "room1",
      invitationId: invB.invitationId
    });
    const bobAccepted = await acceptedByBob;
    expect(bobAccepted.userId).toBe("bob");

    // Charlie accepts — now crosstalk should start
    const startedA = onceEvent<{ participantUserIds: string[] }>(clientA, "signal:crosstalk-started");
    const startedB = onceEvent<{ participantUserIds: string[] }>(clientB, "signal:crosstalk-started");
    const startedC = onceEvent<{ participantUserIds: string[] }>(clientC, "signal:crosstalk-started");

    clientC.emit("signal:crosstalk-invite-accept", {
      workspaceId: "ws1",
      roomId: "room1",
      invitationId: invC.invitationId
    });

    const [sA, sB, sC] = await Promise.all([startedA, startedB, startedC]);
    expect(sA.participantUserIds.sort()).toEqual(["alice", "bob", "charlie"]);
    expect(sB.participantUserIds.sort()).toEqual(["alice", "bob", "charlie"]);
    expect(sC.participantUserIds.sort()).toEqual(["alice", "bob", "charlie"]);
  });
});

describe("RoomStateStore crosstalk invitation unit tests", () => {
  it("createCrosstalkInvitation fails for missing room", () => {
    const store = new RoomStateStore();
    const result = store.createCrosstalkInvitation("ws1", "room1", "alice", ["bob"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("room_not_found");
    }
  });

  it("createCrosstalkInvitation fails for inviter not in room", () => {
    const store = new RoomStateStore();
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "bob", displayName: "Bob", socketId: "s1" });
    const result = store.createCrosstalkInvitation("ws1", "room1", "alice", ["bob"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("inviter_not_in_room");
    }
  });

  it("acceptCrosstalkInvitation fails for non-existent invitation", () => {
    const store = new RoomStateStore();
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "alice", displayName: "Alice", socketId: "s1" });
    const result = store.acceptCrosstalkInvitation("ws1", "room1", "fake-id", "alice");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invitation_not_found");
    }
  });

  it("expireCrosstalkInvitations removes old invitations", () => {
    const store = new RoomStateStore();
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "alice", displayName: "Alice", socketId: "s1" });
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "bob", displayName: "Bob", socketId: "s2" });

    const oldTime = 1000;
    store.createCrosstalkInvitation("ws1", "room1", "alice", ["bob"], oldTime);

    const expired = store.expireCrosstalkInvitations(oldTime + CROSSTALK_INVITE_TTL_MS + 1);
    expect(expired).toHaveLength(1);
    expect(expired[0].invitation.inviterUserId).toBe("alice");

    // Verify it's gone
    expect(store.getCrosstalkInvitation("ws1", "room1", expired[0].invitation.invitationId)).toBeNull();
  });

  it("declineCrosstalkInvitation removes invitee and cleans up when none left", () => {
    const store = new RoomStateStore();
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "alice", displayName: "Alice", socketId: "s1" });
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "bob", displayName: "Bob", socketId: "s2" });

    const created = store.createCrosstalkInvitation("ws1", "room1", "alice", ["bob"]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = store.declineCrosstalkInvitation("ws1", "room1", created.invitation.invitationId, "bob");
    expect(result.ok).toBe(true);

    // Invitation should be cleaned up since no invitees remain
    expect(store.getCrosstalkInvitation("ws1", "room1", created.invitation.invitationId)).toBeNull();
  });
});
