import { exists, mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { Command } from "@tauri-apps/plugin-shell";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  getWorkspaceDirectories,
  isTauri,
  normalizePath,
  loadState,
  saveState,
} from "./workspace";
import { BINARY_CATALOG, type DownloadProgress } from "./binaryCatalog";
import { extractZipArchive } from "./binaryExtractor";
import { generateAllConfigs } from "./configGenerator";
import { processManager } from "./processManager";

export interface InstalledPhpVersion {
  id: string;
  label: string;
  version: string;
  path: string;
  executablePath: string;
  cliPath: string;
  isCustom: boolean;
  isActive: boolean;
  folderName: string;
}

export function parsePhpVersionLabel(folderName: string): { label: string; version: string; isCustom: boolean } {
  // Check if matches known catalog IDs
  const catalogItem = BINARY_CATALOG.find(
    (c) => c.category === "php" && (c.id === `php-${folderName}` || c.targetSubdir === `php/${folderName}` || c.version === folderName)
  );

  if (catalogItem) {
    return {
      label: `PHP ${catalogItem.id.replace("php-", "")}`,
      version: catalogItem.version,
      isCustom: false,
    };
  }

  // Extract version numbers e.g. "php-8.1.30-nts-Win32" -> "8.1.30"
  const versionMatch = folderName.match(/(\d+\.\d+(?:\.\d+)?)/);
  const version = versionMatch ? versionMatch[1] : folderName;
  return {
    label: `PHP ${version} (Custom)`,
    version,
    isCustom: true,
  };
}

class PhpVersionManagerService {
  private cachedVersions: InstalledPhpVersion[] = [];

  public async getActivePhpPath(): Promise<string> {
    const dirs = await getWorkspaceDirectories();
    const state = await loadState();
    if (state.activePhpPath) {
      return state.activePhpPath;
    }
    return dirs.binPhp;
  }

  public async scanInstalledVersions(): Promise<InstalledPhpVersion[]> {
    const dirs = await getWorkspaceDirectories();
    const state = await loadState();
    const activeId = state.activePhpVersion || "8.3";
    const activePath = state.activePhpPath || "";

    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const exeName = isWindows ? "php-cgi.exe" : "php-fpm";
    const cliName = isWindows ? "php.exe" : "php";

    if (!isTauri()) {
      // Browser simulation mode
      const stored = localStorage.getItem("lados_custom_php_versions");
      const customList = stored ? JSON.parse(stored) : [];
      const baseVersions: InstalledPhpVersion[] = [
        {
          id: "8.4",
          label: "PHP 8.4",
          version: "8.4.4",
          path: `${dirs.binPhp}/8.4`,
          executablePath: `${dirs.binPhp}/8.4/${exeName}`,
          cliPath: `${dirs.binPhp}/8.4/${cliName}`,
          isCustom: false,
          isActive: activeId === "8.4",
          folderName: "8.4",
        },
        {
          id: "8.3",
          label: "PHP 8.3",
          version: "8.3.17",
          path: `${dirs.binPhp}/8.3`,
          executablePath: `${dirs.binPhp}/8.3/${exeName}`,
          cliPath: `${dirs.binPhp}/8.3/${cliName}`,
          isCustom: false,
          isActive: activeId === "8.3",
          folderName: "8.3",
        },
        ...customList.map((c: Partial<InstalledPhpVersion>) => ({
          ...c,
          isActive: activeId === c.id,
        })),
      ];
      this.cachedVersions = baseVersions;
      return this.cachedVersions;
    }

    try {
      const phpDirExists = await exists(dirs.binPhp);
      if (!phpDirExists) {
        await mkdir(dirs.binPhp, { recursive: true });
      }

      const results: InstalledPhpVersion[] = [];

      // 1. Check legacy/root bin/php folder
      const rootExe = normalizePath(await join(dirs.binPhp, exeName));
      if (await exists(rootExe)) {
        results.push({
          id: "default",
          label: "PHP (Default / bin/php)",
          version: "default",
          path: dirs.binPhp,
          executablePath: rootExe,
          cliPath: normalizePath(await join(dirs.binPhp, cliName)),
          isCustom: false,
          isActive: activeId === "default" || activePath === dirs.binPhp,
          folderName: "default",
        });
      }

      // 2. Scan subdirectories in bin/php/
      const entries = await readDir(dirs.binPhp);
      for (const entry of entries) {
        if (!entry.isDirectory || entry.name === "active") continue;

        const subDir = normalizePath(await join(dirs.binPhp, entry.name));
        const subExe = normalizePath(await join(subDir, exeName));
        const subCli = normalizePath(await join(subDir, cliName));

        const hasCgi = await exists(subExe);
        const hasCli = await exists(subCli);

        if (hasCgi || hasCli) {
          const { label, version, isCustom } = parsePhpVersionLabel(entry.name);
          const isCurrentActive = activeId === entry.name || (activePath && activePath === subDir);

          results.push({
            id: entry.name,
            label,
            version,
            path: subDir,
            executablePath: subExe,
            cliPath: subCli,
            isCustom,
            isActive: Boolean(isCurrentActive),
            folderName: entry.name,
          });
        }
      }

      this.cachedVersions = results;
      return results;
    } catch (err) {
      console.warn("Failed to scan installed PHP versions:", err);
      return [];
    }
  }

