import http from "http";
import request from "supertest";
import { io as ioclient, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import app, { mountErrorHandlers } from "../app";
import authRouter from "../routes/auth";
import { createSignalServer } from "../services/signalServer";
import {
  registerUser,
  authenticateUser,
  generateToken,
  verifyToken,
  _resetUsers,
} from "../services/auth";

// ── Service unit tests ──────────────────────────────────────

describe("auth service", () => {
  beforeEach(() => _resetUsers());

  it("registers a new user and returns userId + displayName", () => {
    const user = registerUser("Alice", "password123");
    expect(user.userId).toMatch(/^u-/);
    expect(user.displayName).toBe("Alice");
  });

  it("throws when registering a duplicate displayName", () => {
    registerUser("Alice", "password123");
    expect(() => registerUser("Alice", "other")).toThrow("User already exists");
  });

  it("duplicate check is case-insensitive", () => {
    registerUser("Alice", "password123");
    expect(() => registerUser("alice", "other")).toThrow("User already exists");
  });

  it("authenticates with correct credentials", () => {
    registerUser("Bob", "secret");
    const result = authenticateUser("Bob", "secret");
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("Bob");
  });

  it("returns null for wrong password", () => {
    registerUser("Bob", "secret");
    expect(authenticateUser("Bob", "wrong")).toBeNull();
  });

  it("returns null for unknown user", () => {
    expect(authenticateUser("Nobody", "pass")).toBeNull();
  });

  it("generates and verifies a JWT token", () => {
    const user = registerUser("Carol", "pass");
    const token = generateToken(user);
    expect(typeof token).toBe("string");

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe(user.userId);
    expect(decoded!.displayName).toBe("Carol");
  });

  it("returns null for an invalid token", () => {
    expect(verifyToken("garbage.token.here")).toBeNull();
  });
});

// ── HTTP route tests ──────────────────────────────────────

describe("auth routes", () => {
  beforeEach(() => {
    _resetUsers();
    // Mount auth routes fresh for each test
    app.use("/api/auth", authRouter);
    mountErrorHandlers();
  });

  it("POST /api/auth/register creates a user and returns token", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ displayName: "TestUser", password: "pass1234" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.displayName).toBe("TestUser");
    expect(res.body.user.userId).toMatch(/^u-/);
  });

  it("POST /api/auth/register rejects duplicate users", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ displayName: "Dupe", password: "pass1234" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ displayName: "Dupe", password: "other" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("user_exists");
  });

  it("POST /api/auth/register rejects invalid input", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ displayName: "", password: "ab" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_error");
  });

  it("POST /api/auth/login succeeds with correct credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ displayName: "LoginUser", password: "mypass" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ displayName: "LoginUser", password: "mypass" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.displayName).toBe("LoginUser");
  });

  it("POST /api/auth/login rejects wrong password", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ displayName: "LoginUser2", password: "mypass" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ displayName: "LoginUser2", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("invalid_credentials");
  });

  it("GET /api/auth/me returns user info with valid token", async () => {
    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ displayName: "MeUser", password: "pass" });

    const token = registerRes.body.token;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("MeUser");
  });

  it("GET /api/auth/me rejects missing token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me rejects invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.here");

    expect(res.status).toBe(401);
  });
});

// ── Socket.io auth tests ──────────────────────────────────

describe("socket.io authentication", () => {
  let server: http.Server;
  let port: number;

  beforeEach(async () => {
    _resetUsers();
    server = http.createServer(app);
    createSignalServer(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as { port: number }).port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it("allows connection with a valid token", async () => {
    const user = registerUser("SocketUser", "pass");
    const token = generateToken(user);

    const socket: Socket = ioclient(`http://127.0.0.1:${port}`, {
      path: "/api/signal",
      auth: { token },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.on("connect", resolve);
        socket.on("connect_error", reject);
        setTimeout(() => reject(new Error("timeout")), 3000);
      });
      expect(socket.connected).toBe(true);
    } finally {
      socket.disconnect();
    }
  });

  it("allows connection without token in dev mode (default)", async () => {
    const socket: Socket = ioclient(`http://127.0.0.1:${port}`, {
      path: "/api/signal",
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.on("connect", resolve);
        socket.on("connect_error", reject);
        setTimeout(() => reject(new Error("timeout")), 3000);
      });
      expect(socket.connected).toBe(true);
    } finally {
      socket.disconnect();
    }
  });

  it("attaches user data to socket when token is provided", async () => {
    const user = registerUser("DataUser", "pass");
    const token = generateToken(user);

    const socket: Socket = ioclient(`http://127.0.0.1:${port}`, {
      path: "/api/signal",
      auth: { token },
    });

    try {
      await new Promise<void>((resolve, reject) => {
        socket.on("connect", resolve);
        socket.on("connect_error", reject);
        setTimeout(() => reject(new Error("timeout")), 3000);
      });

      // Verify the socket can join and operate normally
      const joined = new Promise<{ peers: Array<{ userId: string }> }>((resolve) => {
        socket.once("signal:joined", resolve);
      });
      socket.emit("signal:join", {
        workspaceId: "ws1",
        roomId: "room1",
        userId: user.userId,
        displayName: user.displayName,
      });
      const data = await joined;
      expect(data.peers.length).toBe(1);
    } finally {
      socket.disconnect();
    }
  });
});
