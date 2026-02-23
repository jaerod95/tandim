# Testing with Multiple Users

## The Problem

Electron apps typically only allow one instance to run at a time. To test multiple users in a call, you have several options:

## Option 1: Use Package App (Recommended)

Package the app first, then you can open it multiple times:

```bash
cd app
pnpm run package

# Open first instance
open out/tandim-darwin-arm64/tandim.app

# Open second instance (from Finder or another terminal)
open -n out/tandim-darwin-arm64/tandim.app
```

The `-n` flag opens a new instance even if one is already running.

## Option 2: Use Mock Client from Terminal

Test the call functionality using a mock client:

```bash
cd api

# Create a test file
cat > test-join.ts << 'EOF'
import { createMockClient } from './test-utils/mock-client';

async function main() {
  const client = await createMockClient({
    apiUrl: 'http://localhost:3000',
    workspaceId: 'team-local',
    roomId: 'Team Standup',
    userId: 'test-user-' + Date.now(),
    displayName: 'Test User',
  });

  console.log('Connected with socket:', client.getSocketId());

  await client.joinRoom();
  console.log('Joined room!');

  // Keep connection alive
  setInterval(() => {
    client.sendHeartbeat();
    console.log('Sent heartbeat');
  }, 10000);

  console.log('Mock client running. Press Ctrl+C to exit.');
}

main().catch(console.error);
EOF

# Run it
tsx test-join.ts
```

Now in the Electron app:
1. Join the same room ("Team Standup")
2. You should see the mock client as a peer
3. The WebRTC connection will establish

## Option 3: Use Different User Profiles

Run Electron with different user data directories:

```bash
# Terminal 1: First instance
cd app
pnpm start

# Terminal 2: Second instance with different user data
cd app
ELECTRON_USER_DATA=$(mktemp -d) pnpm start
```

This might not work perfectly but worth trying.

## Option 4: Use Browser (Easiest for Quick Tests)

While the app is running in Electron, you can also connect from a web browser by creating a simple HTML file:

```bash
cd app
cat > test-client.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Tandim Test Client</title>
  <style>
    body {
      font-family: sans-serif;
      background: #1a1a1a;
      color: #e8e8e8;
      padding: 20px;
    }
    video {
      width: 320px;
      background: #000;
      border: 1px solid #333;
    }
    button {
      margin: 10px;
      padding: 10px 20px;
      background: #5865f2;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #4752c4;
    }
    .status {
      margin: 10px 0;
      padding: 10px;
      background: #2a2a2a;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <h1>Tandim Test Client</h1>
  <div class="status" id="status">Not connected</div>

  <div>
    <label>Display Name: <input id="displayName" value="Test User" /></label>
    <label>Room: <input id="room" value="Team Standup" /></label>
    <button onclick="join()">Join Room</button>
    <button onclick="toggleMic()">Toggle Mic</button>
    <button onclick="toggleCamera()">Toggle Camera</button>
  </div>

  <div>
    <h3>Local Video</h3>
    <video id="localVideo" autoplay muted playsinline></video>
  </div>

  <div id="remoteVideos">
    <h3>Remote Videos</h3>
  </div>

  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
  <script>
    const API_URL = 'http://localhost:3000';
    let socket = null;
    let localStream = null;
    let peerConnections = new Map();
    let micEnabled = true;
    let cameraEnabled = false;

    async function join() {
      const displayName = document.getElementById('displayName').value;
      const roomId = document.getElementById('room').value;
      const userId = 'browser-' + Math.random().toString(36).slice(2, 8);

      updateStatus('Connecting...');

      // Get media
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      document.getElementById('localVideo').srcObject = localStream;

      // Connect to signal server
      socket = io(API_URL, {
        path: '/api/signal',
        transports: ['websocket']
      });

      socket.on('connect', () => {
        updateStatus('Connected, joining room...');
        socket.emit('signal:join', {
          workspaceId: 'team-local',
          roomId,
          userId,
          displayName
        });
      });

      socket.on('signal:joined', async (data) => {
        updateStatus(`Joined room with ${data.peers.length} peers`);
        console.log('Joined room:', data);

        // Create peer connections for existing peers
        for (const peer of data.peers) {
          if (peer.userId !== userId) {
            await createPeerConnection(peer.userId, peer.displayName, false);
          }
        }
      });

      socket.on('signal:peer-joined', async (peer) => {
        updateStatus(`${peer.displayName} joined`);
        await createPeerConnection(peer.userId, peer.displayName, true);
      });

      socket.on('signal:offer', async (data) => {
        const pc = await createPeerConnection(data.fromUserId, 'Peer', false);
        await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal:answer', {
          workspaceId: 'team-local',
          roomId,
          toUserId: data.fromUserId,
          payload: answer
        });
      });

      socket.on('signal:answer', async (data) => {
        const pc = peerConnections.get(data.fromUserId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
        }
      });

      socket.on('signal:ice-candidate', async (data) => {
        const pc = peerConnections.get(data.fromUserId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.payload));
        }
      });

      socket.on('signal:peer-left', (data) => {
        updateStatus(`Peer left: ${data.userId}`);
        const pc = peerConnections.get(data.userId);
        if (pc) {
          pc.close();
          peerConnections.delete(data.userId);
        }
        const videoEl = document.getElementById('video-' + data.userId);
        if (videoEl) videoEl.remove();
      });
    }

    async function createPeerConnection(userId, displayName, createOffer) {
      const iceResponse = await fetch(API_URL + '/api/ice-config');
      const iceConfig = await iceResponse.json();

      const pc = new RTCPeerConnection(iceConfig);
      peerConnections.set(userId, pc);

      // Add local tracks
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('Received remote track from', userId);
        let videoEl = document.getElementById('video-' + userId);
        if (!videoEl) {
          videoEl = document.createElement('video');
          videoEl.id = 'video-' + userId;
          videoEl.autoplay = true;
          videoEl.playsInline = true;

          const container = document.createElement('div');
          const label = document.createElement('h4');
          label.textContent = displayName;
          container.appendChild(label);
          container.appendChild(videoEl);

          document.getElementById('remoteVideos').appendChild(container);
        }
        videoEl.srcObject = event.streams[0];
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('signal:ice-candidate', {
            workspaceId: 'team-local',
            roomId: document.getElementById('room').value,
            toUserId: userId,
            payload: event.candidate.toJSON()
          });
        }
      };

      // Create offer if needed
      if (createOffer) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal:offer', {
          workspaceId: 'team-local',
          roomId: document.getElementById('room').value,
          toUserId: userId,
          payload: offer
        });
      }

      return pc;
    }

    function toggleMic() {
      if (!localStream) return;
      micEnabled = !micEnabled;
      for (const track of localStream.getAudioTracks()) {
        track.enabled = micEnabled;
      }
      updateStatus(micEnabled ? 'Mic enabled' : 'Mic muted');
    }

    async function toggleCamera() {
      if (!localStream) return;

      if (cameraEnabled) {
        for (const track of localStream.getVideoTracks()) {
          track.stop();
          localStream.removeTrack(track);
        }
        cameraEnabled = false;
        updateStatus('Camera off');
      } else {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = videoStream.getVideoTracks()[0];
        localStream.addTrack(track);
        document.getElementById('localVideo').srcObject = localStream;
        cameraEnabled = true;
        updateStatus('Camera on');

        // Renegotiate with all peers
        for (const [userId, pc] of peerConnections) {
          pc.close();
          peerConnections.delete(userId);
          await createPeerConnection(userId, 'Peer', true);
        }
      }
    }

    function updateStatus(msg) {
      document.getElementById('status').textContent = msg;
      console.log('[Status]', msg);
    }
  </script>
</body>
</html>
EOF

# Open in browser
open test-client.html
```

