import { executableDir, join, resolve } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

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

export interface LadosServiceState {
  enabled: boolean;
  running: boolean;
  pid?: number | null;
  port: number;
  version?: string;
  binaryPath?: string;
  configPath?: string;
}

export interface LadosState {
  appName: string;
  version: string;
  firstInitializedAt: string;
  lastOpenedAt: string;
  workspaceRoot: string;
  activePhpVersion?: string;
  services: {
    nginx: LadosServiceState;
    php: LadosServiceState;
    mariadb: LadosServiceState;
  };
  settings: {
    autoStart: boolean;
    minimizeToTray: boolean;
    portableMode: boolean;
  };
}

let cachedRoot: string | null = null;
let cachedDirectories: WorkspaceDirectories | null = null;
let cachedState: LadosState | null = null;

/**
 * Checks if the current environment is running inside Tauri.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
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

  const [binNginx, binPhp, binMariadb, binComposer, binMkcert, etcNginx, etcPhp, etcMariadb] = await Promise.all([
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

/**
 * Creates default initial state for Lados.
 */
function createDefaultState(rootPath: string): LadosState {
  const now = new Date().toISOString();
  return {
    appName: "Lados",
    version: "0.1.0",
    firstInitializedAt: now,
    lastOpenedAt: now,
    workspaceRoot: normalizePath(rootPath),
    activePhpVersion: "8.3",
    services: {
      nginx: {
        enabled: true,
        running: false,
        port: 80,
      },
      php: {
        enabled: true,
        running: false,
        port: 9000,
      },
      mariadb: {
        enabled: true,
        running: false,
        port: 3306,
      },
    },
    settings: {
      autoStart: false,
      minimizeToTray: true,
      portableMode: true,
    },
  };
}

/**
 * Initializes the portable workspace:
 * - Creates bin/ (with mkcert/), etc/ (with nginx/, nginx/sites-enabled/, nginx/ssl/, php/, mariadb/), www/, logs/, tmp/, and data/.
 * - Creates a default index.html in www/ if newly initialized.
 * - Creates or loads state.json and updates lastOpenedAt.
 */
export async function initWorkspace(): Promise<{ directories: WorkspaceDirectories; state: LadosState }> {
  const dirs = await getWorkspaceDirectories();
  const statePath = isTauri() ? await join(dirs.root, "state.json") : `${dirs.root}/state.json`;

  if (!isTauri()) {
    // Web fallback for development preview
    const saved = localStorage.getItem("lados_state");
    let state: LadosState;
    if (saved) {
      state = JSON.parse(saved);
      state.lastOpenedAt = new Date().toISOString();
    } else {
      state = createDefaultState(dirs.root);
    }
    localStorage.setItem("lados_state", JSON.stringify(state, null, 2));
    cachedState = state;
    return { directories: dirs, state };
  }

  // 1. Ensure folders exist
  const foldersToCreate = [
    dirs.bin,
    dirs.binNginx,
    dirs.binPhp,
    dirs.binMariadb,
    dirs.binComposer,
    dirs.binMkcert,
    dirs.etc,
    dirs.etcNginx,
    dirs.etcNginxSites,
    dirs.etcNginxSsl,
    dirs.etcPhp,
    dirs.etcMariadb,
    dirs.www,
    dirs.logs,
    dirs.tmp,
    dirs.data,
  ];

  for (const folder of foldersToCreate) {
    const dirExists = await exists(folder);
    if (!dirExists) {
      await mkdir(folder, { recursive: true });
    }
  }

  // 2. Ensure initial sample index.html in www/ if empty
  const defaultHtmlPath = await join(dirs.www, "index.html");
  const htmlExists = await exists(defaultHtmlPath);
  if (!htmlExists) {
    const initialHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Lados</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .card { background: #1e293b; padding: 2rem 3rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; }
    h1 { color: #38bdf8; margin-top: 0; }
    p { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Lados Local Server</h1>
    <p>Your web root is ready at <code>www/</code>.</p>
  </div>
</body>
</html>`;
    await writeTextFile(defaultHtmlPath, initialHtml);
  }

  // 3. Ensure state.json exists and is updated
  let state: LadosState;
  const stateExists = await exists(statePath);

  if (stateExists) {
    try {
      const stateContent = await readTextFile(statePath);
      state = JSON.parse(stateContent);
      state.lastOpenedAt = new Date().toISOString();
      state.workspaceRoot = normalizePath(dirs.root);
    } catch (err) {
      console.warn("Failed to parse existing state.json, re-creating:", err);
      state = createDefaultState(dirs.root);
    }
  } else {
    state = createDefaultState(dirs.root);
  }

  await writeTextFile(statePath, JSON.stringify(state, null, 2));
  cachedState = state;

  return { directories: dirs, state };
}

/**
 * Loads the current state from state.json.
 */
export async function loadState(): Promise<LadosState> {
  const dirs = await getWorkspaceDirectories();
  const statePath = isTauri() ? await join(dirs.root, "state.json") : `${dirs.root}/state.json`;

  if (!isTauri()) {
    const saved = localStorage.getItem("lados_state");
    if (saved) {
      cachedState = JSON.parse(saved);
      return cachedState!;
    }
    return createDefaultState(dirs.root);
  }

  const content = await readTextFile(statePath);
  cachedState = JSON.parse(content);
  return cachedState!;
}

/**
 * Saves state updates into state.json.
 */
export async function saveState(updatedState: Partial<LadosState>): Promise<LadosState> {
  const current = cachedState || (await loadState());
  const merged: LadosState = {
    ...current,
    ...updatedState,
    services: {
      ...current.services,
      ...(updatedState.services || {}),
    },
    settings: {
      ...current.settings,
      ...(updatedState.settings || {}),
    },
    lastOpenedAt: new Date().toISOString(),
  };

  const dirs = await getWorkspaceDirectories();
  const statePath = isTauri() ? await join(dirs.root, "state.json") : `${dirs.root}/state.json`;

  if (!isTauri()) {
    localStorage.setItem("lados_state", JSON.stringify(merged, null, 2));
    cachedState = merged;
    return merged;
  }

  await writeTextFile(statePath, JSON.stringify(merged, null, 2));
  cachedState = merged;
  return merged;
}

/**
 * Returns the currently cached state in memory.
 */
export function getCachedState(): LadosState | null {
  return cachedState;
}
