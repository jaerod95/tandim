import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Menu,
  Tray,
  nativeImage,
  powerMonitor,
} from "electron";
import path from "node:path";
import crypto from "node:crypto";
import started from "electron-squirrel-startup";
import { parseTandimDeepLink, type DeepLinkRoute } from "./deepLink";
import { createTrayIcon, TrayStatus } from "./trayIcon";
import { registerAutoUpdateIpc } from "./autoUpdater";

if (started) {
  app.quit();
}

type CallSession = {
  apiUrl: string;
  workspaceId: string;
  roomId: string;
  displayName: string;
  userId: string;
  audioEnabled: boolean;
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentTrayStatus: TrayStatus = "available";
let isQuitting = false;
let dndEnabled = false;
let pendingDeepLink: DeepLinkRoute | null = null;
const callSessions = new Map<string, CallSession>();

const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

function getBaseUrl(): string {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return MAIN_WINDOW_VITE_DEV_SERVER_URL;
  }
  return `file://${path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`;
}

function showLobbyWindow(): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function createLobbyWindow(): BrowserWindow {
  const window = new BrowserWindow({
    title: "Tandim",
    width: 1320,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  window.loadURL(getBaseUrl());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.webContents.openDevTools();
  }

  // On macOS, hide the window instead of destroying it when the user
  // clicks the red close button. The app stays alive in the tray.
  window.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on("closed", () => {
    mainWindow = null;
  });

  return window;
}

function createCallWindow(sessionId: string): BrowserWindow {
  const session = callSessions.get(sessionId);
  const roomName = session?.roomId ?? "Call";

  const window = new BrowserWindow({
    title: `Tandim — ${roomName}`,
    width: 960,
    height: 640,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const url = `${getBaseUrl()}#call?sessionId=${sessionId}`;
  window.loadURL(url);

  window.on("closed", () => {
    callSessions.delete(sessionId);
  });

  return window;
}

// Tray

function buildTrayContextMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: "Show Tandim",
      click: showLobbyWindow,
    },
    { type: "separator" },
    {
      label: "Available",
      type: "radio",
      checked: currentTrayStatus === "available",
      click: () => updateTrayStatus("available"),
    },
    {
      label: "Do Not Disturb",
      type: "radio",
      checked: currentTrayStatus === "dnd",
      click: () => updateTrayStatus("dnd"),
    },
    { type: "separator" },
    {
      label: "Quit Tandim",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function updateTrayStatus(status: TrayStatus): void {
  currentTrayStatus = status;
  if (!tray) return;
  tray.setImage(createTrayIcon(status));
  tray.setToolTip(`Tandim - ${status}`);
  tray.setContextMenu(buildTrayContextMenu());
}

function createTray(): Tray {
  const icon = createTrayIcon(currentTrayStatus);
  const instance = new Tray(icon);

  instance.setToolTip(`Tandim - ${currentTrayStatus}`);
  instance.setContextMenu(buildTrayContextMenu());

  // macOS: click the tray icon to toggle lobby window visibility
  if (process.platform === "darwin") {
    instance.on("click", () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        showLobbyWindow();
      }
    });
  }

  // Windows / Linux: double-click to show the lobby window
  if (process.platform !== "darwin") {
    instance.on("double-click", () => {
      showLobbyWindow();
    });
  }

  return instance;
}

// Deep link dispatch

function handleDeepLink(route: DeepLinkRoute): void {
  if (route.type === "unknown") return;

  if (!mainWindow) {
    pendingDeepLink = route;
    return;
  }

  switch (route.type) {
    case "join-room":
      mainWindow.webContents.send("deep-link:join", {
        roomId: route.roomId,
        workspaceId: route.workspaceId,
      });
      showLobbyWindow();
      break;

    case "view-room":
      mainWindow.webContents.send("deep-link:room", route.roomId);
      showLobbyWindow();
      break;

    case "workspace":
      mainWindow.webContents.send("deep-link:workspace", {
        workspaceId: route.workspaceId,
      });
      showLobbyWindow();
      break;
  }
}

// IPC handlers

ipcMain.handle("deep-link:getPending", () => {
  const link = pendingDeepLink;
  pendingDeepLink = null;
  return link;
});

// Backward compat: old renderer code may still call getPendingRoom
ipcMain.handle("deep-link:getPendingRoom", () => {
  if (
    pendingDeepLink?.type === "view-room" ||
    pendingDeepLink?.type === "join-room"
  ) {
    const roomId = pendingDeepLink.roomId;
    pendingDeepLink = null;
    return roomId;
  }
  return null;
});

ipcMain.handle("call:openWindow", (_event, payload: CallSession) => {
  const sessionId = crypto.randomUUID();
  callSessions.set(sessionId, payload);
  createCallWindow(sessionId);
  return { sessionId };
});

ipcMain.handle("call:getSession", (_event, sessionId: string) => {
  return callSessions.get(sessionId) ?? null;
});

ipcMain.on("tray:setStatus", (_event, status: TrayStatus) => {
  updateTrayStatus(status);
});

ipcMain.on("dnd:setFromRenderer", (_event, enabled: boolean) => {
  dndEnabled = enabled;
  updateTrayStatus(enabled ? "dnd" : "available");
});

// Auto-update IPC
registerAutoUpdateIpc();

function setDnd(enabled: boolean): void {
  dndEnabled = enabled;
  updateTrayStatus(enabled ? "dnd" : "available");
  if (mainWindow) {
    mainWindow.webContents.send("dnd:toggle", enabled);
  }
}

// Deep link protocol

app.setAsDefaultProtocolClient("tandim");

app.on("open-url", (_event, url) => {
  const parsed = parseTandimDeepLink(url);
  handleDeepLink(parsed);
});

// OS-level idle detection

const IDLE_THRESHOLD_SECONDS = 300; // 5 minutes
const IDLE_POLL_INTERVAL_MS = 15_000; // 15 seconds

let isIdle = false;

function broadcastIdleState(idle: boolean): void {
  if (idle === isIdle) return;
  isIdle = idle;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("idle-state-changed", idle);
  }
}

function startIdleDetection(): void {
  setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    broadcastIdleState(idleSeconds >= IDLE_THRESHOLD_SECONDS);
  }, IDLE_POLL_INTERVAL_MS);

  powerMonitor.on("suspend", () => broadcastIdleState(true));
  powerMonitor.on("resume", () => broadcastIdleState(false));
  powerMonitor.on("lock-screen", () => broadcastIdleState(true));
  powerMonitor.on("unlock-screen", () => broadcastIdleState(false));
}

// App lifecycle

app.on("ready", () => {
  // Set dock icon on macOS
  if (process.platform === "darwin" && app.dock) {
    const iconPath = path.join(__dirname, "../src/assets/icon.png");
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
      }
    } catch {
      // Icon file may not exist in packaged app (uses icns instead)
    }
  }

  tray = createTray();
  mainWindow = createLobbyWindow();
  startIdleDetection();

  // DND keyboard shortcut
  const accelerator =
    process.platform === "darwin" ? "CommandOrControl+Shift+D" : "Ctrl+Shift+D";
  globalShortcut.register(accelerator, () => {
    setDnd(!dndEnabled);
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  // On macOS the app stays alive in the tray even when all windows close.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS: re-show the lobby when the dock icon is clicked.
app.on("activate", () => {
  if (mainWindow) {
    showLobbyWindow();
  } else {
    mainWindow = createLobbyWindow();
  }
});
