import { watch, type UnwatchFn } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  type WorkspaceDirectories,
  getWorkspaceDirectories,
  isTauri,
} from "./workspace";
import {
  type VirtualHostProject,
  scanAndSyncVirtualHosts,
} from "./vhostScanner";
import { generateAllConfigs } from "./configGenerator";
import { processManager } from "./processManager";
import { syncHostsDomains } from "./hostsManager";
import {
  createSampleScaffold,
  createMockSampleProject,
  autoGenerateProjectsSsl,
  type SampleProjectType,
} from "./vhostScaffolder";

export type ProjectsListener = (projects: VirtualHostProject[]) => void;
export type { SampleProjectType };

class VhostWatcherService {
  private unwatchFn: UnwatchFn | null = null;
  private currentProjects: VirtualHostProject[] = [];
  private listeners: Set<ProjectsListener> = new Set();
  private isWatching = false;
  private debounceTimer: number | null = null;

  public getProjects(): VirtualHostProject[] {
    return [...this.currentProjects];
  }

  public onProjectsChange(listener: ProjectsListener): () => void {
    this.listeners.add(listener);
    listener(this.getProjects());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const list = this.getProjects();
    for (const listener of this.listeners) {
      try {
        listener(list);
      } catch (err) {
        console.error("Error in vhost listener:", err);
      }
    }
  }

  public async init(): Promise<VirtualHostProject[]> {
    const dirs = await getWorkspaceDirectories();
    await generateAllConfigs(dirs);

    const result = await scanAndSyncVirtualHosts(dirs, this.currentProjects);
    this.currentProjects = result.projects;

    await autoGenerateProjectsSsl(this.currentProjects, dirs);
    await this.syncSystemHosts();

    this.notifyListeners();
    await this.startWatcher(dirs);

    return this.currentProjects;
  }

  public async syncSystemHosts(requestElevation = false): Promise<void> {
    const domains = this.currentProjects.map((p) => p.domain);
    await syncHostsDomains(domains, requestElevation);
  }

  public async startWatcher(dirs?: WorkspaceDirectories): Promise<boolean> {
    if (this.isWatching) {
      return true;
    }

    const workspaceDirs = dirs || (await getWorkspaceDirectories());

    if (!isTauri()) {
      this.isWatching = true;
      processManager.emitLog("nginx", "system", "[Watcher] Auto Virtual Host Watcher active (simulation mode).");
      return true;
    }

    try {
      this.unwatchFn = await watch(
        workspaceDirs.www,
        () => {
          this.handleDirectoryChange(workspaceDirs);
        },
        {
          delayMs: 1200,
          recursive: true,
        }
      );

      this.isWatching = true;
      processManager.emitLog(
        "nginx",
        "system",
        `[Watcher] Real-time watcher active on ${workspaceDirs.www} (Auto-syncing sites-enabled, hosts, and SSL)`
      );
      return true;
    } catch (err) {
      console.warn("Failed to start fs watch on www directory:", err);
      processManager.emitLog("nginx", "stderr", `Failed to start Virtual Host watcher: ${err}`);
      return false;
    }
  }

  public stopWatcher(): void {
    if (this.unwatchFn) {
      try {
        this.unwatchFn();
      } catch (err) {
        console.warn("Error unwatching www:", err);
      }
      this.unwatchFn = null;
    }
    this.isWatching = false;
    processManager.emitLog("nginx", "system", "[Watcher] Virtual Host watcher stopped.");
  }

  private handleDirectoryChange(dirs: WorkspaceDirectories): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(async () => {
      this.debounceTimer = null;
      await this.scanAndSync(dirs);
    }, 800);
  }

  public async scanAndSync(dirs?: WorkspaceDirectories): Promise<VirtualHostProject[]> {
    const workspaceDirs = dirs || (await getWorkspaceDirectories());
    const oldProjects = [...this.currentProjects];

    const result = await scanAndSyncVirtualHosts(workspaceDirs, oldProjects);
    this.currentProjects = result.projects;

    const oldNames = new Set(oldProjects.map((p) => p.name));
    const newProjects = result.projects.filter((p) => !oldNames.has(p.name));

    let sslGenerated = false;
    if (newProjects.length > 0) {
      sslGenerated = await autoGenerateProjectsSsl(this.currentProjects, workspaceDirs);
    }

    this.notifyListeners();

    if (result.hasChanges || sslGenerated) {
      const newNames = new Set(result.projects.map((p) => p.name));

      for (const p of result.projects) {
        if (!oldNames.has(p.name)) {
          processManager.emitLog(
            "nginx",
            "system",
            `[Virtual Host] Added: ${p.name} (${p.framework}) -> http://${p.domain} ${p.hasSsl ? "(HTTPS SSL Active)" : ""}`
          );
        }
      }

      for (const p of oldProjects) {
        if (!newNames.has(p.name)) {
          processManager.emitLog("nginx", "system", `[Virtual Host] Removed: ${p.name} (http://${p.domain})`);
        }
      }

      await this.syncSystemHosts();
      await processManager.reloadNginx();
    }

    return this.currentProjects;
  }

  public async createSampleProject(
    projectName: string,
    type: SampleProjectType
  ): Promise<VirtualHostProject | null> {
    const dirs = await getWorkspaceDirectories();
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!sanitizedName) return null;

    const projectDir = isTauri()
      ? await join(dirs.www, sanitizedName)
      : `${dirs.www}/${sanitizedName}`;

    if (!isTauri()) {
      const newProject = await createMockSampleProject(sanitizedName, type, dirs);
      this.currentProjects.push(newProject);
      await this.syncSystemHosts();
      this.notifyListeners();

      processManager.emitLog(
        "nginx",
        "system",
        `[Virtual Host] Sample project created: ${sanitizedName} (${newProject.framework}) -> http://${newProject.domain} (HTTPS Active)`
      );
      await processManager.reloadNginx();
      return newProject;
    }

    try {
      await createSampleScaffold(projectDir, sanitizedName, type);
      await this.scanAndSync(dirs);
      return this.currentProjects.find((p) => p.name === sanitizedName) || null;
    } catch (err) {
      console.error(`Failed to create sample project ${sanitizedName}:`, err);
      processManager.emitLog("nginx", "stderr", `Failed to create sample project ${sanitizedName}: ${err}`);
      return null;
    }
  }

  public getIsWatching(): boolean {
    return this.isWatching;
  }
}

export const vhostWatcher = new VhostWatcherService();
