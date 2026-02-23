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

const createWindow = () => {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
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
  mainWindow = createWindow();
  ipcMain.handle("deep-link:getPendingRoom", () => pendingRoomId);
});

app.on("window-all-closed", () => {
  app.quit();
});
