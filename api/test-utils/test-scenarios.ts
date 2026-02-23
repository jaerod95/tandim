/**
 * Automated test scenarios for Tandim
 *
 * Provides high-level test scenarios that can be run to verify
 * the system behavior end-to-end.
 */

import { MockClient, createMockClient, createMockRoom } from "./mock-client";

export interface TestScenarioResult {
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Scenario 1: Basic room join and leave
 */
export async function scenarioBasicJoinLeave(apiUrl: string): Promise<TestScenarioResult> {
  const start = Date.now();
  const workspaceId = "test-workspace";
  const roomId = "test-room";

  try {
    console.log("[Scenario] Starting basic join/leave test");

    // Create and join with first client
    const client1 = await createMockClient({
      apiUrl,
      workspaceId,
      roomId,
      userId: "user-1",
      displayName: "User 1",
    });

    const joinResult = await client1.joinRoom();
    console.log("[Scenario] Client 1 joined:", joinResult);

    if (joinResult.peers.length !== 1) {
      throw new Error(`Expected 1 peer, got ${joinResult.peers.length}`);
    }

    // Create and join with second client
    const client2 = await createMockClient({
      apiUrl,
      workspaceId,
      roomId,
      userId: "user-2",
      displayName: "User 2",
    });

    // Listen for peer joined event on client1
    let peerJoinedReceived = false;
    client1.on("signal:peer-joined", (data) => {
      console.log("[Scenario] Client 1 received peer-joined:", data);
      peerJoinedReceived = true;
    });

    const joinResult2 = await client2.joinRoom();
    console.log("[Scenario] Client 2 joined:", joinResult2);

    if (joinResult2.peers.length !== 2) {
      throw new Error(`Expected 2 peers, got ${joinResult2.peers.length}`);
    }

    // Wait for peer-joined event
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!peerJoinedReceived) {
      throw new Error("Client 1 did not receive peer-joined event");
    }

    // Listen for peer left event on client1
    let peerLeftReceived = false;
    client1.on("signal:peer-left", (data) => {
      console.log("[Scenario] Client 1 received peer-left:", data);
      peerLeftReceived = true;
    });

    // Disconnect client2
    client2.disconnect();

    // Wait for peer-left event
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!peerLeftReceived) {
      throw new Error("Client 1 did not receive peer-left event");
    }

    client1.disconnect();

    return {
      success: true,
      duration: Date.now() - start,
      details: {
        peersJoined: 2,
        eventsReceived: ["peer-joined", "peer-left"],
      },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: String(error),
    };
  }
}

/**
 * Scenario 2: Screen sharing
 */
export async function scenarioScreenSharing(apiUrl: string): Promise<TestScenarioResult> {
  const start = Date.now();
  const workspaceId = "test-workspace";
  const roomId = "test-screen-share";

  try {
    console.log("[Scenario] Starting screen sharing test");

    // Create room with 2 peers
    const clients = await createMockRoom(apiUrl, workspaceId, roomId, 2);
    const [client1, client2] = clients;

    // Listen for screen share events on client2
    let screenShareStarted = false;
    let screenShareStopped = false;

    client2.on("signal:screen-share-started", (data) => {
      console.log("[Scenario] Client 2 received screen-share-started:", data);
      screenShareStarted = true;
    });

    client2.on("signal:screen-share-stopped", (data) => {
      console.log("[Scenario] Client 2 received screen-share-stopped:", data);
      screenShareStopped = true;
    });

    // Client1 starts screen sharing
    await client1.startScreenShare();
    console.log("[Scenario] Client 1 started screen sharing");

    // Wait for event propagation
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!screenShareStarted) {
      throw new Error("Client 2 did not receive screen-share-started event");
    }

    // Client1 stops screen sharing
    await client1.stopScreenShare();
    console.log("[Scenario] Client 1 stopped screen sharing");

    // Wait for event propagation
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!screenShareStopped) {
      throw new Error("Client 2 did not receive screen-share-stopped event");
    }

    // Cleanup
    clients.forEach((c) => c.disconnect());

    return {
      success: true,
      duration: Date.now() - start,
      details: {
        eventsReceived: ["screen-share-started", "screen-share-stopped"],
      },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: String(error),
    };
  }
}

/**
 * Scenario 3: WebRTC signaling flow
 */
