type TrayStatus = "available" | "in-call" | "idle" | "dnd" | "offline";

type DeepLinkJoinData = { roomId: string; workspaceId?: string };
type DeepLinkWorkspaceData = { workspaceId: string };

type DeepLinkPending =
  | { type: "join-room"; roomId: string; workspaceId?: string }
  | { type: "view-room"; roomId: string; workspaceId?: string }
  | { type: "workspace"; workspaceId: string }
  | null;

type TandimBridge = {
  // Deep links
  getPendingDeepLink: () => Promise<DeepLinkPending>;
  getPendingRoom: () => Promise<string | null>;
  onDeepLinkRoom: (handler: (roomId: string) => void) => void;
  onDeepLinkJoin: (handler: (data: DeepLinkJoinData) => void) => void;
  onDeepLinkWorkspace: (handler: (data: DeepLinkWorkspaceData) => void) => void;

  // Call management
  openCallWindow: (payload: {
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
    audioEnabled: boolean;
  }) => Promise<{ sessionId: string }>;
  getCallSession: (sessionId: string) => Promise<{
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
    audioEnabled: boolean;
  } | null>;

  // Tray & status
  setTrayStatus: (status: TrayStatus) => void;
  onIdleStateChanged: (callback: (isIdle: boolean) => void) => void;
  onDndToggle: (handler: (enabled: boolean) => void) => void;
  setDndFromRenderer: (enabled: boolean) => void;

  // Auto-update (uses update-electron-app with Forge GitHub releases)
  installUpdate: () => void;
  onUpdateAvailable: (handler: () => void) => void;
  onUpdateDownloaded: (handler: (info: { version: string }) => void) => void;
};

declare global {
  interface Window {
    tandim?: TandimBridge;
  }
}

export {};
