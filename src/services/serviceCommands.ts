import { Command } from "@tauri-apps/plugin-shell";
import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { normalizePath, type WorkspaceDirectories, isTauri, ensureMariaDbData } from "./workspace";
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

  let programName = "nginx";
  if (isTauri()) {
    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const exeName = isWindows ? "nginx.exe" : "nginx";
    const portableExe = normalizePath(await join(dirs.binNginx, exeName));
    if (await exists(portableExe)) {
      programName = "bin-nginx";
    }
  }

  const command = Command.create(programName, args, {
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

  let programName = "nginx";
  if (isTauri()) {
    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const exeName = isWindows ? "nginx.exe" : "nginx";
    const portableExe = normalizePath(await join(dirs.binNginx, exeName));
    if (await exists(portableExe)) {
      programName = "bin-nginx";
    }
  }

  return Command.create(programName, args, {
    cwd: dirs.root,
  });
}

/**
 * Creates Command instance to spawn PHP FastCGI server (php-cgi / php-fpm).
 */
export async function createPhpCommand(
  dirs: WorkspaceDirectories,
  activePhpDir?: string
): Promise<{ command: Command<string>; args: string[]; programName: string }> {
  const phpIniPath = normalizePath(await join(dirs.etcPhp, "php.ini"));
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
  const args = ["-b", "127.0.0.1:9000", "-c", phpIniPath];

  let programName = isWindows ? "php-cgi" : "php-fpm";
  let cmdArgs = args;

  if (isTauri() && isWindows) {
    const activeJunctionExe = normalizePath(await join(dirs.binPhp, "active", "php-cgi.exe"));
    const rootPhpCgiExe = normalizePath(await join(dirs.binPhp, "php-cgi.exe"));

    if (await exists(activeJunctionExe)) {
      programName = "bin-php-cgi-active";
    } else if (await exists(rootPhpCgiExe)) {
      programName = "bin-php-cgi";
    } else if (activePhpDir) {
      const specificExe = normalizePath(await join(activePhpDir, "php-cgi.exe"));
      if (await exists(specificExe)) {
        programName = "cmd";
        cmdArgs = ["/c", `"${specificExe}" -b 127.0.0.1:9000 -c "${phpIniPath}"`];
      }
    }
  }

  const effectivePath = activePhpDir || dirs.binPhp;
  const env: Record<string, string> = {
    PHP_FCGI_MAX_REQUESTS: "0",
    PHP_FCGI_CHILDREN: "4",
  };
  if (effectivePath) {
    env.PATH = effectivePath;
  }

  const command = Command.create(programName, cmdArgs, {
    cwd: dirs.root,
    env,
    processGroup: true,
  });

  return { command, args: cmdArgs, programName };
}

/**
 * Creates Command instance to spawn MariaDB SQL Server.
 */
export async function createMariaDbCommand(dirs: WorkspaceDirectories): Promise<{ command: Command<string>; args: string[]; programName: string }> {
  // Ensure MariaDB data directory contains system database before running mysqld
  await ensureMariaDbData(dirs);

  const myIniPath = normalizePath(await join(dirs.etcMariadb, "my.ini"));
  const dataDirPath = normalizePath(dirs.data);

  const args = [
    `--defaults-file=${myIniPath}`,
    `--datadir=${dataDirPath}`,
    "--console",
  ];

  let programName = "mysqld";
  if (isTauri()) {
    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const exeName = isWindows ? "mysqld.exe" : "mariadbd";
    const portableExe = normalizePath(await join(dirs.binMariadb, "bin", exeName));
    if (await exists(portableExe)) {
      programName = isWindows ? "bin-mysqld" : "bin-mariadbd";
    }
  }

  const command = Command.create(programName, args, {
    cwd: dirs.root,
    processGroup: true,
  });

  return { command, args, programName };
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
    const isNotice = data.includes("[Note]") || data.includes("[notice]") || data.includes("[info]");
    const isExplicitError = data.includes("[ERROR]") || data.includes("Fatal error") || data.includes("Aborting");
    const logType = (isNotice && !isExplicitError) ? "stdout" : "stderr";
    processLogger.emitLog(service, logType, data);
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
