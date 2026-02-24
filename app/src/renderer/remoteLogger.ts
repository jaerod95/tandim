/**
 * Remote Logger - Sends console logs to API server for debugging
 */

const API_URL = "http://localhost:3000";
const SOURCE = "electron";

interface LogMessage {
  source: string;
  level: "log" | "error" | "warn" | "info";
  message: string;
  timestamp: string;
  data?: any;
}

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};

// Queue for batching logs
let logQueue: LogMessage[] = [];
let flushTimer: number | undefined;

function sendLog(log: LogMessage) {
  logQueue.push(log);

  // Batch logs and send every 100ms
  if (flushTimer) {
    window.clearTimeout(flushTimer);
  }

  flushTimer = window.setTimeout(() => {
    if (logQueue.length === 0) return;

    const logsToSend = [...logQueue];
    logQueue = [];

    // Send in background, don't wait
    fetch(`${API_URL}/api/debug/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: logsToSend }),
      mode: "cors",
    }).catch(() => {
      // Silently fail - don't want logging to break the app
    });
  }, 100);
}

function formatArgs(args: any[]): { message: string; data?: any } {
  if (args.length === 0) {
    return { message: "" };
  }

  const message = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");

  const data = args.length > 1 ? args.slice(1) : undefined;

  return { message, data };
}

export function enableRemoteLogging() {
  console.log = function (...args: any[]) {
    originalConsole.log.apply(console, args);
    const { message, data } = formatArgs(args);
    sendLog({
      source: SOURCE,
      level: "log",
      message,
      timestamp: new Date().toISOString(),
      data,
    });
  };

  console.error = function (...args: any[]) {
    originalConsole.error.apply(console, args);
    const { message, data } = formatArgs(args);
    sendLog({
      source: SOURCE,
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      data,
    });
  };

  console.warn = function (...args: any[]) {
    originalConsole.warn.apply(console, args);
    const { message, data } = formatArgs(args);
    sendLog({
      source: SOURCE,
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      data,
    });
  };

  console.info = function (...args: any[]) {
    originalConsole.info.apply(console, args);
    const { message, data } = formatArgs(args);
    sendLog({
      source: SOURCE,
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      data,
    });
  };

  originalConsole.log("🔌 Remote logging enabled for Electron");
}

export function disableRemoteLogging() {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
}
