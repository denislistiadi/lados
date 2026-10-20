import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import JSZip from "jszip";
import { normalizePath } from "./workspace";
import { type CatalogItem, type DownloadProgress, formatBytes } from "./binaryCatalog";

/**
 * Detects if all files in a zip share a common single root directory
 * (e.g. nginx-1.26.3/ or mariadb-11.4.5-winx64/) and returns that prefix to strip.
 */
export function detectCommonPrefix(zipPaths: string[]): string {
  const validPaths = zipPaths.filter((p) => p && !p.startsWith("__MACOSX") && !p.startsWith("."));
  if (validPaths.length === 0) return "";

  const firstSlashIdx = validPaths[0].indexOf("/");
  if (firstSlashIdx === -1) return "";

  const candidatePrefix = validPaths[0].substring(0, firstSlashIdx + 1);

  // Check if every path begins with candidatePrefix
  const allMatch = validPaths.every((p) => p.startsWith(candidatePrefix));
  return allMatch ? candidatePrefix : "";
}

/**
 * Unpacks a JSZip buffer into the target folder, stripping any common prefix.
 */
export async function extractZipArchive(
  item: CatalogItem,
  buffer: Uint8Array,
  targetFolder: string,
  bytesDownloaded: number,
  totalBytes: number,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  onProgress?.({
    itemId: item.id,
    stage: "extracting",
    bytesDownloaded,
    totalBytes,
    percentage: 100,
    speedBytesPerSec: 0,
    message: `Unpacking archive for ${item.name}...`,
  });

  const zip = await JSZip.loadAsync(buffer);
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
}

/**
 * Saves a single binary file and configures optional Windows batch launcher.
 */
export async function saveSingleBinary(
  item: CatalogItem,
  buffer: Uint8Array,
  targetFolder: string,
  isWindows: boolean,
  bytesDownloaded: number,
  totalBytes: number,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
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
  await writeFile(destFilePath, buffer);

  // If composer on Windows, create a composer.bat launcher
  if (item.category === "composer" && isWindows) {
    const batPath = normalizePath(await join(targetFolder, "composer.bat"));
    const batContent = `@echo off\r\nphp "%~dp0composer.phar" %*\r\n`;
    const encoder = new TextEncoder();
    await writeFile(batPath, encoder.encode(batContent));
  }
}

/**
 * Simulates binary download and installation in browser preview mode.
 */
export async function simulateDownload(
  item: CatalogItem,
  onProgress?: (progress: DownloadProgress) => void
): Promise<boolean> {
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

  return true;
}
