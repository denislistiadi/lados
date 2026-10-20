import { Command } from "@tauri-apps/plugin-shell";
import { join } from "@tauri-apps/api/path";
import { normalizePath, type WorkspaceDirectories } from "./workspace";
import type { ServiceType } from "./processTypes";
import { processLogger } from "./processLogger";
import { serviceStateManager } from "./serviceState";

/**
 * Creates Command instance to spawn Nginx in portable mode.
 * Adheres strictly to RULE 3: Forward slashes for Nginx paths on Windows.
 */
export async function createNginxCommand(dirs: WorkspaceDirectories): Promise<{ command: Command<string>; args: string[] }> {
  const normRoot = normalizePath(dirs.root);
  const configPath = normalizePath(await join(dirs.etcNginx, "nginx.conf"));
  const args = ["-p", normRoot, "-c", configPath, "-g", "daemon off;"];

  const command = Command.create("nginx", args, {
    cwd: dirs.root,
    processGroup: true,
  });

  return { command, args };
}

/**
 * Creates Command instance to reload Nginx configuration without downtime.
 */
export async function createNginxReloadCommand(dirs: WorkspaceDirectories): Promise<Command<string>> {
  const normRoot = normalizePath(dirs.root);
  const configPath = normalizePath(await join(dirs.etcNginx, "nginx.conf"));
  const args = ["-p", normRoot, "-c", configPath, "-s", "reload"];

  return Command.create("nginx", args, {
    cwd: dirs.root,
  });
}

/**
 * Creates Command instance to spawn PHP FastCGI server (php-cgi / php-fpm).
 */
export async function createPhpCommand(dirs: WorkspaceDirectories): Promise<{ command: Command<string>; args: string[]; programName: string }> {
  const phpIniPath = normalizePath(await join(dirs.etcPhp, "php.ini"));
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
  const programName = isWindows ? "php-cgi" : "php-fpm";
  const args = ["-b", "127.0.0.1:9000", "-c", phpIniPath];

  const command = Command.create(programName, args, {
    cwd: dirs.root,
    env: {
      PHP_FCGI_MAX_REQUESTS: "0",
      PHP_FCGI_CHILDREN: "4",
    },
    processGroup: true,
  });

  return { command, args, programName };
}

/**
 * Creates Command instance to spawn MariaDB SQL Server.
 */
export async function createMariaDbCommand(dirs: WorkspaceDirectories): Promise<{ command: Command<string>; args: string[] }> {
  const myIniPath = normalizePath(await join(dirs.etcMariadb, "my.ini"));
  const dataDirPath = normalizePath(dirs.data);

  const args = [
    `--defaults-file=${myIniPath}`,
    `--datadir=${dataDirPath}`,
    "--console",
  ];

  const command = Command.create("mysqld", args, {
    cwd: dirs.root,
    processGroup: true,
  });

  return { command, args };
}

/**
 * Binds stdout, stderr, error, and close listeners to a spawned service Command.
 */
export function bindProcessEvents(
  service: ServiceType,
  command: Command<string>,
  onClose: () => void
): void {
  command.stdout.on("data", (data: string) => {
    processLogger.emitLog(service, "stdout", data);
  });

  command.stderr.on("data", (data: string) => {
    processLogger.emitLog(service, "stderr", data);
  });

  command.on("error", (error: string) => {
    processLogger.emitLog(service, "stderr", `[Process Error] ${error}`);
    serviceStateManager.setStatus(service, "error", null, error);
  });

  command.on("close", (payload: { code: number | null; signal: number | null }) => {
    onClose();
    const wasRunning = serviceStateManager.getServiceInfo(service).status === "running";
    const exitMsg = `Process terminated (Exit Code: ${payload.code ?? "N/A"}, Signal: ${payload.signal ?? "N/A"})`;

    if (wasRunning && payload.code !== 0 && payload.code !== null) {
      processLogger.emitLog(service, "stderr", exitMsg);
      serviceStateManager.setStatus(service, "error", null, exitMsg);
    } else {
      processLogger.emitLog(service, "system", exitMsg);
      serviceStateManager.setStatus(service, "stopped");
    }
  });
}