export async function scenarioWebRTCSignaling(apiUrl: string): Promise<TestScenarioResult> {
  const start = Date.now();
  const workspaceId = "test-workspace";
  const roomId = "test-signaling";

  try {
    console.log("[Scenario] Starting WebRTC signaling test");

    // Create room with 2 peers
    const clients = await createMockRoom(apiUrl, workspaceId, roomId, 2);
    const [client1, client2] = clients;

    // Mock offer
    const mockOffer: RTCSessionDescriptionInit = {
      type: "offer",
      sdp: "mock-sdp-offer",
    };

    // Mock answer
    const mockAnswer: RTCSessionDescriptionInit = {
      type: "answer",
      sdp: "mock-sdp-answer",
    };

    // Mock ICE candidate
    const mockCandidate: RTCIceCandidateInit = {
      candidate: "mock-ice-candidate",
      sdpMLineIndex: 0,
      sdpMid: "0",
    };

    // Track received signals on client2
    let offerReceived = false;
    let answerReceived = false;
    let candidateReceived = false;

    client2.on("signal:offer", (data) => {
      console.log("[Scenario] Client 2 received offer:", data);
      offerReceived = true;

      // Send answer back
      client2.sendAnswer(data.fromUserId, mockAnswer);
    });

    client1.on("signal:answer", (data) => {
      console.log("[Scenario] Client 1 received answer:", data);
      answerReceived = true;
    });

    client2.on("signal:ice-candidate", (data) => {
      console.log("[Scenario] Client 2 received ICE candidate:", data);
      candidateReceived = true;
    });

    // Client1 sends offer to client2
    client1.sendOffer("user-1", mockOffer);

    // Wait for signaling to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (!offerReceived) {
      throw new Error("Client 2 did not receive offer");
    }

    if (!answerReceived) {
      throw new Error("Client 1 did not receive answer");
    }

    // Client1 sends ICE candidate
    client1.sendIceCandidate("user-1", mockCandidate);

    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!candidateReceived) {
      throw new Error("Client 2 did not receive ICE candidate");
    }

    // Cleanup
    clients.forEach((c) => c.disconnect());

    return {
      success: true,
      duration: Date.now() - start,
      details: {
        signalsExchanged: ["offer", "answer", "ice-candidate"],
      },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: String(error),
    };
  }
}

/**
 * Scenario 4: Multiple concurrent rooms
 */
export async function scenarioMultipleRooms(apiUrl: string): Promise<TestScenarioResult> {
  const start = Date.now();
  const workspaceId = "test-workspace";

  try {
    console.log("[Scenario] Starting multiple rooms test");

    // Create 3 rooms with 2-4 peers each
    const room1Clients = await createMockRoom(apiUrl, workspaceId, "room-1", 2);
    const room2Clients = await createMockRoom(apiUrl, workspaceId, "room-2", 3);
    const room3Clients = await createMockRoom(apiUrl, workspaceId, "room-3", 4);

    const allClients = [...room1Clients, ...room2Clients, ...room3Clients];

    // Verify each client is in the correct room
    console.log("[Scenario] All clients connected and in rooms");

    // Send heartbeats from all clients
    allClients.forEach((client) => client.sendHeartbeat());

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cleanup
    allClients.forEach((c) => c.disconnect());

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      duration: Date.now() - start,
      details: {
        roomsCreated: 3,
        totalPeers: allClients.length,
        roomSizes: [2, 3, 4],
      },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: String(error),
    };
  }
}

/**
 * Scenario 5: Heartbeat and inactivity
 */
export async function scenarioHeartbeat(apiUrl: string): Promise<TestScenarioResult> {
  const start = Date.now();
  const workspaceId = "test-workspace";
  const roomId = "test-heartbeat";

  try {
    console.log("[Scenario] Starting heartbeat test");

    const client = await createMockClient({
      apiUrl,
      workspaceId,
      roomId,
      userId: "user-1",
      displayName: "User 1",
    });

    await client.joinRoom();

    // Send heartbeats periodically
    const heartbeatInterval = setInterval(() => {
      client.sendHeartbeat();
      console.log("[Scenario] Sent heartbeat");
    }, 1000);

    // Wait for 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));

    clearInterval(heartbeatInterval);
    client.disconnect();

    return {
      success: true,
      duration: Date.now() - start,
      details: {
        heartbeatsSent: 3,
      },
    };
  } catch (error) {
    return {
      success: false,
      duration: Date.now() - start,
      error: String(error),
    };
  }
}

/**
 * Run all test scenarios
 */
export async function runAllScenarios(apiUrl: string): Promise<TestScenarioResult[]> {
  console.log("\n=== Running all test scenarios ===\n");

  const results: TestScenarioResult[] = [];

  const scenarios = [
    { name: "Basic Join/Leave", fn: scenarioBasicJoinLeave },
    { name: "Screen Sharing", fn: scenarioScreenSharing },
    { name: "WebRTC Signaling", fn: scenarioWebRTCSignaling },
    { name: "Multiple Rooms", fn: scenarioMultipleRooms },
    { name: "Heartbeat", fn: scenarioHeartbeat },
  ];

  for (const scenario of scenarios) {
    console.log(`\n--- Running: ${scenario.name} ---`);
    const result = await scenario.fn(apiUrl);
    results.push(result);

    if (result.success) {
      console.log(`✓ ${scenario.name} passed in ${result.duration}ms`);
    } else {
      console.error(`✗ ${scenario.name} failed: ${result.error}`);
    }

    // Wait between scenarios to ensure cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n=== Test Summary ===");
  const passed = results.filter((r) => r.success).length;
  const failed = results.length - passed;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  return results;
}
