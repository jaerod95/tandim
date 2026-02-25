import CallStage from "./CallStage";
import { CallContextProvider } from "./CallContext";
import styles from "./CallApp.module.css";
import CallHeader from "./CallHeader";
import CallFooter from "./CallFooter";

export function CallApp() {
  // When you enter a call app, we need to establish a connection to the call
  return (
    <CallContextProvider>
      <div className={styles.callShell}>
        <CallHeader />
        <CallStage />
        <CallFooter />
      </div>
    </CallContextProvider>
  );
}

// // Fix codec collision by preferring VP8
// function filterCodecs(sdp: string): string {
//   const lines = sdp.split("\r\n");
//   const videoMediaIndex = lines.findIndex((line) => line.startsWith("m=video"));

//   if (videoMediaIndex === -1) return sdp;

//   // Find VP8 payload type
//   const rtpmapLines = lines.filter(
//     (line) => line.includes("rtpmap") && line.includes("VP8"),
//   );
//   if (rtpmapLines.length === 0) return sdp;

//   const vp8Match = rtpmapLines[0].match(/a=rtpmap:(\d+)/);
//   if (!vp8Match) return sdp;

//   const vp8PayloadType = vp8Match[1];
//   console.log(`Filtering SDP to prefer VP8 (payload type ${vp8PayloadType})`);

//   // Reconstruct m=video line with only VP8 and its related codecs
//   const mLineMatch = lines[videoMediaIndex].match(
//     /^m=video (\d+) ([^ ]+) (.*)$/,
//   );
//   if (!mLineMatch) return sdp;

//   const [, port, proto, payloads] = mLineMatch;
//   const payloadList = payloads.split(" ");

//   // Keep VP8 and RTX for VP8
//   const keptPayloads = [vp8PayloadType];

//   // Find RTX for VP8
//   for (const line of lines) {
//     const rtxMatch = line.match(/a=fmtp:(\d+) apt=(\d+)/);
//     if (rtxMatch && rtxMatch[2] === vp8PayloadType) {
//       keptPayloads.push(rtxMatch[1]);
//     }
//   }

//   lines[videoMediaIndex] = `m=video ${port} ${proto} ${keptPayloads.join(" ")}`;

//   // Remove codec lines we're not using
//   const filteredLines = lines.filter((line, index) => {
//     if (index === videoMediaIndex) return true;
//     if (
//       !line.startsWith("a=rtpmap:") &&
//       !line.startsWith("a=fmtp:") &&
//       !line.startsWith("a=rtcp-fb:")
//     ) {
//       return true;
//     }

//     const payloadMatch = line.match(/^a=(?:rtpmap|fmtp|rtcp-fb):(\d+)/);
//     if (!payloadMatch) return true;

//     return keptPayloads.includes(payloadMatch[1]);
//   });

//   return filteredLines.join("\r\n");
// }

//   const [status, setStatus] = useState("Connecting...");
//   const [presence, setPresence] = useState<PresenceEntry[]>([]);
//   const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
//   const [micEnabled, setMicEnabled] = useState(true);
//   const [cameraEnabled, setCameraEnabled] = useState(false);
//   const [screenSharing, setScreenSharing] = useState(false);
//   const [session, setSession] = useState<CallSession | null>(null);
//   const [joined, setJoined] = useState(false);

//   const localVideoRef = useRef<HTMLVideoElement | null>(null);
//   const socketRef = useRef<Socket | null>(null);
//   const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
//   const peerNamesRef = useRef<Map<string, string>>(new Map());
//   const localStreamRef = useRef<MediaStream | null>(null);
//   const screenStreamRef = useRef<MediaStream | null>(null);
//   const heartbeatTimerRef = useRef<number | undefined>(undefined);
//   const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

//   const sortedPresence = useMemo(
//     () =>
//       [...presence].sort((a, b) => {
//         if (a.state === "you" && b.state !== "you") return -1;
//         if (a.state !== "you" && b.state === "you") return 1;
//         return a.displayName.localeCompare(b.displayName);
//       }),
//     [presence]
//   );

//   const hasOthers = remoteTiles.length > 0;

