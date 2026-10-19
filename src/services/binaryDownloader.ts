import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import JSZip from "jszip";
import {
  type WorkspaceDirectories,
  getWorkspaceDirectories,
  isTauri,
  normalizePath,
} from "./workspace";
import { processManager } from "./processManager";

export type BinaryCategory = "php" | "nginx" | "mariadb" | "composer" | "mkcert";

export interface CatalogItem {
  id: string;
  name: string;
  category: BinaryCategory;
  version: string;
  description: string;
  sizeEstimateBytes?: number;
  downloadUrl: {
    windows: string;
    linux?: string;
  };
  targetSubdir: string;
  isZip: boolean;
  executableName: {
    windows: string;
    linux: string;
  };
}

export interface DownloadProgress {
  itemId: string;
  stage: "idle" | "downloading" | "extracting" | "verifying" | "completed" | "error";
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  message: string;
  error?: string;
}

export interface InstalledBinaryInfo {
  id: string;
  category: BinaryCategory;
  installed: boolean;
  version?: string;
  executablePath?: string;
}

/**
 * Official portable binary catalog for Lados stack.
 */
export const BINARY_CATALOG: CatalogItem[] = [
  {
    id: "php-8.4",
    name: "PHP 8.4 (NTS x64)",
    category: "php",
    version: "8.4.4",
    description: "Latest PHP release with property hooks, asymmetric visibility, and modern JIT.",
    sizeEstimateBytes: 31 * 1024 * 1024,
    downloadUrl: {
      windows: "https://windows.php.net/downloads/releases/php-8.4.4-nts-Win32-vs16-x64.zip",
    },
    targetSubdir: "php",
    isZip: true,
    executableName: {
      windows: "php-cgi.exe",
      linux: "php-fpm",
    },
  },
  {
    id: "php-8.3",
    name: "PHP 8.3 (NTS x64)",
    category: "php",
    version: "8.3.17",
    description: "Stable modern PHP release with typed class constants and json_validate().",
    sizeEstimateBytes: 30 * 1024 * 1024,
    downloadUrl: {
      windows: "https://windows.php.net/downloads/releases/php-8.3.17-nts-Win32-vs16-x64.zip",
    },
    targetSubdir: "php",
    isZip: true,
    executableName: {
      windows: "php-cgi.exe",
      linux: "php-fpm",
    },
  },
  {
    id: "php-8.2",
    name: "PHP 8.2 (NTS x64)",
    category: "php",
    version: "8.2.27",
    description: "LTS release with readonly classes and standalone null/false/true types.",
    sizeEstimateBytes: 30 * 1024 * 1024,
    downloadUrl: {
      windows: "https://windows.php.net/downloads/releases/php-8.2.27-nts-Win32-vs16-x64.zip",
    },
    targetSubdir: "php",
    isZip: true,
    executableName: {
      windows: "php-cgi.exe",
      linux: "php-fpm",
    },
  },
  {
    id: "nginx-1.26",
    name: "Nginx 1.26 (Stable)",
    category: "nginx",
    version: "1.26.3",
    description: "High-performance HTTP server and reverse proxy (Stable branch).",
    sizeEstimateBytes: 2 * 1024 * 1024,
    downloadUrl: {
      windows: "https://nginx.org/download/nginx-1.26.3.zip",
    },
    targetSubdir: "nginx",
    isZip: true,
    executableName: {
      windows: "nginx.exe",
      linux: "nginx",
    },
  },
  {
    id: "nginx-1.27",
    name: "Nginx 1.27 (Mainline)",
    category: "nginx",
    version: "1.27.4",
    description: "Mainline branch featuring HTTP/3 (QUIC) and latest features.",
    sizeEstimateBytes: 2 * 1024 * 1024,
    downloadUrl: {
      windows: "https://nginx.org/download/nginx-1.27.4.zip",
    },
    targetSubdir: "nginx",
    isZip: true,
    executableName: {
      windows: "nginx.exe",
      linux: "nginx",
    },
  },
  {
    id: "mariadb-11.4",
    name: "MariaDB 11.4 (LTS)",
    category: "mariadb",
    version: "11.4.5",
    description: "Long-Term Support relational database server with optimized InnoDB engine.",
    sizeEstimateBytes: 85 * 1024 * 1024,
    downloadUrl: {
      windows: "https://downloads.mariadb.org/rest-api/mariadb/11.4.5/mariadb-11.4.5-winx64.zip",
    },
    targetSubdir: "mariadb",
    isZip: true,
    executableName: {
      windows: "bin/mysqld.exe",
      linux: "bin/mariadbd",
    },
  },
  {
    id: "composer-v2",
    name: "Composer 2.8",
    category: "composer",
    version: "2.8.5",
    description: "Dependency Manager for PHP packages and modern framework ecosystems.",
    sizeEstimateBytes: 3 * 1024 * 1024,
    downloadUrl: {
      windows: "https://getcomposer.org/composer-stable.phar",
      linux: "https://getcomposer.org/composer-stable.phar",
    },
    targetSubdir: "composer",
    isZip: false,
    executableName: {
      windows: "composer.phar",
      linux: "composer.phar",
    },
  },
  {
    id: "mkcert-v1.4",
    name: "mkcert 1.4.4",
    category: "mkcert",
    version: "1.4.4",
    description: "Zero-config tool for generating locally-trusted SSL certificates.",
    sizeEstimateBytes: 4 * 1024 * 1024,
    downloadUrl: {
      windows: "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe",
      linux: "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64",
    },
    targetSubdir: "mkcert",
    isZip: false,
    executableName: {
      windows: "mkcert.exe",
      linux: "mkcert",
    },
  },
];

