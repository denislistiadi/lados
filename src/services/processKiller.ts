import { Command, type Child } from "@tauri-apps/plugin-shell";

/**
 * Gracefully terminates a spawned process and cleanly kills the Windows process tree
 * to prevent orphaned/zombie background processes.
 */
export async function killProcess(child: Child | undefined, pid: number | null): Promise<void> {
  if (child) {
    await child.kill();
  }

  // Safety on Windows: ensure process tree is cleanly killed
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
  if (pid && isWindows) {
    try {
      const taskkillCmd = Command.create("taskkill", ["/F", "/T", "/PID", String(pid)]);
      await taskkillCmd.execute();
    } catch {
      // Process might already be dead
    }
  }
}