//   // Update local video when camera state changes
//   useEffect(() => {
//     if (cameraEnabled && localVideoRef.current && localStreamRef.current) {
//       console.log('useEffect: Updating local video because cameraEnabled changed to true');
//       const videoEl = localVideoRef.current;
//       videoEl.srcObject = localStreamRef.current;

//       const tracks = localStreamRef.current.getVideoTracks();
//       console.log(`useEffect: Local stream has ${tracks.length} video tracks`);
//       if (tracks.length > 0) {
//         console.log(`useEffect: Video track: ${tracks[0].id}, enabled: ${tracks[0].enabled}, readyState: ${tracks[0].readyState}`);
//       }

//       // Log video element properties
//       console.log(`useEffect: Video element dimensions: ${videoEl.clientWidth}x${videoEl.clientHeight}`);
//       console.log(`useEffect: Video element visible: ${videoEl.offsetParent !== null}`);
//       console.log(`useEffect: Video element muted: ${videoEl.muted}`);

//       // Wait for metadata and log video dimensions
//       videoEl.onloadedmetadata = () => {
//         console.log(`useEffect: Video metadata loaded, video dimensions: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
//       };

//       videoEl.play().then(() => {
//         console.log('useEffect: Local video playing successfully');
//       }).catch(err => {
//         console.error('useEffect: Failed to play local video:', err);
//       });
//     } else if (!cameraEnabled && localVideoRef.current) {
//       console.log('useEffect: Clearing local video because cameraEnabled changed to false');
//       localVideoRef.current.srcObject = null;
//     }
//   }, [cameraEnabled]);

//   useEffect(() => {
//     // Enable remote logging to API server
//     enableRemoteLogging();

//     const hash = window.location.hash;
//     const sessionId = hash.includes("?") ? new URLSearchParams(hash.split("?")[1]).get("sessionId") : null;
//     if (!sessionId) {
//       setStatus("Missing session id");
//       return;
//     }

//     window.tandem?.getCallSession(sessionId).then(async (loaded) => {
//       if (!loaded) {
//         setStatus("Call session not found");
//         return;
//       }
//       setSession(loaded);
//       await joinCall(loaded);
//     });

//     const onBeforeUnload = () => {
//       cleanupCallState();
//     };
//     window.addEventListener("beforeunload", onBeforeUnload);

//     return () => {
//       window.removeEventListener("beforeunload", onBeforeUnload);
//       cleanupCallState();
//     };
//   }, []);

//   async function joinCall(current: CallSession): Promise<void> {
//     try {
//       localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
//       if (localVideoRef.current) {
//         localVideoRef.current.srcObject = localStreamRef.current;
//       }

//       const socket = io(current.apiUrl, { path: "/api/signal", transports: ["websocket"] });
//       socketRef.current = socket;

//       socket.on("connect", () => {
//         socket.emit("signal:join", {
//           workspaceId: current.workspaceId,
//           roomId: current.roomId,
//           userId: current.userId,
//           displayName: current.displayName
//         });
//       });

//       socket.on("signal:joined", async (payload: { peers: SignalPeer[] }) => {
//         setPresence([{ userId: current.userId, displayName: current.displayName, state: "you" }]);
//         setJoined(true);
//         setStatus("Connected");
//         for (const peer of payload.peers) {
//           if (peer.userId === current.userId) continue;
//           peerNamesRef.current.set(peer.userId, peer.displayName);
//           setPresence((prev) => upsertPresence(prev, { ...peer, state: "connected" }));
//           await ensurePeerConnection(current, peer.userId, false);
//         }
//         startHeartbeat();
//       });

//       socket.on("signal:peer-joined", async (peer: SignalPeer) => {
//         if (!session || peer.userId === session.userId) return;
//         console.log(`Peer joined: ${peer.displayName} (${peer.userId})`);
//         peerNamesRef.current.set(peer.userId, peer.displayName);
//         setPresence((prev) => upsertPresence(prev, { ...peer, state: "connected" }));
//         await ensurePeerConnection(session, peer.userId, true);
//       });

//       socket.on("signal:offer", async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
//         if (!session) return;
//         const hasVideo = payload.payload.sdp?.includes('m=video');
//         const hasAudio = payload.payload.sdp?.includes('m=audio');
//         console.log(`Received offer from ${payload.fromUserId}: audio=${hasAudio}, video=${hasVideo}`);

