import { autoUpdater, BrowserWindow, ipcMain } from "electron";
import { updateElectronApp, UpdateSourceType } from "update-electron-app";

// Configure auto-updates via Electron Forge's recommended approach.
// Uses update.electronjs.org which proxies GitHub releases.
// Automatically skips in dev mode (app.isPackaged === false).
updateElectronApp({
  updateSource: {
    type: UpdateSourceType.ElectronPublicUpdateService,
    repo: "jaerod95/tandim",
  },
  notifyUser: false,
});

function sendToAllWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args);
  }
}

autoUpdater.on("update-available", () => {
  console.log("Auto-updater: update available, downloading...");
  sendToAllWindows("update:available");
});

autoUpdater.on("update-downloaded", (_event, _releaseNotes, releaseName) => {
  const version = releaseName ?? "latest";
  console.log(`Auto-updater: update downloaded — ${version}`);
  sendToAllWindows("update:downloaded", { version });
});

autoUpdater.on("error", (error) => {
  console.error("Auto-updater error:", error);
});

export function registerAutoUpdateIpc(): void {
  ipcMain.on("update:install", () => {
    autoUpdater.quitAndInstall();
  });
}
