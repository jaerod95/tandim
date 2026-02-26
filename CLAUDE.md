# Tandim — Agent Rules

## Project Overview

Tandim is a faithful clone of [Tandem](https://tandem.chat), the virtual office for remote teams. It's a desktop app (Electron + React) backed by a WebRTC signaling server (Express + Socket.io). The goal is to replicate Tandem's core experience: always-on presence, instant voice/video, screen sharing, and crosstalk.

Target audience: personal use and a small team of collaborators. Not aiming for broad adoption.

See `SPEC.md` for the full product spec and `ROADMAP.md` for priorities.

## Architecture

Monorepo with pnpm workspaces:

- `api/` — Express + Socket.io signal server (port 3000). Manages room state, relays WebRTC signaling, handles heartbeats.
- `app/` — Electron desktop app. React renderer with Tailwind + shadcn. WebRTC mesh connections. Multi-window (lobby + call windows).
- `slack-app/` — Slack integration (optional, not actively developed).

Key architectural decisions:
- **WebRTC mesh** for calls (scales to ~4-6 peers per room, fine for our use case)
- **Socket.io** for signaling and presence (not WebRTC data channels)
- **Electron Forge + Vite** for app build pipeline
- **No auth** currently — add before any public deployment

## Development

```bash
pnpm install          # Install all dependencies
cd api && pnpm dev    # Start signal server (port 3000)
cd app && pnpm start  # Start Electron app (separate terminal)
```

### Testing

```bash
cd api && pnpm test              # API unit tests
cd api && pnpm test:scenarios    # E2E signal server scenarios
cd app && pnpm test              # App unit tests
cd app && pnpm test:e2e          # App E2E tests
```

### Debugging

```bash
curl http://localhost:3000/api/debug/stats     # Server stats
curl http://localhost:3000/api/debug/rooms      # Active rooms
curl http://localhost:3000/api/debug/sockets    # Connected sockets
cd api && pnpm inspect stats                    # CLI inspection
```

## Agent Rules

### Commits

- Commit and merge freely — no PRs needed for this project.
- Write clear, concise commit messages that explain the "why".
- Merge feature branches directly into main when work is complete.

### Code Style

- TypeScript strict mode in both packages.
- Clean architecture: clear separation of concerns, well-defined interfaces.
- Keep files focused — one responsibility per file.
- Use Zod for runtime validation at system boundaries (socket events, API inputs).
- Use CSS modules or Tailwind utility classes — no inline style objects.
- shadcn/Radix for UI primitives in the app.

### Patterns to Follow

- **Socket events**: Define schema with Zod, validate on receipt, emit typed payloads. See `api/services/signalServer.ts`.
- **Room state**: All mutations go through `RoomStateStore`. Never manipulate room data directly.
- **React components**: Functional components with hooks. Use context for shared call state (`CallContext`). Keep components small.
- **WebRTC**: All connection management in `app/src/webrtc/`. The mesh state machine handles peer lifecycle.
- **IPC**: Define channels in preload, expose via contextBridge. Never use `remote`.

### Patterns to Avoid

- Don't add dependencies without good reason. The stack is intentionally lean.
- Don't over-abstract. Three similar lines > premature abstraction.
- Don't add error handling for impossible states. Trust internal code, validate at boundaries.
- Don't create wrapper utilities for things the framework already handles.
- Don't add comments that restate what the code does. Only comment *why*.

### Testing Expectations

- New socket events need a test in `api/tests/`.
- New API routes need a test in `api/tests/`.
- Use the mock client library (`api/test-utils/mock-client.ts`) for integration tests.
- UI components don't require unit tests unless they contain non-trivial logic.

### File Organization

```
api/
  bin/           → Server entrypoints (www.ts, mcp.ts)
  routes/        → HTTP route handlers
  services/      → Business logic (room state, signaling, config)
  tests/         → Unit/integration tests
  test-utils/    → Mock clients, test scenarios
  scripts/       → CLI tools (inspect, test runner)

app/src/
  main.ts        → Electron main process
  preload.ts     → Context bridge
  renderer/      → React components (Lobby/, Call*)
  webrtc/        → WebRTC mesh management
  components/ui/ → shadcn primitives
  hooks/         → Custom React hooks
  lib/           → Utilities
  styles/        → Global CSS
```