  public async installFromZip(
    fileData: ArrayBuffer | Uint8Array,
    rawName: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<InstalledPhpVersion> {
    const dirs = await getWorkspaceDirectories();
    const cleanName = rawName.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9._-]/g, "_");
    const targetFolder = normalizePath(await join(dirs.binPhp, cleanName));

    processManager.emitLog("system", "system", `[PHP Manager] Unpacking custom PHP archive into ${targetFolder}...`);

    if (!isTauri()) {
      // Simulation mode
      const parsed = parsePhpVersionLabel(cleanName);
      const mockVer: InstalledPhpVersion = {
        id: cleanName,
        label: parsed.label,
        version: parsed.version,
        path: targetFolder,
        executablePath: `${targetFolder}/php-cgi.exe`,
        cliPath: `${targetFolder}/php.exe`,
        isCustom: true,
        isActive: false,
        folderName: cleanName,
      };
      const stored = localStorage.getItem("lados_custom_php_versions");
      const list = stored ? JSON.parse(stored) : [];
      list.push(mockVer);
      localStorage.setItem("lados_custom_php_versions", JSON.stringify(list));
      return mockVer;
    }

    const folderExists = await exists(targetFolder);
    if (!folderExists) {
      await mkdir(targetFolder, { recursive: true });
    }

    const buffer = fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
    const mockItem = {
      id: `php-${cleanName}`,
      name: `PHP ${cleanName}`,
      category: "php" as const,
      version: cleanName,
      description: "Custom self-downloaded PHP package",
      downloadUrl: { windows: "" },
      targetSubdir: `php/${cleanName}`,
      isZip: true,
      executableName: { windows: "php-cgi.exe", linux: "php-fpm" },
    };

    await extractZipArchive(mockItem, buffer, targetFolder, buffer.length, buffer.length, onProgress);

    processManager.emitLog("system", "system", `[PHP Manager] Extracted ${cleanName} successfully.`);
    const installed = await this.scanInstalledVersions();
    const found = installed.find((v) => v.id === cleanName || v.path === targetFolder);
    if (found) return found;

    const parsed = parsePhpVersionLabel(cleanName);
    return {
      id: cleanName,
      label: parsed.label,
      version: parsed.version,
      path: targetFolder,
      executablePath: normalizePath(await join(targetFolder, "php-cgi.exe")),
      cliPath: normalizePath(await join(targetFolder, "php.exe")),
      isCustom: true,
      isActive: false,
      folderName: cleanName,
    };
  }

  public async setActiveVersion(versionId: string): Promise<InstalledPhpVersion | null> {
    const dirs = await getWorkspaceDirectories();
    const versions = await this.scanInstalledVersions();
    const target = versions.find((v) => v.id === versionId || v.folderName === versionId);
    if (!target) {
      console.warn(`[PHP Manager] Version ${versionId} not found.`);
      return null;
    }

    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    if (isTauri() && isWindows) {
      try {
        const linkPath = `${dirs.binPhp}/active`.replace(/\//g, "\\");
        const targetPath = target.path.replace(/\//g, "\\");
        const switchCmd = Command.create("cmd", [
          "/c",
          `rmdir "${linkPath}" 2>nul & mklink /J "${linkPath}" "${targetPath}"`,
        ]);
        await switchCmd.execute();
      } catch (err) {
        console.warn("Failed to switch PHP junction:", err);
      }
    }

    await saveState({
      activePhpVersion: target.id,
      activePhpPath: target.path,
    });

    // Automatically regenerate php.ini with updated extension_dir
    await generateAllConfigs(dirs, target.path);

    processManager.emitLog(
      "system",
      "system",
      `[PHP Manager] Switched active PHP to ${target.label} (${target.path}).`
    );

    return target;
  }

  public async deleteCustomVersion(versionId: string): Promise<boolean> {
    const versions = await this.scanInstalledVersions();
    const target = versions.find((v) => v.id === versionId);
    if (!target || target.isActive) return false;

    if (!isTauri()) {
      const stored = localStorage.getItem("lados_custom_php_versions");
      if (stored) {
        const list = JSON.parse(stored).filter((v: { id: string }) => v.id !== versionId);
        localStorage.setItem("lados_custom_php_versions", JSON.stringify(list));
      }
      return true;
    }

    try {
      await remove(target.path, { recursive: true });
      processManager.emitLog("system", "system", `[PHP Manager] Deleted PHP version ${target.label}.`);
      return true;
    } catch (err) {
      console.error("Failed to delete custom PHP version:", err);
      return false;
    }
  }

  public async openPhpDirectory(): Promise<void> {
    const dirs = await getWorkspaceDirectories();
    if (isTauri()) {
      await openPath(dirs.binPhp);
    } else {
      console.log("[Simulation] Open directory:", dirs.binPhp);
    }
  }
}

export const phpVersionManager = new PhpVersionManagerService();
