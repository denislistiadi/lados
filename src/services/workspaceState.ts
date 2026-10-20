import { join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import {
  isTauri,
  normalizePath,
  getWorkspaceDirectories,
} from "./workspacePaths";

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

let cachedState: LadosState | null = null;

/**
 * Creates default initial state for Lados.
 */
export function createDefaultState(rootPath: string): LadosState {
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
 * Sets the active state in memory cache.
 */
export function setCachedState(state: LadosState): void {
  cachedState = state;
}

/**
 * Returns the currently cached state in memory.
 */
export function getCachedState(): LadosState | null {
  return cachedState;
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
