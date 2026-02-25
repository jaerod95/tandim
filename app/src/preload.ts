import { contextBridge, ipcRenderer } from "electron";

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
};

contextBridge.exposeInMainWorld("tandim", api);