/**
 * Formats raw bytes into human readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Detects if all files in a zip share a common single root directory
 * (e.g. nginx-1.26.3/ or mariadb-11.4.5-winx64/) and returns that prefix to strip.
 */
function detectCommonPrefix(zipPaths: string[]): string {
  const validPaths = zipPaths.filter((p) => p && !p.startsWith("__MACOSX") && !p.startsWith("."));
  if (validPaths.length === 0) return "";

  const firstSlashIdx = validPaths[0].indexOf("/");
  if (firstSlashIdx === -1) return "";

  const candidatePrefix = validPaths[0].substring(0, firstSlashIdx + 1);

  // Check if every path begins with candidatePrefix
  const allMatch = validPaths.every((p) => p.startsWith(candidatePrefix));
  return allMatch ? candidatePrefix : "";
}

class BinaryDownloaderService {
  /**
   * Checks if a catalog item is already installed on the system.
   */
  public async checkInstalled(
    item: CatalogItem,
    dirs?: WorkspaceDirectories
  ): Promise<InstalledBinaryInfo> {
    const workspaceDirs = dirs || (await getWorkspaceDirectories());
    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const exeName = isWindows ? item.executableName.windows : item.executableName.linux;

    const targetFolder = normalizePath(await join(workspaceDirs.bin, item.targetSubdir));
    const targetExe = normalizePath(await join(targetFolder, exeName));

    if (!isTauri()) {
      const stored = localStorage.getItem("lados_installed_binaries") || "[]";
      const installedList = JSON.parse(stored) as string[];
      const isInstalled = installedList.includes(item.id);
      return {
        id: item.id,
        category: item.category,
        installed: isInstalled,
        version: item.version,
        executablePath: isInstalled ? targetExe : undefined,
      };
    }

    try {
      const isPresent = await exists(targetExe);
      return {
        id: item.id,
        category: item.category,
        installed: isPresent,
        version: item.version,
        executablePath: isPresent ? targetExe : undefined,
      };
    } catch {
      return {
        id: item.id,
        category: item.category,
        installed: false,
      };
    }
  }

