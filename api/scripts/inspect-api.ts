#!/usr/bin/env node
/**
 * Script to inspect the running API server
 */

const apiUrl = process.env.API_URL || "http://localhost:3000";

interface DebugCommand {
  name: string;
  description: string;
  endpoint: string;
}

const commands: DebugCommand[] = [
  { name: "health", description: "Check server health", endpoint: "/api/debug/health" },
  { name: "stats", description: "Get server statistics", endpoint: "/api/debug/stats" },
  { name: "rooms", description: "List all active rooms", endpoint: "/api/debug/rooms" },
  { name: "sockets", description: "List all connected sockets", endpoint: "/api/debug/sockets" },
];

async function runCommand(command: DebugCommand): Promise<void> {
  console.log(`\n=== ${command.description} ===`);
  try {
    const response = await fetch(`${apiUrl}${command.endpoint}`);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (!command) {
    console.log("Usage: tsx scripts/inspect-api.ts <command>");
    console.log("\nAvailable commands:");
    commands.forEach((cmd) => {
      console.log(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
    });
    return;
  }

  const cmd = commands.find((c) => c.name === command);
  if (!cmd) {
    console.error(`Unknown command: ${command}`);
    return;
  }

  await runCommand(cmd);
}

main().catch(console.error);
