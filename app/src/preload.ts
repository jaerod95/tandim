import { contextBridge, ipcRenderer } from "electron";

const api = {
  getPendingRoom: (): Promise<string | null> => ipcRenderer.invoke("deep-link:getPendingRoom"),
  onDeepLinkRoom: (handler: (roomId: string) => void): void => {
    ipcRenderer.on("deep-link:room", (_event, roomId: string) => handler(roomId));
  }
};

contextBridge.exposeInMainWorld("tandem", api);