//         const pc = peersRef.current.get(payload.fromUserId);
//         if (pc) {
//           // Update existing connection
//           await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
//           await drainIceCandidates(payload.fromUserId);

//           const answer = await pc.createAnswer();
//           await pc.setLocalDescription(answer);

//           const answerHasVideo = answer.sdp?.includes('m=video');
//           const answerHasAudio = answer.sdp?.includes('m=audio');
//           console.log(`Sending answer to ${payload.fromUserId}: audio=${answerHasAudio}, video=${answerHasVideo}`);

//           socket.emit("signal:answer", {
//             workspaceId: session.workspaceId,
//             roomId: session.roomId,
//             toUserId: payload.fromUserId,
//             payload: answer
//           });
//         } else {
//           // Create new connection
//           const newPc = await ensurePeerConnection(session, payload.fromUserId, false);
//           await newPc.setRemoteDescription(new RTCSessionDescription(payload.payload));
//           await drainIceCandidates(payload.fromUserId);

//           const answer = await newPc.createAnswer();
//           await newPc.setLocalDescription(answer);

//           const answerHasVideo = answer.sdp?.includes('m=video');
//           const answerHasAudio = answer.sdp?.includes('m=audio');
//           console.log(`Created connection, sending answer to ${payload.fromUserId}: audio=${answerHasAudio}, video=${answerHasVideo}`);

//           socket.emit("signal:answer", {
//             workspaceId: session.workspaceId,
//             roomId: session.roomId,
//             toUserId: payload.fromUserId,
//             payload: answer
//           });
//         }
//       });

//       socket.on("signal:answer", async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
//         const hasVideo = payload.payload.sdp?.includes('m=video');
//         const hasAudio = payload.payload.sdp?.includes('m=audio');
//         console.log(`Received answer from ${payload.fromUserId}: audio=${hasAudio}, video=${hasVideo}`);
//         const pc = peersRef.current.get(payload.fromUserId);
//         if (pc && pc.signalingState !== 'stable') {
//           await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
//           await drainIceCandidates(payload.fromUserId);
//           console.log(`Set remote description for ${payload.fromUserId}, state: ${pc.connectionState}`);
//         } else if (pc) {
//           console.log(`Ignoring answer from ${payload.fromUserId}, already stable`);
//         }
//       });

//       socket.on("signal:ice-candidate", async (payload: { fromUserId: string; payload: RTCIceCandidateInit }) => {
//         const pc = peersRef.current.get(payload.fromUserId);
//         if (!pc) return;

//         try {
//           // Only add if remote description is set
//           if (pc.remoteDescription) {
//             await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
//           } else {
//             // Buffer candidates until remote description is set
//             const queue = pendingIceCandidatesRef.current.get(payload.fromUserId) ?? [];
//             queue.push(payload.payload);
//             pendingIceCandidatesRef.current.set(payload.fromUserId, queue);
//             console.log(`Buffered ICE candidate for ${payload.fromUserId} (${queue.length} pending)`);
//           }
//         } catch (error) {
//           console.error(`Failed to add ICE candidate from ${payload.fromUserId}:`, error);
//         }
//       });

//       socket.on("signal:peer-left", (payload: { userId: string }) => {
//         removePeer(payload.userId);
//         setPresence((prev) => prev.filter((entry) => entry.userId !== payload.userId));
//       });

//       socket.on("disconnect", () => {
//         setJoined(false);
//         setStatus("Disconnected");
//       });
//     } catch (error) {
//       setStatus(`Failed: ${(error as Error).message}`);
//     }
//   }

//   async function ensurePeerConnection(
//     current: CallSession,
//     peerUserId: string,
//     createOffer: boolean
//   ): Promise<RTCPeerConnection> {
//     const existing = peersRef.current.get(peerUserId);
//     if (existing && existing.connectionState !== 'failed' && existing.connectionState !== 'closed') {
//       console.log(`Reusing existing connection to ${peerUserId}, state: ${existing.connectionState}`);
//       return existing;
//     }

//     console.log(`Creating new peer connection to ${peerUserId}, offer: ${createOffer}`);

//     const response = await fetch(`${current.apiUrl}/api/ice-config`);
//     const ice = (await response.json()) as IceConfig;

