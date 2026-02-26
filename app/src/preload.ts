import { contextBridge, ipcRenderer } from "electron";

type TrayStatus = "available" | "in-call" | "idle" | "dnd" | "offline";

type DeepLinkJoinData = { roomId: string; workspaceId?: string };
type DeepLinkWorkspaceData = { workspaceId: string };

type DeepLinkPending =
  | { type: "join-room"; roomId: string; workspaceId?: string }
  | { type: "view-room"; roomId: string; workspaceId?: string }
  | { type: "workspace"; workspaceId: string }
  | null;

const api = {
  // Deep links
  getPendingDeepLink: (): Promise<DeepLinkPending> =>
    ipcRenderer.invoke("deep-link:getPending"),
  getPendingRoom: (): Promise<string | null> =>
    ipcRenderer.invoke("deep-link:getPendingRoom"),
  onDeepLinkRoom: (handler: (roomId: string) => void): void => {
    ipcRenderer.on("deep-link:room", (_event, roomId: string) =>
      handler(roomId),
    );
  },
  onDeepLinkJoin: (handler: (data: DeepLinkJoinData) => void): void => {
    ipcRenderer.on("deep-link:join", (_event, data: DeepLinkJoinData) =>
      handler(data),
    );
  },
  onDeepLinkWorkspace: (handler: (data: DeepLinkWorkspaceData) => void): void => {
    ipcRenderer.on("deep-link:workspace", (_event, data: DeepLinkWorkspaceData) =>
      handler(data),
    );
  },

  // Call management
  openCallWindow: (payload: {
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
    audioEnabled: boolean;
  }): Promise<{ sessionId: string }> =>
    ipcRenderer.invoke("call:openWindow", payload),
  getCallSession: (
    sessionId: string,
  ): Promise<{
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
    audioEnabled: boolean;
  } | null> => ipcRenderer.invoke("call:getSession", sessionId),

  // Tray & status
  setTrayStatus: (status: TrayStatus): void => {
    ipcRenderer.send("tray:setStatus", status);
  },
  onIdleStateChanged: (callback: (isIdle: boolean) => void): void => {
    ipcRenderer.on("idle-state-changed", (_event, isIdle: boolean) =>
      callback(isIdle),
    );
  },
  onDndToggle: (handler: (enabled: boolean) => void): void => {
    ipcRenderer.on("dnd:toggle", (_event, enabled: boolean) =>
      handler(enabled),
    );
  },
  setDndFromRenderer: (enabled: boolean): void => {
    ipcRenderer.send("dnd:setFromRenderer", enabled);
  },

  // Auto-update (uses update-electron-app with Forge GitHub releases)
  installUpdate: (): void => {
    ipcRenderer.send("update:install");
  },
  onUpdateAvailable: (handler: () => void): void => {
    ipcRenderer.on("update:available", () => handler());
  },
  onUpdateDownloaded: (
    handler: (info: { version: string }) => void,
  ): void => {
    ipcRenderer.on(
      "update:downloaded",
      (_event, info: { version: string }) => handler(info),
    );
  },
};

contextBridge.exposeInMainWorld("tandim", api);
