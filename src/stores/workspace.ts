import { defineStore } from "pinia";
import { ref } from "vue";
import {
  initWorkspace,
  loadState,
  saveState,
  isTauri,
  type WorkspaceDirectories,
  type LadosState,
} from "@/services/workspace";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

export const useWorkspaceStore = defineStore("workspace", () => {
  const directories = ref<WorkspaceDirectories | null>(null);
  const state = ref<LadosState | null>(null);
  const activePhpVersion = ref<string>("8.3");
  const isLoading = ref<boolean>(true);
  const error = ref<string | null>(null);

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

  async function setPhpVersion(ver: string): Promise<void> {
    activePhpVersion.value = ver;
    if (state.value) {
      state.value.activePhpVersion = ver;
    }
    await updateState({ activePhpVersion: ver });
  }

  return {
    directories,
    state,
    activePhpVersion,
    isLoading,
    error,
    initialize,
    refresh,
    updateState,
    openDirectory,
    openBrowserUrl,
    setPhpVersion,
  };
});