//     // Add explicit codec preferences to avoid collision
//     const config = {
//       ...ice,
//       sdpSemantics: 'unified-plan' as const,
//     };

//     const pc = new RTCPeerConnection(config);
//     peersRef.current.set(peerUserId, pc);

//     // Set codec preferences after connection is created
//     if ('getTransceivers' in pc) {
//       const transceivers = pc.getTransceivers();
//       transceivers.forEach(transceiver => {
//         if (transceiver.sender && transceiver.sender.track?.kind === 'video') {
//           const capabilities = RTCRtpSender.getCapabilities('video');
//           if (capabilities) {
//             // Prefer VP8 codec to avoid collision
//             const vp8Codec = capabilities.codecs.find(codec =>
//               codec.mimeType === 'video/VP8'
//             );
//             if (vp8Codec) {
//               transceiver.setCodecPreferences([vp8Codec]);
//               console.log(`Set codec preference to VP8 for ${peerUserId}`);
//             }
//           }
//         }
//       });
//     }

//     pc.onicecandidate = (event) => {
//       if (!event.candidate) return;
//       socketRef.current?.emit("signal:ice-candidate", {
//         workspaceId: current.workspaceId,
//         roomId: current.roomId,
//         toUserId: peerUserId,
//         payload: event.candidate.toJSON()
//       });
//     };

//     pc.ontrack = (event) => {
//       const stream = event.streams[0];
//       if (!stream) {
//         console.log(`Received track from ${peerUserId} but no stream`);
//         return;
//       }
//       const display = peerNamesRef.current.get(peerUserId) ?? peerUserId;
//       console.log(`Received ${event.track.kind} track from ${display}, stream has ${stream.getTracks().length} tracks`);

//       // Always update the tile with the latest stream
//       setRemoteTiles((prev) => {
//         const existing = prev.find(t => t.userId === peerUserId);
//         if (existing) {
//           console.log(`Updating existing tile for ${display}, incrementing version to ${existing.version + 1}`);
//           return prev.map(t =>
//             t.userId === peerUserId
//               ? { ...t, stream, version: t.version + 1 }
//               : t
//           );
//         } else {
//           console.log(`Creating new tile for ${display}`);
//           return [...prev, { userId: peerUserId, displayName: display, stream, version: 1 }];
//         }
//       });
//     };

//     pc.onconnectionstatechange = () => {
//       console.log(`Connection state with ${peerUserId}: ${pc.connectionState}`);
//       if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
//         console.log(`Connection to ${peerUserId} failed/closed, removing`);
//         removePeer(peerUserId);
//       }
//     };

//     // Add local tracks first (before setting up negotiationneeded)
//     console.log(`Adding ${localStreamRef.current?.getTracks().length ?? 0} local tracks to ${peerUserId}`);
//     for (const track of localStreamRef.current?.getTracks() ?? []) {
//       console.log(`  - Adding ${track.kind} track: ${track.id}`);
//       pc.addTrack(track, localStreamRef.current as MediaStream);
//     }
//     for (const track of screenStreamRef.current?.getVideoTracks() ?? []) {
//       pc.addTrack(track, screenStreamRef.current);
//     }

//     // Set up negotiation handler after initial tracks are added
//     let makingOffer = false;
//     pc.onnegotiationneeded = async () => {
//       try {
//         if (makingOffer) {
//           console.log(`Already making offer to ${peerUserId}`);
//           return;
//         }

//         makingOffer = true;
//         console.log(`🔄 Negotiation needed with ${peerUserId}`);

//         const offer = await pc.createOffer();
//         if (pc.signalingState !== "stable") {
//           console.log(`Signaling state not stable for ${peerUserId}: ${pc.signalingState}`);
//           return;
//         }

//         // Filter SDP to avoid codec collisions
//         if (offer.sdp) {
//           offer.sdp = filterCodecs(offer.sdp);
//         }

//         await pc.setLocalDescription(offer);
//         const hasVideo = offer.sdp?.includes('m=video');
//         const hasAudio = offer.sdp?.includes('m=audio');
//         console.log(`📤 Sending auto-negotiated offer to ${peerUserId}: audio=${hasAudio}, video=${hasVideo}`);

