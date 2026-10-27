import { defineStore } from "pinia";
import { ref } from "vue";
import {
  initWorkspace,
  loadState,
  saveState,
  isTauri,
  phpVersionManager,
  type WorkspaceDirectories,
  type LadosState,
  type InstalledPhpVersion,
} from "@/services/workspace";
import type { DownloadProgress } from "@/services/binaryCatalog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

export const useWorkspaceStore = defineStore("workspace", () => {
  const directories = ref<WorkspaceDirectories | null>(null);
  const state = ref<LadosState | null>(null);
  const activePhpVersion = ref<string>("8.3");
  const activePhpPath = ref<string>("");
  const phpVersions = ref<InstalledPhpVersion[]>([]);
  const isScanningPhp = ref<boolean>(false);
  const isLoading = ref<boolean>(true);
  const error = ref<string | null>(null);

  async function refreshPhpVersions(): Promise<InstalledPhpVersion[]> {
    isScanningPhp.value = true;
    try {
      const list = await phpVersionManager.scanInstalledVersions();
      phpVersions.value = list;
      const active = list.find((v) => v.isActive);
      if (active) {
        activePhpVersion.value = active.id;
        activePhpPath.value = active.path;
      }
      return list;
    } finally {
      isScanningPhp.value = false;
    }
  }

  async function initialize(): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await initWorkspace();
      directories.value = result.directories;
      state.value = result.state;
      if (result.state.activePhpVersion) {
        activePhpVersion.value = result.state.activePhpVersion;
      }
      if (result.state.activePhpPath) {
        activePhpPath.value = result.state.activePhpPath;
      }
      await refreshPhpVersions();
    } catch (err) {
      console.error("Workspace initialization error:", err);
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading.value = false;
    }
  }

  async function refresh(): Promise<void> {
    try {
      if (directories.value) {
        state.value = await loadState();
        await refreshPhpVersions();
      } else {
        await initialize();
      }
    } catch (err) {
      console.error("Workspace refresh error:", err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function updateState(partial: Partial<LadosState>): Promise<void> {
    try {
      state.value = await saveState(partial);
    } catch (err) {
      console.error("Failed to save state:", err);
      error.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function openDirectory(path: string): Promise<void> {
    if (isTauri()) {
      try {
        await openPath(path);
      } catch (err) {
        console.error("Failed to open path:", err);
      }
    } else {
      console.log("[Browser preview] Open directory requested:", path);
    }
  }

  async function openBrowserUrl(url: string): Promise<void> {
    if (isTauri()) {
      try {
        await openUrl(url);
      } catch (err) {
        console.error("Failed to open URL:", err);
      }
    } else {
      window.open(url, "_blank");
    }
  }

  async function setPhpVersion(versionId: string): Promise<void> {
    const updated = await phpVersionManager.setActiveVersion(versionId);
    if (updated) {
      activePhpVersion.value = updated.id;
      activePhpPath.value = updated.path;
    } else {
      activePhpVersion.value = versionId;
      await updateState({ activePhpVersion: versionId });
    }
    await refreshPhpVersions();
  }

  async function installPhpFromZip(
    fileData: ArrayBuffer | Uint8Array,
    rawName: string,
    onProgress?: (p: DownloadProgress) => void
  ): Promise<InstalledPhpVersion> {
    const installed = await phpVersionManager.installFromZip(fileData, rawName, onProgress);
    await refreshPhpVersions();
    return installed;
  }

  async function deleteCustomPhpVersion(versionId: string): Promise<boolean> {
    const ok = await phpVersionManager.deleteCustomVersion(versionId);
    if (ok) {
      await refreshPhpVersions();
    }
    return ok;
  }

  async function openPhpDirectory(): Promise<void> {
    await phpVersionManager.openPhpDirectory();
  }

  return {
    directories,
    state,
    activePhpVersion,
    activePhpPath,
    phpVersions,
    isScanningPhp,
    isLoading,
    error,
    initialize,
    refresh,
    refreshPhpVersions,
    updateState,
    openDirectory,
    openBrowserUrl,
    setPhpVersion,
    installPhpFromZip,
    deleteCustomPhpVersion,
    openPhpDirectory,
  };
});
