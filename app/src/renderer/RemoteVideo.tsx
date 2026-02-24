import React, { useEffect, useRef, useState } from "react";

type RemoteVideoProps = {
  label: string;
  stream: MediaStream;
};

export function RemoteVideo(props: RemoteVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    // Update hasVideo state when stream changes
    setHasVideo(props.stream?.getVideoTracks().length > 0);
  }, [props.stream]);

  useEffect(() => {
    const videoEl = ref.current;
    if (!videoEl || !props.stream) return;

    console.log(`RemoteVideo: Setting stream for ${props.label}`);
    console.log(`  - Stream ID: ${props.stream.id}`);
    console.log(`  - Stream active: ${props.stream.active}`);
    console.log(`  - Audio tracks: ${props.stream.getAudioTracks().length}`);
    console.log(`  - Video tracks: ${props.stream.getVideoTracks().length}`);

    const videoTracks = props.stream.getVideoTracks();
    if (videoTracks.length > 0) {
      const track = videoTracks[0];
      console.log(`  - Video track ID: ${track.id}`);
      console.log(`  - Video track enabled: ${track.enabled}`);
      console.log(`  - Video track readyState: ${track.readyState}`);
      console.log(`  - Video track muted: ${track.muted}`);
    } else {
      console.warn(
        `RemoteVideo: No video tracks in stream for ${props.label}!`,
      );
    }

    // Always set srcObject, even if no video tracks yet
    videoEl.srcObject = props.stream;

    // Listen for tracks being added to the stream
    const handleAddTrack = (event: MediaStreamTrackEvent) => {
      console.log(
        `RemoteVideo: Track added to stream for ${props.label}: ${event.track.kind}`,
      );
      if (event.track.kind === "video") {
        console.log(`RemoteVideo: Video track added! ID: ${event.track.id}`);
        setHasVideo(true);
        // Force video element to reload
        videoEl.load();
      }
    };

    // Listen for tracks being removed
    const handleRemoveTrack = (event: MediaStreamTrackEvent) => {
      console.log(
        `RemoteVideo: Track removed from stream for ${props.label}: ${event.track.kind}`,
      );
      if (event.track.kind === "video") {
        console.log(`RemoteVideo: Video track removed!`);
        setHasVideo(false);
      }
    };

    props.stream.addEventListener("addtrack", handleAddTrack);
    props.stream.addEventListener("removetrack", handleRemoveTrack);

    // Log when video starts playing
    const handleLoadedMetadata = () => {
      console.log(`RemoteVideo: Metadata loaded for ${props.label}`);
      console.log(
        `  - Video dimensions: ${videoEl.videoWidth}x${videoEl.videoHeight}`,
      );
      console.log(`  - Current tracks: ${props.stream.getTracks().length}`);
    };

    const handlePlay = () => {
      console.log(`RemoteVideo: Video playing for ${props.label}`);
    };

    const handleError = (e: Event) => {
      console.error(`RemoteVideo: Video error for ${props.label}:`, e);
    };

    videoEl.addEventListener("loadedmetadata", handleLoadedMetadata);
    videoEl.addEventListener("play", handlePlay);
    videoEl.addEventListener("error", handleError);

    return () => {
      props.stream.removeEventListener("addtrack", handleAddTrack);
      props.stream.removeEventListener("removetrack", handleRemoveTrack);
      videoEl.removeEventListener("loadedmetadata", handleLoadedMetadata);
      videoEl.removeEventListener("play", handlePlay);
      videoEl.removeEventListener("error", handleError);
    };
  }, [props.stream, props.label]);

  return (
    <article className="tile">
      <h2>{props.label}</h2>
      {!hasVideo && (
        <div className="video-placeholder">
          <div className="avatar-large">
            {props.label.charAt(0).toUpperCase()}
          </div>
          <p>{props.label}</p>
        </div>
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={false}
        style={{ display: hasVideo ? "block" : "none" }}
      />
    </article>
  );
}
