import { executableDir, join, resolve } from "@tauri-apps/api/path";

export interface WorkspaceDirectories {
  root: string;
  bin: string;
  binNginx: string;
  binPhp: string;
  binMariadb: string;
  binComposer: string;
  binMkcert: string;
  etc: string;
  etcNginx: string;
  etcNginxSites: string;
  etcNginxSsl: string;
  etcPhp: string;
  etcMariadb: string;
  www: string;
  logs: string;
  tmp: string;
  data: string;
}

let cachedRoot: string | null = null;
let cachedDirectories: WorkspaceDirectories | null = null;

/**
 * Checks if the current environment is running inside Tauri.
 */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

/**
 * Normalizes file path to use forward slashes (required for Windows Nginx configurations and cross-platform consistency).
 * Adheres strictly to RULE 3: On Windows, always normalize paths to forward slashes (/) when writing configs.
 */
export function normalizePath(pathStr: string): string {
  return pathStr.replace(/\\/g, "/");
}

/**
 * Resolves the root portable application directory.
 * In production/portable mode, this is the folder containing the executable.
 * In development mode, if running from src-tauri/target/..., resolves to the project root.
 */
export async function getAppDirectory(): Promise<string> {
  if (cachedRoot) {
    return cachedRoot;
  }

  if (!isTauri()) {
    cachedRoot = "/lados-portable";
    return cachedRoot;
  }

  try {
    const rawExeDir = await executableDir();
    let normalized = normalizePath(rawExeDir);

    // If running in development (e.g. target/debug or target/release inside src-tauri)
    const targetIdx = normalized.toLowerCase().indexOf("/src-tauri/target");
    if (targetIdx !== -1) {
      cachedRoot = normalized.substring(0, targetIdx);
    } else {
      const srcTauriIdx = normalized.toLowerCase().indexOf("/src-tauri");
      if (srcTauriIdx !== -1) {
        cachedRoot = normalized.substring(0, srcTauriIdx);
      } else {
        cachedRoot = normalized.replace(/\/+$/, "");
      }
    }
  } catch (error) {
    console.warn("Failed to get executableDir, trying resolve fallback:", error);
    try {
      const resolved = normalizePath(await resolve(".."));
      const srcTauriIdx = resolved.toLowerCase().indexOf("/src-tauri");
      if (srcTauriIdx !== -1) {
        cachedRoot = resolved.substring(0, srcTauriIdx);
      } else {
        cachedRoot = resolved.replace(/\/+$/, "");
      }
    } catch {
      cachedRoot = "D:/personal/lados";
    }
  }

  // Safety guarantee: cachedRoot must NEVER end with /src-tauri
  if (cachedRoot.toLowerCase().endsWith("/src-tauri")) {
    cachedRoot = cachedRoot.substring(0, cachedRoot.length - "/src-tauri".length);
  }

  return cachedRoot;
}

/**
 * Gets all portable workspace directory paths including service subdirectories in etc/.
 */
export async function getWorkspaceDirectories(): Promise<WorkspaceDirectories> {
  if (cachedDirectories) {
    return cachedDirectories;
  }

  const root = await getAppDirectory();

  if (!isTauri()) {
    const etc = `${root}/etc`;
    const etcNginx = `${etc}/nginx`;
    const bin = `${root}/bin`;
    cachedDirectories = {
      root,
      bin,
      binNginx: `${bin}/nginx`,
      binPhp: `${bin}/php`,
      binMariadb: `${bin}/mariadb`,
      binComposer: `${bin}/composer`,
      binMkcert: `${bin}/mkcert`,
      etc,
      etcNginx,
      etcNginxSites: `${etcNginx}/sites-enabled`,
      etcNginxSsl: `${etcNginx}/ssl`,
      etcPhp: `${etc}/php`,
      etcMariadb: `${etc}/mariadb`,
      www: `${root}/www`,
      logs: `${root}/logs`,
      tmp: `${root}/tmp`,
      data: `${root}/data`,
    };
    return cachedDirectories;
  }

  const [bin, etc, www, logs, tmp, data] = await Promise.all([
    join(root, "bin"),
    join(root, "etc"),
    join(root, "www"),
    join(root, "logs"),
    join(root, "tmp"),
    join(root, "data"),
  ]);

  const [binNginx, binPhp, binMariadb, binComposer, binMkcert, etcNginx, etcPhp, etcMariadb] =
    await Promise.all([
      join(bin, "nginx"),
      join(bin, "php"),
      join(bin, "mariadb"),
      join(bin, "composer"),
      join(bin, "mkcert"),
      join(etc, "nginx"),
      join(etc, "php"),
      join(etc, "mariadb"),
    ]);

  const [etcNginxSites, etcNginxSsl] = await Promise.all([
    join(etcNginx, "sites-enabled"),
    join(etcNginx, "ssl"),
  ]);

  cachedDirectories = {
    root: normalizePath(root),
    bin: normalizePath(bin),
    binNginx: normalizePath(binNginx),
    binPhp: normalizePath(binPhp),
    binMariadb: normalizePath(binMariadb),
    binComposer: normalizePath(binComposer),
    binMkcert: normalizePath(binMkcert),
    etc: normalizePath(etc),
    etcNginx: normalizePath(etcNginx),
    etcNginxSites: normalizePath(etcNginxSites),
    etcNginxSsl: normalizePath(etcNginxSsl),
    etcPhp: normalizePath(etcPhp),
    etcMariadb: normalizePath(etcMariadb),
    www: normalizePath(www),
    logs: normalizePath(logs),
    tmp: normalizePath(tmp),
    data: normalizePath(data),
  };

  return cachedDirectories;
}