Now:
1. Open the Electron app and join "Team Standup"
2. Open the HTML file in Chrome/Safari
3. Click "Join Room" in the browser
4. You should see each other!

## Current Status Check

Let me check what's connected right now:

```bash
# See active connections
curl http://localhost:3000/api/debug/stats

# See active rooms
curl http://localhost:3000/api/debug/rooms

# See sockets
curl http://localhost:3000/api/debug/sockets
```

## Troubleshooting

### Can't see other user
1. Check both joined the SAME room name (case-sensitive)
2. Check console for WebRTC errors
3. Verify sockets connected: `curl http://localhost:3000/api/debug/sockets`

### Can't hear audio
1. Check browser/OS audio permissions
2. Check the Mute button isn't active (should NOT be red)
3. Check your system volume

### Can't see video
1. Check camera permissions in System Settings
2. Enable camera in the call (click Camera button)
3. Video should appear in the grid

## Quick Test Script

```bash
#!/bin/bash
# test-multi-user.sh

echo "🧪 Testing Multi-User Tandim Call"
echo ""
echo "Step 1: Starting mock client..."

cd api
tsx -e "
import { createMockClient } from './test-utils/mock-client';

(async () => {
  const client = await createMockClient({
    apiUrl: 'http://localhost:3000',
    workspaceId: 'team-local',
    roomId: 'Team Standup',
    userId: 'mock-' + Date.now(),
    displayName: 'Mock User',
  });

  await client.joinRoom();
  console.log('✅ Mock client joined!');
  console.log('Now join from Electron app to see the connection.');

  setInterval(() => client.sendHeartbeat(), 10000);
})();
" &

echo ""
echo "✅ Mock client running in background"
echo "Now open the Electron app and join 'Team Standup'"
echo "You should see 'Mock User' as a peer!"
echo ""
echo "Press Ctrl+C to stop the mock client"
wait
```

Save this as `test-multi-user.sh`, make it executable, and run it!

## Expected Behavior

When two users join the same room:
1. Both should see each other's names in the peer list
2. WebRTC connections establish (check console for "Connected" or ICE candidate messages)
3. If camera is enabled, both see each other's video
4. Audio works automatically
5. Screen sharing shows for all participants

The camera issue should now be fixed - you'll see your own video in the call when you turn the camera on!
