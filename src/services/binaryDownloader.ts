import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  type WorkspaceDirectories,
  getWorkspaceDirectories,
  isTauri,
  normalizePath,
} from "./workspace";
import { processManager } from "./processManager";
import {
  type BinaryCategory,
  type CatalogItem,
  type DownloadProgress,
  type InstalledBinaryInfo,
  BINARY_CATALOG,
  formatBytes,
} from "./binaryCatalog";
import {
  extractZipArchive,
  saveSingleBinary,
  simulateDownload,
} from "./binaryExtractor";

// Re-export all catalog items, formatting helpers, and interfaces for zero-breaking changes
export type { BinaryCategory, CatalogItem, DownloadProgress, InstalledBinaryInfo };
export { BINARY_CATALOG, formatBytes };

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

    // Simulation Mode for Browser Previews
    if (!isTauri()) {
      const success = await simulateDownload(item, onProgress);
      processManager.emitLog(
        "system",
        "system",
        `[Downloader] [Simulation Mode] Successfully downloaded and installed ${item.name}.`
      );
      return success;
    }

    // Native Tauri Download via @tauri-apps/plugin-http
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

      // Extraction via JSZip for zip archives or single binary write
      if (item.isZip) {
        await extractZipArchive(item, fullBuffer, targetFolder, bytesDownloaded, totalBytes, onProgress);
      } else {
        await saveSingleBinary(item, fullBuffer, targetFolder, isWindows, bytesDownloaded, totalBytes, onProgress);
      }

      // Verification
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