//         socketRef.current?.emit("signal:offer", {
//           workspaceId: current.workspaceId,
//           roomId: current.roomId,
//           toUserId: peerUserId,
//           payload: offer
//         });
//       } catch (err) {
//         console.error(`Negotiation error with ${peerUserId}:`, err);
//       } finally {
//         makingOffer = false;
//       }
//     };

//     // For initial connection, manually create offer if needed
//     if (createOffer) {
//       const offer = await pc.createOffer();

//       // Filter SDP to avoid codec collisions
//       if (offer.sdp) {
//         offer.sdp = filterCodecs(offer.sdp);
//       }

//       await pc.setLocalDescription(offer);
//       const hasVideo = offer.sdp?.includes('m=video');
//       const hasAudio = offer.sdp?.includes('m=audio');
//       console.log(`📤 Sending initial offer to ${peerUserId}: audio=${hasAudio}, video=${hasVideo}`);
//       socketRef.current?.emit("signal:offer", {
//         workspaceId: current.workspaceId,
//         roomId: current.roomId,
//         toUserId: peerUserId,
//         payload: offer
//       });
//     }
//     return pc;
//   }

//   async function drainIceCandidates(userId: string): Promise<void> {
//     const pc = peersRef.current.get(userId);
//     const queue = pendingIceCandidatesRef.current.get(userId);

//     if (!pc || !queue || queue.length === 0) return;

//     console.log(`Draining ${queue.length} buffered ICE candidates for ${userId}`);

//     for (const candidate of queue) {
//       try {
//         await pc.addIceCandidate(new RTCIceCandidate(candidate));
//       } catch (error) {
//         console.error(`Failed to add buffered ICE candidate:`, error);
//       }
//     }

//     pendingIceCandidatesRef.current.delete(userId);
//   }

//   function removePeer(userId: string): void {
//     const pc = peersRef.current.get(userId);
//     if (pc) {
//       pc.close();
//       peersRef.current.delete(userId);
//     }
//     peerNamesRef.current.delete(userId);
//     pendingIceCandidatesRef.current.delete(userId);
//     setRemoteTiles((prev) => prev.filter((tile) => tile.userId !== userId));
//   }

//   function cleanupCallState(): void {
//     console.log('Cleaning up call state...');

//     // Close all peer connections
//     for (const userId of Array.from(peersRef.current.keys())) {
//       removePeer(userId);
//     }

//     // Disconnect socket
//     if (socketRef.current) {
//       socketRef.current.disconnect();
//       socketRef.current = null;
//     }

//     // Stop heartbeat
//     if (heartbeatTimerRef.current) {
//       window.clearInterval(heartbeatTimerRef.current);
//       heartbeatTimerRef.current = undefined;
//     }

//     // Stop all media tracks
//     for (const track of localStreamRef.current?.getTracks() ?? []) {
//       track.stop();
//     }
//     for (const track of screenStreamRef.current?.getTracks() ?? []) {
//       track.stop();
//     }

//     // Clear refs
//     localStreamRef.current = null;
//     screenStreamRef.current = null;

//     // Clear video element
//     if (localVideoRef.current) {
//       localVideoRef.current.srcObject = null;
//     }

//     // Reset state
//     setJoined(false);
//     setCameraEnabled(false);
//     setScreenSharing(false);
//     setMicEnabled(true);
//     setRemoteTiles([]);
//     setPresence([]);
//     setStatus('Disconnected');

//     console.log('Call state cleaned up');
//   }

//   function startHeartbeat(): void {
//     if (heartbeatTimerRef.current) {
//       window.clearInterval(heartbeatTimerRef.current);
//     }
//     heartbeatTimerRef.current = window.setInterval(() => {
//       socketRef.current?.emit("signal:heartbeat");
//     }, 15_000);
//   }

//   function toggleMic(): void {
//     const next = !micEnabled;
//     for (const track of localStreamRef.current?.getAudioTracks() ?? []) {
//       track.enabled = next;
//     }
//     setMicEnabled(next);
//   }

//   async function toggleCamera(): Promise<void> {
//     if (!localStreamRef.current || !session) return;

//     console.log(`Toggling camera: ${cameraEnabled} -> ${!cameraEnabled}`);

