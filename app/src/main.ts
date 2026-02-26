import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import crypto from "node:crypto";
import started from "electron-squirrel-startup";
import { parseTandemDeepLink } from "./deepLink";

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
let pendingRoom: string | null = null;
const callSessions = new Map<string, CallSession>();

function getBaseUrl(): string {
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    return MAIN_WINDOW_VITE_DEV_SERVER_URL;
  }
  return `file://${path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`;
}

function createLobbyWindow(): BrowserWindow {
  const window = new BrowserWindow({
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

  return window;
}

function createCallWindow(sessionId: string): BrowserWindow {
  const window = new BrowserWindow({
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
  mainWindow = createLobbyWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
