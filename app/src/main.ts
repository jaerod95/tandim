import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { parseTandemDeepLink } from "./deepLink";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let pendingRoomId: string | null = null;
const callSessions = new Map<
  string,
  { apiUrl: string; workspaceId: string; roomId: string; displayName: string; userId: string }
>();

function registerIpcHandlers(): void {
  ipcMain.removeHandler("deep-link:getPendingRoom");
  ipcMain.removeHandler("call:openWindow");
  ipcMain.removeHandler("call:getSession");

  ipcMain.handle("deep-link:getPendingRoom", () => pendingRoomId);
  ipcMain.handle(
    "call:openWindow",
    (
      _event,
      payload: { apiUrl: string; workspaceId: string; roomId: string; displayName: string; userId: string }
    ) => {
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      callSessions.set(sessionId, payload);
      createCallWindow(sessionId);
      return { sessionId };
    }
  );
  ipcMain.handle("call:getSession", (_event, sessionId: string) => {
    return callSessions.get(sessionId) ?? null;
  });
}

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1320,
    height: 840,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return window;
};

function createCallWindow(sessionId: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 760,
    title: "Tandim Call",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#call?sessionId=${encodeURIComponent(sessionId)}`);
  } else {
    window.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`), {
      hash: `call?sessionId=${encodeURIComponent(sessionId)}`
    });
  }

  return window;
}

function handleDeepLink(url: string): void {
  const parsed = parseTandemDeepLink(url);
  if (parsed.type !== "room") {
    return;
  }

  pendingRoomId = parsed.roomId;
  if (mainWindow) {
    mainWindow.webContents.send("deep-link:room", parsed.roomId);
  }
}

if (process.defaultApp && process.argv.length >= 2) {
  const deepLinkArg = process.argv.find((arg) => arg.startsWith("tandim://"));
  if (deepLinkArg) {
    handleDeepLink(deepLinkArg);
  }
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on("ready", () => {
  registerIpcHandlers();
  mainWindow = createWindow();
});

app.on("window-all-closed", () => {
  app.quit();
});