//     if (cameraEnabled) {
//       // Turn off camera
//       for (const track of localStreamRef.current.getVideoTracks()) {
//         track.stop();
//         localStreamRef.current.removeTrack(track);
//       }
//       setCameraEnabled(false);
//     } else {
//       // Turn on camera
//       try {
//         const cam = await navigator.mediaDevices.getUserMedia({ video: true });
//         const track = cam.getVideoTracks()[0];
//         if (track) {
//           localStreamRef.current.addTrack(track);
//           setCameraEnabled(true);
//         }
//       } catch (error) {
//         console.error('Failed to get camera:', error);
//         setStatus(`Camera error: ${(error as Error).message}`);
//         return;
//       }
//     }

//     // Update local video display
//     if (localVideoRef.current) {
//       console.log(`Setting local video srcObject, stream has ${localStreamRef.current.getTracks().length} tracks`);
//       localVideoRef.current.srcObject = localStreamRef.current;

//       // Force play
//       localVideoRef.current.play().catch(err => {
//         console.error('Failed to play local video:', err);
//       });
//     } else {
//       console.warn('Local video ref not available yet, will update on next render');
//       // Use setTimeout to try again after React renders
//       setTimeout(() => {
//         if (localVideoRef.current && localStreamRef.current) {
//           console.log('Retrying local video srcObject');
//           localVideoRef.current.srcObject = localStreamRef.current;
//           localVideoRef.current.play().catch(err => {
//             console.error('Failed to play local video (retry):', err);
//           });
//         }
//       }, 100);
//     }

//     // Instead of recreating all connections, just update the tracks
//     await updatePeerTracks(session);
//   }

//   async function toggleScreen(): Promise<void> {
//     if (!socketRef.current || !session) return;

//     if (screenStreamRef.current) {
//       console.log('Stopping screen share');
//       for (const track of screenStreamRef.current.getTracks()) {
//         track.stop();
//       }
//       screenStreamRef.current = null;
//       socketRef.current.emit("signal:screen-share-stop");
//       setScreenSharing(false);
//       await updateScreenShareTracks(session);
//       return;
//     }

//     try {
//       console.log('Starting screen share');
//       const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
//       const track = screen.getVideoTracks()[0];
//       if (track) {
//         track.onended = () => {
//           void toggleScreen();
//         };
//       }
//       screenStreamRef.current = screen;
//       socketRef.current.emit("signal:screen-share-start");
//       setScreenSharing(true);
//       await updateScreenShareTracks(session);
//     } catch (error) {
//       console.error('Failed to start screen share:', error);
//       setStatus(`Screen share error: ${(error as Error).message}`);
//     }
//   }

//   async function updateScreenShareTracks(current: CallSession): Promise<void> {
//     console.log('Updating screen share tracks for all peers...');
//     const peerUserIds = Array.from(peersRef.current.keys());

//     for (const peerUserId of peerUserIds) {
//       const pc = peersRef.current.get(peerUserId);
//       if (!pc || pc.connectionState === 'closed') continue;

//       try {
//         // Get current senders
//         const senders = pc.getSenders();

//         // Remove old screen share senders
//         for (const sender of senders) {
//           if (sender.track?.label.includes('screen') || sender.track?.label.includes('window')) {
//             pc.removeTrack(sender);
//           }
//         }

//         // Add new screen track if sharing
//         if (screenStreamRef.current) {
//           const screenTrack = screenStreamRef.current.getVideoTracks()[0];
//           if (screenTrack) {
//             pc.addTrack(screenTrack, screenStreamRef.current);
//           }
//         }

//         // Renegotiate
//         const offer = await pc.createOffer();
//         await pc.setLocalDescription(offer);
//         socketRef.current?.emit("signal:offer", {
//           workspaceId: current.workspaceId,
//           roomId: current.roomId,
//           toUserId: peerUserId,
//           payload: offer
//         });

//         console.log(`Updated screen share for peer ${peerUserId}`);
//       } catch (error) {
//         console.error(`Failed to update screen share for ${peerUserId}:`, error);
//       }
//     }
//   }

//   async function updatePeerTracks(current: CallSession): Promise<void> {
//     console.log('Updating camera tracks for all peers...');
//     const peerUserIds = Array.from(peersRef.current.keys());

