import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

type DeviceMenuProps = {
  devices: MediaDeviceInfo[];
  activeDeviceId?: string;
  onSelect: (deviceId: string) => void;
  side?: "top" | "bottom";
};

export function DeviceMenu({ devices, activeDeviceId, onSelect, side = "top" }: DeviceMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (devices.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-5 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        title="Select device"
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          className={`absolute ${side === "top" ? "bottom-full mb-1" : "top-full mt-1"} left-0 z-50 min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg`}
        >
          {devices.map((device) => {
            const isActive = device.deviceId === activeDeviceId;
            return (
              <button
                key={device.deviceId}
                onClick={() => {
                  onSelect(device.deviceId);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  isActive
                    ? "text-blue-400"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {isActive && <Check className="h-3 w-3 shrink-0" />}
                {!isActive && <span className="h-3 w-3 shrink-0" />}
                <span className="truncate">{device.label || `Device ${device.deviceId.slice(0, 8)}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
