/**
 * Mock client for testing the Tandim API
 *
 * Provides a programmatic interface to simulate client connections,
 * join rooms, and test WebRTC signaling flows.
 */

import { io, Socket } from "socket.io-client";

export interface MockClientConfig {
  apiUrl: string;
  workspaceId: string;
  roomId: string;
  userId: string;
  displayName: string;
}

export interface SignalMessage {
  workspaceId: string;
  roomId: string;
  fromUserId?: string;
  toUserId?: string;
  payload: any;
}

export class MockClient {
  private socket: Socket | null = null;
  private config: MockClientConfig;
  private events: Map<string, any[]> = new Map();

  constructor(config: MockClientConfig) {
    this.config = config;
  }

  /**
   * Connect to the signal server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.apiUrl);
      this.socket = io(`${url.protocol}//${url.host}`, {
        path: "/api/signal",
        transports: ["websocket"],
      });

      this.socket.on("connect", () => {
        console.log(`[MockClient ${this.config.userId}] Connected with socket ${this.socket?.id}`);
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error(`[MockClient ${this.config.userId}] Connection error:`, error);
        reject(error);
      });

      // Track all events for debugging
      this.socket.onAny((eventName, ...args) => {
        console.log(`[MockClient ${this.config.userId}] Received event: ${eventName}`, args);
        if (!this.events.has(eventName)) {
          this.events.set(eventName, []);
        }
        this.events.get(eventName)!.push(args);
      });

      setTimeout(() => reject(new Error("Connection timeout")), 5000);
    });
  }

  /**
   * Join a room
   */
  async joinRoom(): Promise<any> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Join room timeout"));
      }, 5000);

      this.socket!.once("signal:joined", (data) => {
        clearTimeout(timeout);
        console.log(`[MockClient ${this.config.userId}] Joined room:`, data);
        resolve(data);
      });

      this.socket!.once("signal:error", (error) => {
        clearTimeout(timeout);
        console.error(`[MockClient ${this.config.userId}] Join error:`, error);
        reject(error);
      });

      this.socket!.emit("signal:join", {
        workspaceId: this.config.workspaceId,
        roomId: this.config.roomId,
        userId: this.config.userId,
        displayName: this.config.displayName,
      });
    });
  }

  /**
   * Send a heartbeat
   */
  sendHeartbeat(): void {
    if (!this.socket) {
      throw new Error("Not connected");
    }
    this.socket.emit("signal:heartbeat");
  }

  /**
   * Send an offer to another peer
   */
  sendOffer(toUserId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    this.socket.emit("signal:offer", {
      workspaceId: this.config.workspaceId,
      roomId: this.config.roomId,
      toUserId,
      payload: offer,
    });
  }

  /**
   * Send an answer to another peer
   */
  sendAnswer(toUserId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    this.socket.emit("signal:answer", {
      workspaceId: this.config.workspaceId,
      roomId: this.config.roomId,
      toUserId,
      payload: answer,
    });
  }

  /**
   * Send an ICE candidate to another peer
   */
  sendIceCandidate(toUserId: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    this.socket.emit("signal:ice-candidate", {
      workspaceId: this.config.workspaceId,
      roomId: this.config.roomId,
      toUserId,
      payload: candidate,
    });
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<void> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Screen share start timeout"));
      }, 5000);

      this.socket!.once("signal:screen-share-started", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once("signal:error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.socket!.emit("signal:screen-share-start");
    });
  }

  /**
   * Stop screen sharing
   */
  async stopScreenShare(): Promise<void> {
    if (!this.socket) {
      throw new Error("Not connected");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Screen share stop timeout"));
      }, 5000);

      this.socket!.once("signal:screen-share-stopped", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once("signal:error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.socket!.emit("signal:screen-share-stop");
    });
  }

  /**
   * Listen for a specific event
   */
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.socket) {
      throw new Error("Not connected");
    }
    this.socket.on(event, handler);
  }

  /**
   * Get all events received
   */
  getEvents(eventName?: string): any[] {
    if (eventName) {
      return this.events.get(eventName) || [];
    }
    return Array.from(this.events.entries());
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events.clear();
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Get the socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

/**
 * Helper to create and connect a mock client
 */
export async function createMockClient(config: MockClientConfig): Promise<MockClient> {
  const client = new MockClient(config);
  await client.connect();
  return client;
}

/**
 * Helper to create a room with multiple peers
 */
export async function createMockRoom(
  apiUrl: string,
  workspaceId: string,
  roomId: string,
  userCount: number
): Promise<MockClient[]> {
  const clients: MockClient[] = [];

  for (let i = 0; i < userCount; i++) {
    const client = await createMockClient({
      apiUrl,
      workspaceId,
      roomId,
      userId: `user-${i}`,
      displayName: `User ${i}`,
    });

    await client.joinRoom();
    clients.push(client);

    // Small delay to ensure proper ordering
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return clients;
}
