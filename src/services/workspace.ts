import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  type WorkspaceDirectories,
  isTauri,
  normalizePath,
  getAppDirectory,
  getWorkspaceDirectories,
} from "./workspacePaths";
import {
  type LadosServiceState,
  type LadosState,
  createDefaultState,
  loadState,
  saveState,
  getCachedState,
  setCachedState,
} from "./workspaceState";

// Re-export all path helpers, state managers, and interfaces for zero-breaking backward compatibility
export type { WorkspaceDirectories, LadosServiceState, LadosState };
export {
  isTauri,
  normalizePath,
  getAppDirectory,
  getWorkspaceDirectories,
  createDefaultState,
  loadState,
  saveState,
  getCachedState,
};

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
    setCachedState(state);
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
  setCachedState(state);

  return { directories: dirs, state };
}
