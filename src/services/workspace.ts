import { join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
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
import { generateAllConfigs } from "./configGenerator";

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
export { phpVersionManager, type InstalledPhpVersion } from "./phpVersionManager";

/**
 * Initializes the portable workspace:
 * - Creates bin/ (with mkcert/), etc/ (with nginx/, nginx/sites-enabled/, nginx/ssl/, php/, mariadb/), www/, logs/, tmp/, and data/.
 * - Automatically initializes PHP active junction and default configs.
 * - Creates default index.php in www/ if newly initialized.
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
    await join(dirs.tmp, "client_body_temp"),
    await join(dirs.tmp, "proxy_temp"),
    await join(dirs.tmp, "fastcgi_temp"),
    await join(dirs.tmp, "uwsgi_temp"),
    await join(dirs.tmp, "scgi_temp"),
    await join(dirs.root, "temp"),
    await join(dirs.root, "temp", "client_body_temp"),
    await join(dirs.root, "temp", "proxy_temp"),
    await join(dirs.root, "temp", "fastcgi_temp"),
    await join(dirs.root, "temp", "uwsgi_temp"),
    await join(dirs.root, "temp", "scgi_temp"),
    dirs.data,
  ];

  for (const folder of foldersToCreate) {
    try {
      const dirExists = await exists(folder);
      if (!dirExists) {
        await mkdir(folder, { recursive: true });
      }
    } catch (err) {
      console.error(`Failed to create directory ${folder}:`, err);
    }
  }

  // 1b. Ensure MariaDB data directory contains system database tables
  await ensureMariaDbData(dirs);

  // 2. Ensure active PHP junction if php/8.3 exists and active junction is missing
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
  if (isWindows) {
    try {
      const php83Folder = normalizePath(await join(dirs.binPhp, "8.3"));
      const phpActiveFolder = normalizePath(await join(dirs.binPhp, "active"));
      const has83 = await exists(php83Folder);
      const hasActive = await exists(phpActiveFolder);

      if (has83 && !hasActive) {
        const linkWin = phpActiveFolder.replace(/\//g, "\\");
        const targetWin = php83Folder.replace(/\//g, "\\");
        const junctionCmd = Command.create("cmd", [
          "/c",
          `rmdir "${linkWin}" 2>nul & mklink /J "${linkWin}" "${targetWin}"`,
        ]);
        await junctionCmd.execute();
      }
    } catch (err) {
      console.warn("Notice: PHP junction check skipped:", err);
    }
  }

  // 3. Ensure initial sample index.php in www/ if empty
  const defaultPhpPath = await join(dirs.www, "index.php");
  const defaultHtmlPath = await join(dirs.www, "index.html");
  const phpFileExists = await exists(defaultPhpPath);
  const htmlFileExists = await exists(defaultHtmlPath);

  if (!phpFileExists && !htmlFileExists) {
    const initialPhp = `<?php
/**
 * Lados Local Server Stack - Welcome Page
 */
$phpVersion = phpversion();
$serverSoftware = $_SERVER['SERVER_SOFTWARE'] ?? 'Nginx';
$documentRoot = __DIR__;
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lados Local Stack</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1.5rem; box-sizing: border-box; }
    .card { background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(99, 102, 241, 0.25); padding: 2.5rem; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); text-align: center; max-width: 480px; width: 100%; backdrop-filter: blur(12px); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-weight: 700; font-size: 11px; border-radius: 999px; text-transform: uppercase; margin-bottom: 16px; }
    .dot { width: 6px; height: 6px; border-radius: 999px; background: #34d399; }
    h1 { color: #fff; margin: 0 0 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
    p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 20px; }
    .info { background: #020617; border-radius: 14px; padding: 14px; font-family: ui-monospace, monospace; font-size: 11.5px; text-align: left; color: #38bdf8; space-y: 6px; border: 1px solid rgba(255,255,255,0.05); }
    .info-row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); }
    .info-row:last-child { border-bottom: none; }
    .label { color: #64748b; }
    .val { color: #e2e8f0; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> Online &amp; Ready</div>
    <h1>LADOS Server Stack</h1>
    <p>Portable Local Development Environment running completely offline.</p>
    <div class="info">
      <div class="info-row"><span class="label">PHP Version:</span><span class="val"><?php echo $phpVersion; ?></span></div>
      <div class="info-row"><span class="label">Server Engine:</span><span class="val"><?php echo $serverSoftware; ?></span></div>
      <div class="info-row"><span class="label">Web Root:</span><span class="val"><?php echo $documentRoot; ?></span></div>
    </div>
  </div>
</body>
</html>\r\n`;
    await writeTextFile(defaultPhpPath, initialPhp);
  }

  // 4. Ensure state.json exists and is updated
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

  // 5. Automatically write initial configuration files (nginx.conf, php.ini, my.ini)
  try {
    const activePhp = state.activePhpPath || normalizePath(await join(dirs.binPhp, "8.3"));
    await generateAllConfigs(dirs, activePhp);
  } catch (err) {
    console.warn("Initial config generation notice:", err);
  }

  return { directories: dirs, state };
}

/**
 * Recursively copies a directory tree using @tauri-apps/plugin-fs.
 */
export async function copyDirectoryRecursive(src: string, dest: string): Promise<void> {
  const destExists = await exists(dest);
  if (!destExists) {
    await mkdir(dest, { recursive: true });
  }
  const entries = await readDir(src);
  for (const entry of entries) {
    const srcChild = normalizePath(await join(src, entry.name));
    const destChild = normalizePath(await join(dest, entry.name));
    if (entry.isDirectory) {
      await copyDirectoryRecursive(srcChild, destChild);
    } else if (entry.isFile) {
      await copyFile(srcChild, destChild);
    }
  }
}

/**
 * Ensures that MariaDB data directory contains the required system tables (mysql/).
 * If missing, copies pristine system tables from bin/mariadb/data or runs mariadb-install-db.
 */
export async function ensureMariaDbData(dirs: WorkspaceDirectories): Promise<void> {
  if (!isTauri()) return;

  try {
    const mysqlSystemDb = normalizePath(await join(dirs.data, "mysql"));
    const hasMysqlDb = await exists(mysqlSystemDb);
    if (hasMysqlDb) {
      return;
    }

    const templateData = normalizePath(await join(dirs.binMariadb, "data"));
    const templateMysql = normalizePath(await join(templateData, "mysql"));
    const hasTemplate = (await exists(templateData)) && (await exists(templateMysql));

    if (hasTemplate) {
      const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
      let copySuccess = false;

      // Fast-path on Windows using PowerShell Copy-Item
      if (isWindows) {
        try {
          const srcWin = templateData.replace(/\//g, "\\");
          const destWin = dirs.data.replace(/\//g, "\\");
          const psCmd = Command.create("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `Copy-Item -Path '${srcWin}\\*' -Destination '${destWin}' -Recurse -Force`,
          ]);
          const result = await psCmd.execute();
          if (result.code === 0 && (await exists(mysqlSystemDb))) {
            copySuccess = true;
          }
        } catch (psErr) {
          console.warn("Notice: PowerShell copy attempt:", psErr);
        }
      }

      // Universal fallback using native Tauri plugin-fs
      if (!copySuccess) {
        await copyDirectoryRecursive(templateData, dirs.data);
      }
    } else {
      const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
      const exeName = isWindows ? "mariadb-install-db.exe" : "mariadb-install-db";
      const installDbExe = normalizePath(await join(dirs.binMariadb, "bin", exeName));

      if (await exists(installDbExe)) {
        if (isWindows) {
          const exeWin = installDbExe.replace(/\//g, "\\");
          const dataWin = dirs.data.replace(/\//g, "\\");
          const initCmd = Command.create("powershell", [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            `& '${exeWin}' --datadir='${dataWin}'`,
          ]);
          await initCmd.execute();
        } else {
          const cmd = Command.create("bin-mariadb-install-db", [`--datadir=${dirs.data}`]);
          await cmd.execute();
        }
      }
    }
  } catch (err) {
    console.warn("Notice: MariaDB data initialization check:", err);
  }
}

