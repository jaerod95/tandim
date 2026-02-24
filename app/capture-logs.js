// Run this in the Electron DevTools Console to capture logs to a file
// Usage: Copy this entire file content and paste into DevTools console

const fs = require("fs");
const path = require("path");
const logFile = path.join(__dirname, "electron-debug.log");

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function writeToFile(level, args) {
  const timestamp = new Date().toISOString();
  const message = args
    .map((arg) =>
      typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
    )
    .join(" ");
  const line = `[${timestamp}] [${level}] ${message}\n`;

  fs.appendFileSync(logFile, line);
  return message;
}

console.log = function (...args) {
  writeToFile("LOG", args);
  originalLog.apply(console, args);
};

console.error = function (...args) {
  writeToFile("ERROR", args);
  originalError.apply(console, args);
};

console.warn = function (...args) {
  writeToFile("WARN", args);
  originalWarn.apply(console, args);
};

console.log("📝 Logging to:", logFile);
console.log("✅ Console capture enabled!");
