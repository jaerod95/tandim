import { autoUpdater } from "electron-updater";
import type { UpdateInfo } from "electron-updater";
import { BrowserWindow, ipcMain } from "electron";

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function sendToAllWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args);
  }
}

autoUpdater.on("checking-for-update", () => {
  console.log("Auto-updater: checking for update...");
});

autoUpdater.on("update-available", (info: UpdateInfo) => {
  console.log(`Auto-updater: update available — v${info.version}`);
  sendToAllWindows("update:available", { version: info.version });
});

autoUpdater.on("update-not-available", () => {
  console.log("Auto-updater: no update available");
});

autoUpdater.on("download-progress", (progress) => {
  console.log(`Auto-updater: download progress ${progress.percent.toFixed(1)}%`);
  sendToAllWindows("update:progress", { percent: progress.percent });
});

autoUpdater.on("update-downloaded", () => {
  console.log("Auto-updater: update downloaded");
  sendToAllWindows("update:downloaded");
});

autoUpdater.on("error", (error) => {
  console.error("Auto-updater error:", error);
});

export function checkForUpdates(): void {
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.error("Auto-updater: failed to check for updates:", err);
  });
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err: unknown) => {
    console.error("Auto-updater: failed to download update:", err);
  });
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall();
}

export function registerAutoUpdateIpc(): void {
  ipcMain.on("update:check", () => checkForUpdates());
  ipcMain.on("update:download", () => downloadUpdate());
  ipcMain.on("update:install", () => installUpdate());
}
