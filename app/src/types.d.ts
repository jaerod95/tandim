type TrayStatus = "available" | "in-call" | "idle" | "dnd" | "offline";

type TandimBridge = {
  getPendingRoom: () => Promise<string | null>;
  onDeepLinkRoom: (handler: (roomId: string) => void) => void;
  openCallWindow: (payload: {
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
  }) => Promise<{ sessionId: string }>;
  getCallSession: (sessionId: string) => Promise<{
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
  } | null>;
  setTrayStatus: (status: TrayStatus) => void;
  onIdleStateChanged: (callback: (isIdle: boolean) => void) => void;
  onDndToggle: (handler: (enabled: boolean) => void) => void;
  setDndFromRenderer: (enabled: boolean) => void;
};

declare global {
  interface Window {
    tandim?: TandimBridge;
  }
}

export {};
