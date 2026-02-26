import { useCallback, useEffect, useState } from "react";

export type MediaDeviceList = {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
};

/**
 * Enumerates available media devices and updates when devices change.
 * Labels are only available after the user has granted media permissions
 * (i.e., after the first getUserMedia call), so this hook re-enumerates
 * whenever the device list changes.
 */
export function useMediaDevices(): MediaDeviceList {
  const [devices, setDevices] = useState<MediaDeviceList>({
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
  });

  const enumerate = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: all.filter((d) => d.kind === "audioinput"),
        audioOutputs: all.filter((d) => d.kind === "audiooutput"),
        videoInputs: all.filter((d) => d.kind === "videoinput"),
      });
    } catch (err) {
      console.error("Failed to enumerate media devices:", err);
    }
  }, []);

  useEffect(() => {
    enumerate();

    navigator.mediaDevices.addEventListener("devicechange", enumerate);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
    };
  }, [enumerate]);

  return devices;
}
