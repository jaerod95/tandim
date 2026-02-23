# WebRTC Debugging Checklist

## Current Status Check

Run these commands to see what's happening:

### 1. Check if API server is running
```bash
curl http://localhost:3000/api/debug/stats
```

### 2. Check active rooms
```bash
curl http://localhost:3000/api/debug/rooms
```

### 3. Check connected sockets
```bash
curl http://localhost:3000/api/debug/sockets
```

## Electron App Console Output

**Open DevTools**: View → Toggle Developer Tools (Cmd+Option+I)

Look for these specific log messages in order:

### When joining room:
- ✅ `Creating new peer connection to [userId]`
- ✅ `Adding N local tracks to [userId]`
- ✅ `Connected`

### When browser enables camera:
- ✅ `Received offer from [userId]: audio=true, video=true`
- ✅ `Sending answer to [userId]: audio=true, video=true`
- ✅ `Draining N buffered ICE candidates`
- ✅ `Receiving video track from [name]`
- ✅ `Creating new tile for [name]` OR `Updating existing tile for [name]`

### Common Issues:

❌ **If you see**: `Received offer from [userId]: audio=true, video=false`
- Problem: Browser isn't including video in the offer
- The browser camera might not actually be enabled

❌ **If you see**: `Sending answer to [userId]: audio=true, video=false`
- Problem: Electron isn't accepting the video track
- Check if the answer creation is working correctly

❌ **If you see**: `Receiving audio track from [name]` but NO video track message
- Problem: Video track not arriving via ontrack event
- This is the core issue

❌ **If you see**: ICE candidate errors
- Should be fixed now with buffering
- If still happening, the buffering logic has a bug

## Browser Console Output

**Open Browser DevTools**: Right-click page → Inspect (Cmd+Option+I)

### When enabling camera:
- ✅ `Camera enabled`
- ✅ `Peer [userId]: stream has 1 video tracks`
- ✅ `➕ Adding video track to peer [userId]`
- ✅ `🔄 Negotiation needed with [name]`
- ✅ `📤 Auto-negotiating with [name]: audio=true, video=true`

### After negotiation:
- ✅ `Received answer from peer: audio=true, video=true`
- ✅ `Draining N buffered ICE candidates`

## What to Share

Please copy and paste:

1. **All console output from Electron** after:
   - Both clients join the room
   - Browser enables camera

2. **All console output from Browser** when:
   - Clicking "Camera On"
   - The negotiation happens

3. **API server logs** showing the signal events

## Quick Test Commands

```bash
# See what's in the room right now
curl -s http://localhost:3000/api/debug/rooms | jq .

# See connection states
curl -s http://localhost:3000/api/debug/stats
```
