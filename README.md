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

## Features

- **Always-on presence** — See who's online, idle, or in a call
- **Instant voice/video** — Click to join a room, no meeting links
- **Screen sharing** — Share your screen with room participants
- **Crosstalk** — Pull someone into a side conversation without leaving the room; adjust the volume of outside conversations
- **Deep linking** — Join rooms via `tandim://` URLs
- **Multi-window** — Lobby stays open while calls run in separate windows

## Testing

```bash
# API unit tests
cd api && pnpm test

# Signal server E2E scenarios
cd api && pnpm test:scenarios

# App unit tests
cd app && pnpm test

# App E2E tests
cd app && pnpm test:e2e
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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 40, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn, Radix UI |
| Build | Electron Forge, Vite |
| Server | Express, Socket.io, Zod |
| Media | WebRTC (mesh topology) |
| Testing | Vitest |

## License

MIT
