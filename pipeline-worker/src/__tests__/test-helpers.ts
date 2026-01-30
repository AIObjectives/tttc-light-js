/**
 * Test helpers for integration tests
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Check if Docker is available and running
 * Used to conditionally skip integration tests that require testcontainers
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync("docker ps", { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Skip test suite if Docker is not available
 * Call this at the top of describe blocks that use testcontainers
 */
export async function skipIfNoDocker(): Promise<void> {
  const available = await isDockerAvailable();
  if (!available) {
    console.warn(
      "Skipping tests: Docker not available. Integration tests require Docker/Podman.",
    );
  }
}
