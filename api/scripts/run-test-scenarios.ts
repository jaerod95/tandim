#!/usr/bin/env node
/**
 * Script to run automated test scenarios
 */

import { runAllScenarios } from "../test-utils/test-scenarios";

const apiUrl = process.env.API_URL || "http://localhost:3000";

console.log(`Running test scenarios against ${apiUrl}`);

runAllScenarios(apiUrl)
  .then((results) => {
    const failed = results.filter((r) => !r.success).length;
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Failed to run scenarios:", error);
    process.exit(1);
  });