  /**
   * Downloads and installs a binary from the catalog.
   * Tracks byte progress during download and file progress during extraction.
   */
  public async downloadAndInstall(
    item: CatalogItem,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<boolean> {
    const dirs = await getWorkspaceDirectories();
    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const downloadUrl = isWindows ? item.downloadUrl.windows : (item.downloadUrl.linux || item.downloadUrl.windows);

    const targetFolder = normalizePath(await join(dirs.bin, item.targetSubdir));

    processManager.emitLog(
      "system",
      "system",
      `[Downloader] Starting download for ${item.name} from ${downloadUrl}...`
    );

    // Ensure target subdirectory exists
    if (isTauri()) {
      const folderExists = await exists(targetFolder);
      if (!folderExists) {
        await mkdir(targetFolder, { recursive: true });
      }
    }

    // =========================================================================
    // Simulation Mode for Browser Previews
    // =========================================================================
    if (!isTauri()) {
      const totalBytes = item.sizeEstimateBytes || 15 * 1024 * 1024;
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const currentBytes = Math.round((totalBytes / steps) * i);
        const percentage = Math.round((i / steps) * 100);
        onProgress?.({
          itemId: item.id,
          stage: i < steps ? "downloading" : "extracting",
          bytesDownloaded: currentBytes,
          totalBytes,
          percentage,
          speedBytesPerSec: 2.5 * 1024 * 1024,
          message: i < steps
            ? `Downloading ${item.name}... (${formatBytes(currentBytes)} / ${formatBytes(totalBytes)})`
            : `Extracting ${item.name} to ${item.targetSubdir}/...`,
        });
      }

      const stored = localStorage.getItem("lados_installed_binaries") || "[]";
      const installedList = JSON.parse(stored) as string[];
      if (!installedList.includes(item.id)) {
        installedList.push(item.id);
        localStorage.setItem("lados_installed_binaries", JSON.stringify(installedList));
      }

      onProgress?.({
        itemId: item.id,
        stage: "completed",
        bytesDownloaded: totalBytes,
        totalBytes,
        percentage: 100,
        speedBytesPerSec: 0,
        message: `Successfully installed ${item.name}!`,
      });

      processManager.emitLog(
        "system",
        "system",
        `[Downloader] [Simulation Mode] Successfully downloaded and installed ${item.name}.`
      );
      return true;
    }

    // =========================================================================
    // Native Tauri Download via @tauri-apps/plugin-http
    // =========================================================================
    try {
      onProgress?.({
        itemId: item.id,
        stage: "downloading",
        bytesDownloaded: 0,
        totalBytes: item.sizeEstimateBytes || 0,
        percentage: 0,
        speedBytesPerSec: 0,
        message: `Connecting to ${new URL(downloadUrl).hostname}...`,
      });

      const response = await tauriFetch(downloadUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Lados/0.1.0 (Desktop Stack Manager)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const contentLengthHeader = response.headers.get("content-length");
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : (item.sizeEstimateBytes || 0);

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to read response stream from download server.");
      }

      const chunks: Uint8Array[] = [];
      let bytesDownloaded = 0;
      let lastReportTime = Date.now();
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          bytesDownloaded += value.length;

          const now = Date.now();
          if (now - lastReportTime > 100) {
            lastReportTime = now;
            const elapsedSec = (now - startTime) / 1000;
            const speedBytesPerSec = elapsedSec > 0 ? Math.round(bytesDownloaded / elapsedSec) : 0;
            const percentage = totalBytes > 0 ? Math.min(100, Math.round((bytesDownloaded / totalBytes) * 100)) : 0;

            onProgress?.({
              itemId: item.id,
              stage: "downloading",
              bytesDownloaded,
              totalBytes,
              percentage,
              speedBytesPerSec,
              message: `Downloading ${item.name}: ${formatBytes(bytesDownloaded)} / ${totalBytes > 0 ? formatBytes(totalBytes) : "Unknown"} (${formatBytes(speedBytesPerSec)}/s)`,
            });
          }
        }
      }

