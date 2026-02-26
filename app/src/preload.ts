import { contextBridge, ipcRenderer } from "electron";

type TrayStatus = "available" | "in-call" | "idle" | "dnd" | "offline";

const api = {
  getPendingRoom: (): Promise<string | null> =>
    ipcRenderer.invoke("deep-link:getPendingRoom"),
  onDeepLinkRoom: (handler: (roomId: string) => void): void => {
    ipcRenderer.on("deep-link:room", (_event, roomId: string) =>
      handler(roomId),
    );
  },
  openCallWindow: (payload: {
    apiUrl: string;
    workspaceId: string;
    roomId: string;
    displayName: string;
    userId: string;
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
  } | null> => ipcRenderer.invoke("call:getSession", sessionId),
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
};

contextBridge.exposeInMainWorld("tandim", api);