//     for (const peerUserId of peerUserIds) {
//       const pc = peersRef.current.get(peerUserId);
//       if (!pc || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
//         console.log(`Skipping ${peerUserId}, connection state: ${pc?.connectionState}`);
//         continue;
//       }

//       try {
//         const senders = pc.getSenders();

//         // Check current video tracks in the stream
//         const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
//         const hasVideoInStream = videoTracks.length > 0;

//         console.log(`Peer ${peerUserId}: stream has ${videoTracks.length} video tracks`);

//         // Find existing video sender
//         const videoSender = senders.find(s => s.track?.kind === 'video');

//         if (hasVideoInStream && !videoSender) {
//           // Add video track (negotiationneeded will fire)
//           const track = videoTracks[0];
//           console.log(`Adding video track to peer ${peerUserId}: ${track.id}`);
//           pc.addTrack(track, localStreamRef.current!);
//         } else if (!hasVideoInStream && videoSender) {
//           // Remove video track (negotiationneeded will fire)
//           console.log(`Removing video track from peer ${peerUserId}`);
//           pc.removeTrack(videoSender);
//         } else if (hasVideoInStream && videoSender) {
//           // Replace video track (no negotiation needed)
//           const track = videoTracks[0];
//           console.log(`Replacing video track for peer ${peerUserId}: ${track.id}`);
//           await videoSender.replaceTrack(track);
//         }
//       } catch (error) {
//         console.error(`Failed to update tracks for ${peerUserId}:`, error);
//       }
//     }
//   }

//   async function renegotiateAllPeers(current: CallSession): Promise<void> {
//     console.log('Full renegotiation triggered (should be rare)');
//     const peerUserIds = Array.from(peersRef.current.keys());
//     for (const peerUserId of peerUserIds) {
//       removePeer(peerUserId);
//       await ensurePeerConnection(current, peerUserId, true);
//     }
//   }

//   return (
//     <main className="call-shell">
//       {/* Top Bar */}
//       <header className="call-topbar">
//         <div className="call-topbar-left">
//           <span className="call-room-name">{session?.roomId ?? "Call"}</span>
//           <span className="call-workspace">us-west1-a</span>
//         </div>
//         <div className="call-topbar-right">
//           <button className="call-icon-btn" title="Connection Info">
//             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
//               <path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6a6 6 0 100 12A6 6 0 008 2z"/>
//               <path d="M7 4h2v2H7V4zm0 4h2v6H7V8z"/>
//             </svg>
//           </button>
//           <button className="call-icon-btn" title="Notifications">
//             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
//               <path d="M8 0a1 1 0 011 1v.5A6 6 0 0114.5 8H15a1 1 0 010 2h-1a1 1 0 01-1-1 5 5 0 00-10 0 1 1 0 01-1 1H1a1 1 0 010-2h.5A6 6 0 017 1.5V1a1 1 0 011-1z"/>
//               <path d="M6 14a2 2 0 104 0H6z"/>
//             </svg>
//           </button>
//           <button className="call-icon-btn" title="Grid View">
//             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
//               <path d="M0 0h7v7H0V0zm9 0h7v7H9V0zM0 9h7v7H0V9zm9 0h7v7H9V9z"/>
//             </svg>
//           </button>
//           <button className="call-icon-btn" title="Pin">
//             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
//               <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707l-2.12 2.12 2.475 2.475a.5.5 0 01-.707.707L12.5 9.55l-2.12 2.12a.5.5 0 01-.707 0l-4.95-4.95a.5.5 0 010-.707L7.05 3.69 4.575 1.215a.5.5 0 11.707-.707L7.757 2.98l2.121-2.12a.5.5 0 01.354-.146z"/>
//             </svg>
//           </button>
//           <button className="call-icon-btn" title="More">
//             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
//               <path d="M3 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
//             </svg>
//           </button>
//         </div>
//       </header>

//       {/* Main Stage */}
//       <section className="call-stage">
//        <CallStage />
//       </section>