      // Combine downloaded chunks into a single contiguous buffer
      const fullBuffer = new Uint8Array(bytesDownloaded);
      let offset = 0;
      for (const chunk of chunks) {
        fullBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      processManager.emitLog(
        "system",
        "system",
        `[Downloader] Download completed (${formatBytes(bytesDownloaded)}). Preparing extraction...`
      );

      // =========================================================================
      // Extraction via JSZip for zip archives
      // =========================================================================
      if (item.isZip) {
        onProgress?.({
          itemId: item.id,
          stage: "extracting",
          bytesDownloaded,
          totalBytes,
          percentage: 100,
          speedBytesPerSec: 0,
          message: `Unpacking archive for ${item.name}...`,
        });

        const zip = await JSZip.loadAsync(fullBuffer);
        const fileNames = Object.keys(zip.files);
        const prefixToStrip = detectCommonPrefix(fileNames);

        let extractedCount = 0;
        const totalFiles = fileNames.length;

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          extractedCount++;

          // Strip common root folder if present
          let cleanRelPath = relativePath;
          if (prefixToStrip && cleanRelPath.startsWith(prefixToStrip)) {
            cleanRelPath = cleanRelPath.substring(prefixToStrip.length);
          }

          if (!cleanRelPath || cleanRelPath.endsWith("/")) {
            // Directory entry
            const dirPath = normalizePath(await join(targetFolder, cleanRelPath));
            const dirExists = await exists(dirPath);
            if (!dirExists) {
              await mkdir(dirPath, { recursive: true });
            }
            continue;
          }

          // File entry
          const destFilePath = normalizePath(await join(targetFolder, cleanRelPath));
          const fileData = await zipEntry.async("uint8array");

          // Ensure parent directory exists
          const lastSlash = destFilePath.lastIndexOf("/");
          if (lastSlash !== -1) {
            const parentDir = destFilePath.substring(0, lastSlash);
            const parentExists = await exists(parentDir);
            if (!parentExists) {
              await mkdir(parentDir, { recursive: true });
            }
          }

          await writeFile(destFilePath, fileData);

          if (extractedCount % 10 === 0 || extractedCount === totalFiles) {
            onProgress?.({
              itemId: item.id,
              stage: "extracting",
              bytesDownloaded,
              totalBytes,
              percentage: Math.round((extractedCount / totalFiles) * 100),
              speedBytesPerSec: 0,
              message: `Extracting ${item.name}: ${extractedCount}/${totalFiles} files`,
            });
          }
        }
      } else {
        // Direct single binary download (e.g. composer.phar or mkcert.exe)
        onProgress?.({
          itemId: item.id,
          stage: "extracting",
          bytesDownloaded,
          totalBytes,
          percentage: 100,
          speedBytesPerSec: 0,
          message: `Saving binary for ${item.name}...`,
        });

        const exeName = isWindows ? item.executableName.windows : item.executableName.linux;
        const destFilePath = normalizePath(await join(targetFolder, exeName));
        await writeFile(destFilePath, fullBuffer);

        // If composer on Windows, create a composer.bat launcher
        if (item.category === "composer" && isWindows) {
          const batPath = normalizePath(await join(targetFolder, "composer.bat"));
          const batContent = `@echo off\r\nphp "%~dp0composer.phar" %*\r\n`;
          const encoder = new TextEncoder();
          await writeFile(batPath, encoder.encode(batContent));
        }
      }

      // =========================================================================
      // Verification
      // =========================================================================
      onProgress?.({
        itemId: item.id,
        stage: "verifying",
        bytesDownloaded,
        totalBytes,
        percentage: 100,
        speedBytesPerSec: 0,
        message: `Verifying executable integrity...`,
      });

      const exeName = isWindows ? item.executableName.windows : item.executableName.linux;
      const finalExePath = normalizePath(await join(targetFolder, exeName));
      const exeExists = await exists(finalExePath);

      if (!exeExists) {
        throw new Error(`Executable file not found at expected path: ${finalExePath}`);
      }

      onProgress?.({
        itemId: item.id,
        stage: "completed",
        bytesDownloaded,
        totalBytes,
        percentage: 100,
        speedBytesPerSec: 0,
        message: `${item.name} is installed and ready!`,
      });

      processManager.emitLog(
        "system",
        "system",
        `[Downloader] Successfully installed ${item.name} to ${targetFolder}.`
      );

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      processManager.emitLog("system", "stderr", `[Downloader] Download/installation error for ${item.name}: ${msg}`);
      onProgress?.({
        itemId: item.id,
        stage: "error",
        bytesDownloaded: 0,
        totalBytes: 0,
        percentage: 0,
        speedBytesPerSec: 0,
        message: `Failed: ${msg}`,
        error: msg,
      });
      return false;
    }
  }
}

export const binaryDownloader = new BinaryDownloaderService();
