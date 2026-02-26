# Tandim

A virtual office for remote teams. Clone of [Tandem](https://tandem.chat).

See who's around, jump into voice/video with one click, share your screen, and pull people into side conversations with crosstalk — all without the friction of scheduling a meeting.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the signal server
cd api && pnpm dev

# Start the desktop app (separate terminal)
cd app && pnpm start
```

The API server runs on `http://localhost:3000`. The Electron app launches automatically.

## Architecture

```
tandim/
├── api/          Signal server (Express + Socket.io)
├── app/          Desktop app (Electron + React + Vite)
└── slack-app/    Slack integration (optional)
```

- **Signaling**: Socket.io handles room management, presence, and WebRTC signaling relay.
- **Media**: WebRTC mesh connections between peers (peer-to-peer, no server in the media path).
- **UI**: React with Tailwind CSS and shadcn components. Multi-window — lobby and call windows are separate.
- **Auth**: JWT-based authentication with bcrypt password hashing. Optional for Socket.io connections (controlled via `REQUIRE_SOCKET_AUTH` env var).

## Features

- **Always-on presence** — See who's online, idle, in a call, or in Do Not Disturb mode
- **Instant voice/video** — Click to join a room, no meeting links needed
- **Screen sharing** — Share your screen with room participants
- **Crosstalk** — Pull someone into a side conversation without leaving the room; invite others to join
- **Quick talk** — Tap-to-call a specific person for a 1-on-1 conversation
- **Room management** — Create, edit, delete, and reorder rooms from the UI (persisted on server)
- **User profiles** — Display name, notification preferences, and settings
- **Authentication** — Register/login with JWT tokens, sign-out from the lobby header
- **Deep linking** — Join rooms via `tandim://join/<room>`, view via `tandim://room/<room>`, workspace routing
- **Auto-update** — Checks for updates via GitHub releases, download and install from the app
- **Notification sounds** — Audio cues for peer joins and leaves
- **Do Not Disturb** — Toggle DND via header button or `Cmd+Shift+D`; blocks quick talk requests
- **Keyboard shortcuts** — `Cmd+D` mute, `Cmd+E` camera, `Cmd+Shift+S` screen share, `Cmd+Shift+H` leave
- **Multi-window** — Lobby stays open while calls run in separate windows
- **macOS integration** — Tray icon with status, dock icon, close-to-tray, code signing and notarization

## Testing

```bash
cd api && pnpm test              # API unit + integration tests (121 tests)
cd api && pnpm test:scenarios    # Signal server E2E scenarios
cd app && pnpm test              # App unit tests (28 tests)
cd app && pnpm test:e2e          # App E2E tests
```

## Debugging

The API server exposes debug endpoints when running:

```bash
curl http://localhost:3000/api/debug/health    # Health check
curl http://localhost:3000/api/debug/stats      # Server statistics
curl http://localhost:3000/api/debug/rooms      # Active rooms
curl http://localhost:3000/api/debug/sockets    # Connected sockets
```

CLI inspection:

```bash
cd api && pnpm inspect stats
cd api && pnpm inspect rooms
cd api && pnpm inspect sockets
```

## Building & Distribution

```bash
cd app && pnpm make       # Build distributable (ad-hoc signed on macOS)
cd app && pnpm publish    # Publish to GitHub releases (needs GITHUB_TOKEN)
```

For notarized distribution builds, set `APPLE_IDENTITY`, `APPLE_ID`, `APPLE_ID_PASSWORD`, and `APPLE_TEAM_ID` environment variables before running `pnpm make`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 40, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn, Radix UI |
| Build | Electron Forge, Vite |
| Server | Express, Socket.io, Zod |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Media | WebRTC (mesh topology) |
| Testing | Vitest |

## License

MIT
