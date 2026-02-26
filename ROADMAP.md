# Tandim — Roadmap

## Current State

End-to-end MVP complete:
- API server with debug routes (factory pattern), heartbeat pruning, `/api/rooms` polling endpoints
- Electron main process with IPC handlers for multi-window (lobby + call windows), deep link support
- Lobby UI with room list (emoji + occupancy badges), team members, room detail panel with join flow
- WebRTC engine: `PeerConnectionManager` (per-peer) + `CallEngine` (orchestrator) + `useCallEngine` hook
- Call window with video grid, mic/camera/screen share controls, leave button
- Screen sharing with focused layout (large screen share view + camera tile strip)
- Socket.io reconnection handling, `beforeunload` cleanup
- Debug/introspection infrastructure (HTTP endpoints, CLI tool, MCP server)
- Test suite (unit + E2E scenarios, 15 tests passing)

## Phase 1: Stability & Polish

Focus: Make what exists reliable and polished.

- [ ] Audit and fix WebRTC connection edge cases (ICE failures, renegotiation, reconnection)
- [ ] Polish screen sharing (viewer controls, handle multi-monitor)
- [x] Clean disconnect handling (graceful leave vs. crash/network drop) — beforeunload + socket reconnection
- [ ] Reliable presence states (available, in call, idle, DND, offline) — **in progress**
- [ ] Audio device selection and switching mid-call
- [ ] Video device selection and switching mid-call
- [ ] Proper error states in UI (connection failed, server unreachable, etc.) — **in progress**
- [ ] App tray icon with presence indicator
- [x] Keyboard shortcuts (mute toggle, camera toggle, leave call) — **in progress**

## Phase 2: Crosstalk

Focus: Implement the core differentiating feature.

- [ ] Server-side crosstalk state management (who's in crosstalk with whom) — **in progress**
- [ ] Socket events for crosstalk lifecycle (start, join, end) — **in progress**
- [ ] Client-side audio routing (Web Audio API gain nodes per peer)
- [ ] Crosstalk volume slider for outside conversations
- [ ] Visual indicators in call UI (who's in crosstalk, who's outside)
- [ ] Crosstalk invitation flow (pull someone in, they can accept/decline)
- [ ] Multiple concurrent crosstalks in the same room

## Phase 3: Feature Parity with Tandem

Focus: Close the gap with Tandem's core features.

- [ ] Persistent room definitions (name, emoji, order — stored on server)
- [ ] Room creation/editing/deletion from the UI
- [ ] User profiles (display name, avatar)
- [ ] Idle detection (OS-level activity monitoring)
- [ ] Do Not Disturb mode
- [ ] Quick talk / tap-to-call on a specific person
- [ ] Notification sounds (peer joined, someone talking to you)
- [ ] Auto-join last room on app launch (optional)
- [ ] Deep link improvements (workspace + room routing)

## Phase 4: Deployment & Distribution

Focus: Get it running for the team.

- [ ] Authentication (JWT or session-based)
- [ ] Deploy API server to cloud (Fly.io, Railway, or similar)
- [ ] HTTPS + WSS for production signaling
- [ ] TURN server setup for peers behind restrictive NATs
- [ ] Electron auto-update (electron-updater + GitHub releases)
- [ ] macOS code signing and notarization
- [ ] Linux packaging (.deb, .AppImage)

## Future Ideas

Things to consider after the core is solid:

- Text chat in rooms
- Call recording
- SFU mode for larger rooms (>6 peers)
- Slack integration (presence sync, room links)
- Analytics and usage metrics
- End-to-end encryption
- Mobile companion app
