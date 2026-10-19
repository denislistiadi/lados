import { defineStore } from "pinia";
import { ref } from "vue";
import {
  type CatalogItem,
  type DownloadProgress,
  type InstalledBinaryInfo,
  BINARY_CATALOG,
  binaryDownloader,
} from "../services/binaryDownloader";
import {
  type TerminalLaunchResult,
  openIsolatedTerminal,
} from "../services/isolatedTerminal";

export const useBinaryDownloaderStore = defineStore("binaryDownloader", () => {
  const catalog = ref<CatalogItem[]>(BINARY_CATALOG);
  const installedStatus = ref<Record<string, InstalledBinaryInfo>>({});
  const activeDownloads = ref<Record<string, DownloadProgress>>({});
  const isChecking = ref(false);
  const isDownloadingAny = ref(false);
  const lastTerminalResult = ref<TerminalLaunchResult | null>(null);

  /**
   * Refreshes installation status for all catalog items.
   */
  async function refreshInstalledStatus() {
    isChecking.value = true;
    try {
      const results: Record<string, InstalledBinaryInfo> = {};
      for (const item of catalog.value) {
        results[item.id] = await binaryDownloader.checkInstalled(item);
      }
      installedStatus.value = results;
    } finally {
      isChecking.value = false;
    }
  }

  /**
   * Downloads and installs a binary from the catalog.
   */
  async function installBinary(item: CatalogItem): Promise<boolean> {
    isDownloadingAny.value = true;

    activeDownloads.value[item.id] = {
      itemId: item.id,
      stage: "downloading",
      bytesDownloaded: 0,
      totalBytes: item.sizeEstimateBytes || 0,
      percentage: 0,
      speedBytesPerSec: 0,
      message: `Starting ${item.name}...`,
    };

    try {
      const success = await binaryDownloader.downloadAndInstall(item, (prog) => {
        activeDownloads.value[item.id] = prog;
      });

      if (success) {
        await refreshInstalledStatus();
      }

      return success;
    } finally {
      // Re-evaluate if any download is still running
      isDownloadingAny.value = Object.values(activeDownloads.value).some(
        (d) => d.stage === "downloading" || d.stage === "extracting" || d.stage === "verifying"
      );
    }
  }

  /**
   * Opens the isolated terminal in the specified or default directory.
   */
  async function launchTerminal(workingDir?: string): Promise<TerminalLaunchResult> {
    const result = await openIsolatedTerminal(workingDir);
    lastTerminalResult.value = result;
    return result;
  }

  return {
    catalog,
    installedStatus,
    activeDownloads,
    isChecking,
    isDownloadingAny,
    lastTerminalResult,
    refreshInstalledStatus,
    installBinary,
    launchTerminal,
  };
});
