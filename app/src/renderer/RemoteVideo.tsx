import React, { useEffect, useRef } from "react";

type RemoteVideoProps = {
  label: string;
  stream: MediaStream;
};

export function RemoteVideo(props: RemoteVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = props.stream;
    }
  }, [props.stream]);

  return (
    <article className="tile">
      <h2>{props.label}</h2>
      <video ref={ref} autoPlay playsInline />
    </article>
  );
}
