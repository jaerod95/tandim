# Tandim - Quick Start Guide

## ⚡ 2-Minute Setup

### Start Both Services

```bash
# Terminal 1: API
cd api && pnpm dev

# Terminal 2: App
cd app && pnpm start
```

That's it! The app should open automatically.

## 🎯 What to Try First

### 1. Basic Navigation (30 seconds)
- Click different rooms in the left sidebar
- Watch the right panel open/close
- Click the X to close the right panel

### 2. Join a Room (1 minute)
- Click "Team Standup 👥"
- Click blue "Join" button
- New window opens showing "There's no one here!"
- Try clicking Mute button (should turn red)

### 3. Test with Friend (2 minutes)
- Have someone else start the app
- Both join "Team Standup"
- You should see each other!
- Try muting/unmuting
- Try screen share (macOS will ask permission)

## 🐛 Quick Debug

```bash
# Is API running?
curl http://localhost:3000/api/debug/health

# Any active rooms?
curl http://localhost:3000/api/debug/rooms

# Run automated tests
cd api && pnpm test:scenarios
```

## 🆘 Troubleshooting

### App won't start?
```bash
# Kill any existing processes
lsof -i :3000
kill -9 <PID>

# Clear cache and restart
cd app
rm -rf .vite out
pnpm start
```

### No audio/video?
- macOS: System Settings → Privacy & Security → Microphone/Camera
- Allow permissions for "Electron"

### Can't see other users?
- Make sure both users joined the SAME room
- Check console for WebRTC errors (View → Toggle Developer Tools)

## 📚 More Help

- **Full docs**: See README.md
- **Development**: See RUNNING.md
- **Testing**: See TESTING.md
- **Agent guide**: See CLAUDE.md

## 🎨 UI Overview

```
Lobby (Main Window)
┌──────────────────────────────────────────────────┐
│ Personal Team                     ⚙️  👤         │
├────────────┬──────────────┬──────────────────────┤
│ ROOMS      │ TEAM         │ Room Details         │
│            │              │ (shown when selected)│
│ 👥 Team    │ 👤 You       │                      │
│ Standup    │ 👤 Others    │ [Join]               │
│ [Join]     │              │ [Listen]             │
│            │ [Invite      │ [Join w/o audio]     │
│ 🏖️ Lounge  │  Teammates]  │ [Add Kiosks]         │
│            │              │                      │
│ 📋 Meeting │              │ Description...       │
│ Room       │              │                      │
│            │              │ [Type message...]    │
│ ⚡ Help    │              │                      │
│ Needed     │              │                      │
│            │              │                      │
│ ☕ Coffee  │              │                      │
│ Break      │              │                      │
│            │              │                      │
│ 📚 Library │              │                      │
└────────────┴──────────────┴──────────────────────┘

Call Window (Separate)
┌──────────────────────────────────────────────────┐
│ Team Standup  us-west1-a  [icons]               │
├──────────────────────────────────────────────────┤
│                                                  │
│           There's no one here!                   │
│        (or video grid when others join)          │
│                                                  │
├──────────────────────────────────────────────────┤
│ [Mute] [Cam] [Screen] [Chat] [More]  [LEAVE]   │
└──────────────────────────────────────────────────┘
```

## ✅ Status Check

After starting, verify everything is working:

```bash
# ✅ API healthy?
curl http://localhost:3000/api/debug/health
# Should return: {"status":"healthy"...}

# ✅ Can see stats?
curl http://localhost:3000/api/debug/stats
# Should return: {"totalRooms":0...}

# ✅ Tests passing?
cd app && pnpm run smoke:desktop
# Should show: 5 tests passed
```

## 🚀 Ready to Build!

Now that everything's working, you can:

1. **Add features** - See README.md for ideas
2. **Debug issues** - Use the debug endpoints
3. **Run tests** - `cd api && pnpm test:scenarios`
4. **Read code** - Check CLAUDE.md for architecture

---

**Quick Tips:**
- Keep both terminals open (API + App)
- Use debug endpoints to inspect state
- Check browser console in Electron (View → Toggle Developer Tools)
- Try joining with 2 users to test WebRTC

**Need help?** Check RUNNING.md for detailed instructions.
