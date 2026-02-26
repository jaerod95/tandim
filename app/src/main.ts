import { app, BrowserWindow, ipcMain, Menu, Tray } from "electron";
import path from "node:path";
import crypto from "node:crypto";
import started from "electron-squirrel-startup";
import { parseTandemDeepLink } from "./deepLink";
import { createTrayIcon, TrayStatus } from "./trayIcon";

if (started) {
  app.quit();
}

type CallSession = {
  apiUrl: string;
  workspaceId: string;
  roomId: string;
  displayName: string;
  userId: string;
};

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentTrayStatus: TrayStatus = "available";
let isQuitting = false;
let pendingRoom: string | null = null;
const callSessions = new Map<string, CallSession>();

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

// IPC handlers

ipcMain.handle("deep-link:getPendingRoom", () => {
  const room = pendingRoom;
  pendingRoom = null;
  return room;
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

// Deep link protocol

app.setAsDefaultProtocolClient("tandim");

app.on("open-url", (_event, url) => {
  const parsed = parseTandemDeepLink(url);
  if (parsed.type === "room") {
    if (mainWindow) {
      mainWindow.webContents.send("deep-link:room", parsed.roomId);
    } else {
      pendingRoom = parsed.roomId;
    }
  }
});

// App lifecycle

app.on("ready", () => {
  tray = createTray();
  mainWindow = createLobbyWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
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
