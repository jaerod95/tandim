# Tandim — Roadmap

## Current State

Working prototype with:
- Lobby UI with room list, team members, room details panel
- Voice/video calls via WebRTC mesh
- Screen sharing
- Heartbeat-based presence
- Debug/introspection infrastructure (HTTP endpoints, CLI tool, MCP server)
- Test suite (unit + E2E scenarios)

## Phase 1: Stability & Polish

Focus: Make what exists reliable and polished.

- [ ] Audit and fix WebRTC connection edge cases (ICE failures, renegotiation, reconnection)
- [ ] Polish screen sharing (viewer controls, proper aspect ratio, handle multi-monitor)
- [ ] Reliable presence states (available, in call, idle, DND, offline)
- [ ] Clean disconnect handling (graceful leave vs. crash/network drop)
- [ ] Audio device selection and switching mid-call
- [ ] Video device selection and switching mid-call
- [ ] Proper error states in UI (connection failed, server unreachable, etc.)
- [ ] App tray icon with presence indicator
- [ ] Keyboard shortcuts (mute toggle, camera toggle, leave call)

## Phase 2: Crosstalk

Focus: Implement the core differentiating feature.

- [ ] Server-side crosstalk state management (who's in crosstalk with whom)
- [ ] Socket events for crosstalk lifecycle (start, join, end)
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
