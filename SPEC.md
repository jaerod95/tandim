# Tandim — Product Spec

## Vision

Tandim recreates the Tandem virtual office experience: a desktop app that makes remote collaboration feel like sitting in the same room. It's always running, always showing who's around, and makes jumping into a conversation as easy as turning your chair.

## Core Concepts

### Workspace

A workspace is a shared space for a team. All rooms and presence live within a workspace. For now, a single hardcoded workspace is fine — multi-workspace support comes later.

### Rooms

Rooms are persistent, named spaces people can join. They appear in the sidebar and persist across sessions. A room can be empty (no one in it) or active (people talking).

Each room has:
- A name and optional emoji
- A list of current participants
- Audio/video/screen-share state per participant

### Presence

Every team member has a presence status:
- **Available** — Online and reachable
- **In a call** — Currently in a room (shows which room)
- **Idle** — App is running but user hasn't been active
- **Do Not Disturb** — Online but doesn't want to be interrupted
- **Offline** — App is not running

Presence is the backbone of the product. The lobby always shows the current state of every team member.

### Calls

Joining a room starts a call. Calls use WebRTC mesh connections for audio/video. Participants can:
- Toggle microphone on/off
- Toggle camera on/off
- Share their screen
- Enter crosstalk with specific people

### Crosstalk

Crosstalk is a side conversation within a room. While in a call, you can pull one or more people into a crosstalk. When in crosstalk:
- You hear crosstalk participants at full volume
- Everyone else in the room is quieted (but still audible at a reduced level)
- You can adjust the volume of outside conversations
- Crosstalk participants see a visual indicator that they're in a side conversation
- Ending crosstalk returns everyone to the normal room audio mix

This is a key differentiator from regular video call apps. It mimics the real-world experience of leaning over to whisper to someone during a meeting.

## User Flows

### App Launch
1. App starts → lobby window opens
2. Lobby shows: room list (sidebar), team member list (main area), room details (right panel)
3. User's presence is set to Available

### Joining a Room
1. User clicks a room in the sidebar
2. Right panel shows room details (who's in it, join options)
3. User clicks "Join" → call window opens
4. WebRTC connections established with all existing participants
5. User appears in the room's participant list for everyone

### Starting Crosstalk
1. User is in a call with multiple people
2. User initiates crosstalk with one or more specific participants
3. Audio routing changes: crosstalk partners at full volume, others at reduced volume
4. Visual indicator shows who is in the crosstalk
5. Volume slider controls how loud "outside" audio is (0% = muted, 100% = full)
6. Either party can end crosstalk → audio returns to normal

### Screen Sharing
1. User clicks screen share button in call window
2. System picker appears for screen/window selection
3. Screen share stream is sent to all room participants
4. Other participants see the shared screen in the call stage
5. User clicks stop → screen share ends for everyone

### Leaving a Room
1. User clicks leave/hang up in call window
2. WebRTC connections torn down
3. Call window closes
4. Lobby updates to show user has left the room
5. Other participants see peer-left event

## WebSocket Protocol

All real-time communication goes through Socket.io.

### Room Events
| Event | Direction | Purpose |
|-------|-----------|---------|
| `signal:join` | Client → Server | Join a room |
| `signal:joined` | Server → Client | Confirmation + existing peers |
| `signal:peer-joined` | Server → Clients | New peer entered room |
| `signal:peer-left` | Server → Clients | Peer left room |
| `signal:heartbeat` | Client → Server | Keep-alive (every 30s) |

### WebRTC Signaling
| Event | Direction | Purpose |
|-------|-----------|---------|
| `signal:offer` | Relayed | SDP offer from initiator |
| `signal:answer` | Relayed | SDP answer from responder |
| `signal:ice-candidate` | Relayed | ICE candidate exchange |

### Screen Sharing
| Event | Direction | Purpose |
|-------|-----------|---------|
| `signal:screen-share-start` | Client → Server | Start sharing |
| `signal:screen-share-started` | Server → Clients | Notify room |
| `signal:screen-share-stop` | Client → Server | Stop sharing |
| `signal:screen-share-stopped` | Server → Clients | Notify room |

### Crosstalk (to be implemented)
| Event | Direction | Purpose |
|-------|-----------|---------|
| `signal:crosstalk-start` | Client → Server | Initiate crosstalk with peer(s) |
| `signal:crosstalk-started` | Server → Clients | Notify crosstalk participants |
| `signal:crosstalk-end` | Client → Server | End crosstalk |
| `signal:crosstalk-ended` | Server → Clients | Notify crosstalk ended |
| `signal:crosstalk-volume` | Client only | Adjust outside volume (local) |

## Technical Constraints

- **Mesh topology**: Peer-to-peer WebRTC. Practical limit ~4-6 peers per room. Acceptable for our use case.
- **No SFU**: No media server. All audio/video flows directly between peers.
- **No persistence**: Room state is in-memory. Rooms exist while the server is running. Room *definitions* (name, emoji) should eventually be persisted.
- **No auth**: Currently unauthenticated. Must add before any non-local deployment.
- **Single server**: No horizontal scaling. One server instance handles all connections.

## Non-Goals (for now)

- Text chat in rooms
- Call recording
- File sharing
- Mobile apps
- Browser-based client
- Multi-workspace support
- User accounts and authentication
- End-to-end encryption