//       {/* Bottom Controls */}
//       <footer className="call-controls">
//         <div className="call-controls-left">
//           <div className="control-group">
//             <span className="control-label">Mute</span>
//             <button
//               className={`control-btn ${!micEnabled ? 'active' : ''}`}
//               onClick={() => toggleMic()}
//               disabled={!joined}
//               title={micEnabled ? "Mute" : "Unmute"}
//             >
//               <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
//                 {micEnabled ? (
//                   <path d="M5 3a3 3 0 016 0v5a3 3 0 01-6 0V3zM3.5 8a.5.5 0 01.5.5 4 4 0 008 0 .5.5 0 011 0 5 5 0 01-4.5 4.975V15h1a.5.5 0 010 1h-3a.5.5 0 010-1h1v-1.525A5 5 0 013 8.5a.5.5 0 01.5-.5z"/>
//                 ) : (
//                   <>
//                     <path d="M5 3a3 3 0 016 0v5a3 3 0 01-6 0V3z"/>
//                     <path d="M1 1l14 14" stroke="currentColor" strokeWidth="2"/>
//                   </>
//                 )}
//               </svg>
//             </button>
//           </div>

//           <div className="control-group">
//             <span className="control-label">Camera</span>
//             <button
//               className={`control-btn ${cameraEnabled ? 'active' : ''}`}
//               onClick={() => void toggleCamera()}
//               disabled={!joined}
//               title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
//             >
//               <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
//                 {cameraEnabled ? (
//                   <path d="M0 4a2 2 0 012-2h8a2 2 0 012 2v1.586l2.707-2.707a1 1 0 011.707.707v8.828a1 1 0 01-1.707.707L12 10.414V12a2 2 0 01-2 2H2a2 2 0 01-2-2V4z"/>
//                 ) : (
//                   <>
//                     <path d="M0 4a2 2 0 012-2h8a2 2 0 012 2v1.586l2.707-2.707a1 1 0 011.707.707v8.828a1 1 0 01-1.707.707L12 10.414V12a2 2 0 01-2 2H2a2 2 0 01-2-2V4z"/>
//                     <path d="M1 1l14 14" stroke="currentColor" strokeWidth="2"/>
//                   </>
//                 )}
//               </svg>
//             </button>
//           </div>
//         </div>

//         <div className="call-controls-center">
//           <div className="control-group">
//             <span className="control-label">Screen</span>
//             <button
//               className={`control-btn large ${screenSharing ? 'active' : ''}`}
//               onClick={() => void toggleScreen()}
//               disabled={!joined}
//               title={screenSharing ? "Stop Sharing" : "Share Screen"}
//             >
//               <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
//                 <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm8 9l2-2H6l2 2z"/>
//               </svg>
//               {screenSharing && <span className="sharing-indicator">■</span>}
//             </button>
//           </div>

//           <div className="control-group">
//             <span className="control-label">Chat</span>
//             <button className="control-btn" disabled={!joined} title="Chat">
//               <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
//                 <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4.414l-2.707 2.707A1 1 0 010 14V2z"/>
//               </svg>
//             </button>
//           </div>

//           <div className="control-group">
//             <span className="control-label">Reactions</span>
//             <button className="control-btn" disabled={!joined} title="Reactions">
//               <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
//                 <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM5 6a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2zM5.5 10a.5.5 0 01.5-.5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z"/>
//               </svg>
//             </button>
//           </div>

//           <div className="control-group">
//             <span className="control-label">Widgets</span>
//             <button className="control-btn" disabled={!joined} title="Widgets">
//               <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
//                 <path d="M0 0h7v7H0V0zm9 0h7v7H9V0zM0 9h7v7H0V9zm9 0h7v7H9V9z"/>
//               </svg>
//             </button>
//           </div>

//           <div className="control-group">
//             <span className="control-label">More</span>
//             <button className="control-btn" disabled={!joined} title="More">
//               <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
//                 <path d="M3 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
//               </svg>
//             </button>
//           </div>
//         </div>

//         <div className="call-controls-right">
//           <button className="leave-btn" onClick={() => window.close()}>
//             LEAVE
//           </button>
//           <div className="current-user">
//             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '6px' }}>
//               <path d="M8 0a3 3 0 100 6 3 3 0 000-6z"/>
//               <path d="M12 8a2 2 0 00-2-2H6a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V8z"/>
//             </svg>
//             {session?.displayName ?? "You"}
//           </div>
//         </div>
//       </footer>
//     </main>
//   );
// }
