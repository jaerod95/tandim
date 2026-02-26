# Tandim — Roadmap

## Current State

End-to-end MVP complete with Phase 1 stability work and Phase 2 server foundation:

- API server with debug routes (factory pattern), heartbeat pruning, `/api/rooms` polling endpoints
- Electron main process with IPC handlers for multi-window (lobby + call windows), deep link support
- Lobby UI with room list (emoji + occupancy badges), team members, room detail panel with join flow
- WebRTC engine: `PeerConnectionManager` (per-peer) + `CallEngine` (orchestrator) + `useCallEngine` hook
- Call window with video grid, mic/camera/screen share controls, leave button
- Screen sharing with focused layout, fullscreen toggle, fit/fill toggle, hover controls
- Socket.io reconnection handling, `beforeunload` cleanup
- WebRTC edge case handling: ICE restart (max 2 retries), perfect negotiation, connection monitoring
- Presence system: server-side PresenceStore, lobby socket integration, idle detection
- Audio/video device selection and mid-call switching via replaceTrack()
- App tray icon with status-based SVG icons, macOS close-to-tray
- Keyboard shortcuts (Cmd+D mute, Cmd+E camera, Cmd+Shift+S screen share, Cmd+Shift+H leave)
- Error states in UI (server unreachable banner, join error toast, colored status indicators)
- Crosstalk server foundation: state management, socket events, auto-cleanup on peer leave (18 tests)
- Debug/introspection infrastructure (HTTP endpoints, CLI tool, MCP server)
- Test suite (unit + E2E scenarios)

## Phase 1: Stability & Polish

Focus: Make what exists reliable and polished.

- [x] Audit and fix WebRTC connection edge cases (ICE restart, perfect negotiation, connection monitoring)
- [x] Polish screen sharing (fullscreen toggle, fit/fill, hover controls, better getDisplayMedia constraints)
- [x] Clean disconnect handling (graceful leave vs. crash/network drop) — beforeunload + socket reconnection
- [x] Reliable presence states (available, in call, idle, DND, offline) — server + client + idle detection
- [x] Audio device selection and switching mid-call (replaceTrack + device menu)
- [x] Video device selection and switching mid-call (replaceTrack + device menu)
- [x] Proper error states in UI (server unreachable banner, join error toast, colored status indicators)
- [x] App tray icon with presence indicator (programmatic SVG icons, macOS close-to-tray)
- [x] Keyboard shortcuts (mute toggle, camera toggle, screen share, leave call)

## Phase 2: Crosstalk

Focus: Implement the core differentiating feature.

- [x] Server-side crosstalk state management (who's in crosstalk with whom) — RoomStateStore + auto-cleanup
- [x] Socket events for crosstalk lifecycle (start, end) — Zod-validated, with tests
- [ ] Client-side audio routing (Web Audio API gain nodes per peer)
- [ ] Crosstalk volume slider for outside conversations
- [ ] Visual indicators in call UI (who's in crosstalk, who's outside)
- [ ] Crosstalk invitation flow (pull someone in, they can accept/decline)
- [ ] Multiple concurrent crosstalks in the same room

## Phase 3: Getting it ready to distribute to friends

Focus: Close the gap with Tandem's core features.

- [ ] User profiles (display name, avatar, settings)
- [ ] Authentication (JWT or session-based)
- [ ] Persistent room definitions (name, emoji, order — stored on server)
- [ ] Room creation/editing/deletion from the UI
- [ ] Idle detection (OS-level activity monitoring)
- [ ] Quick talk / tap-to-call on a specific person
- [ ] Notification sounds (peer joined, someone talking to you)
- [ ] Deep link improvements (workspace + room routing)
- [ ] Make a custom logo for the app and update the electron app icons
- [ ] Add some basic branding to make it feel like an app

## Phase 5: Deployment & Distribution

Focus: Get it running for the team.

- [ ] Do Not Disturb mode
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
