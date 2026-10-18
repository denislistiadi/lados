import { watch, type UnwatchFn, mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
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
import { generateAllConfigs, writeVirtualHostConfig } from "./configGenerator";
import { processManager } from "./processManager";
import { syncHostsDomains } from "./hostsManager";
import { sslManager } from "./sslManager";

export type ProjectsListener = (projects: VirtualHostProject[]) => void;

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

  /**
   * Initializes virtual hosts:
   * 1. Writes base configs in etc/nginx/nginx.conf, etc/php/php.ini, etc/mariadb/my.ini.
   * 2. Scans www/ for projects and syncs etc/nginx/sites-enabled/.
   * 3. Syncs hosts file with Lados domains.
   * 4. Starts real-time watcher on www/.
   */
  public async init(): Promise<VirtualHostProject[]> {
    const dirs = await getWorkspaceDirectories();

    // 1. Ensure master configs exist with normalized forward-slash paths
    await generateAllConfigs(dirs);

    // 2. Perform initial scan and synchronization
    const result = await scanAndSyncVirtualHosts(dirs, this.currentProjects);
    this.currentProjects = result.projects;

    // 3. Auto-generate SSL with mkcert for projects lacking certificates
    await this.autoGenerateSsl(dirs);

    // 4. Synchronize hosts file inside # >>> LADOS DOMAINS START >>>
    await this.syncSystemHosts();

    this.notifyListeners();

    // 5. Start real-time filesystem watcher
    await this.startWatcher(dirs);

    return this.currentProjects;
  }

  /**
   * Auto-generates local trusted SSL certificates for projects using mkcert.
   */
  private async autoGenerateSsl(dirs: WorkspaceDirectories): Promise<boolean> {
    const mkcertStatus = await sslManager.checkMkcert(dirs);
    if (!mkcertStatus.available) {
      return false;
    }

    let generatedAny = false;

    for (const project of this.currentProjects) {
      if (!project.hasSsl) {
        const certRes = await sslManager.generateCertificate(project.domain, dirs);
        if (certRes.success) {
          project.hasSsl = true;
          generatedAny = true;
          // Re-write Nginx virtual host config with SSL port 443 enabled
          await writeVirtualHostConfig(project, dirs, true);
        }
      }
    }

    return generatedAny;
  }

  /**
   * Synchronizes system hosts file with current Lados project domains.
   */
  public async syncSystemHosts(requestElevation = false): Promise<void> {
    const domains = this.currentProjects.map((p) => p.domain);
    await syncHostsDomains(domains, requestElevation);
  }

  /**
   * Starts watching www/ using watch() from @tauri-apps/plugin-fs.
   */
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

  /**
   * Stops the filesystem watcher.
   */
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

  /**
   * Debounced change handler when www/ modifications are detected.
   */
  private handleDirectoryChange(dirs: WorkspaceDirectories): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(async () => {
      this.debounceTimer = null;
      await this.scanAndSync(dirs);
    }, 800);
  }

  /**
   * Scans www/, synchronizes sites-enabled/, hosts, and SSL, then reloads Nginx.
   */
  public async scanAndSync(dirs?: WorkspaceDirectories): Promise<VirtualHostProject[]> {
    const workspaceDirs = dirs || (await getWorkspaceDirectories());
    const oldProjects = [...this.currentProjects];

    const result = await scanAndSyncVirtualHosts(workspaceDirs, oldProjects);
    this.currentProjects = result.projects;

    // Check for newly added projects
    const oldNames = new Set(oldProjects.map((p) => p.name));
    const newProjects = result.projects.filter((p) => !oldNames.has(p.name));

    // Auto-generate SSL for new projects
    let sslGenerated = false;
    if (newProjects.length > 0) {
      sslGenerated = await this.autoGenerateSsl(workspaceDirs);
    }

    this.notifyListeners();

    if (result.hasChanges || sslGenerated) {
      const newNames = new Set(result.projects.map((p) => p.name));

      // Report additions
      for (const p of result.projects) {
        if (!oldNames.has(p.name)) {
          processManager.emitLog(
            "nginx",
            "system",
            `[Virtual Host] Added: ${p.name} (${p.framework}) -> http://${p.domain} ${p.hasSsl ? "(HTTPS SSL Active)" : ""}`
          );
        }
      }

      // Report removals
      for (const p of oldProjects) {
        if (!newNames.has(p.name)) {
          processManager.emitLog("nginx", "system", `[Virtual Host] Removed: ${p.name} (http://${p.domain})`);
        }
      }

      // Sync hosts file
      await this.syncSystemHosts();

      // Automatically hot-reload Nginx
      await processManager.reloadNginx();
    }

    return this.currentProjects;
  }

  /**
   * Helper utility to create a sample project inside www/ to test the auto-scanner and watcher.
   */
  public async createSampleProject(
    projectName: string,
    type: "laravel" | "wordpress" | "native"
  ): Promise<VirtualHostProject | null> {
    const dirs = await getWorkspaceDirectories();
    const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!sanitizedName) return null;

    const projectDir = isTauri()
      ? await join(dirs.www, sanitizedName)
      : `${dirs.www}/${sanitizedName}`;

    if (!isTauri()) {
      // Mock creation
      const mockFramework = type === "laravel" ? "Laravel" : type === "wordpress" ? "WordPress" : "Native PHP";
      const docRoot = type === "laravel" ? `${projectDir}/public` : projectDir;
      const domain = `${sanitizedName}.test`;

      // Auto generate simulated cert
      await sslManager.generateCertificate(domain, dirs);

      const newProject: VirtualHostProject = {
        name: sanitizedName,
        domain,
        framework: mockFramework,
        projectPath: projectDir,
        documentRoot: docRoot,
        hasIndexPhp: true,
        hasIndexHtml: false,
        configFile: `${dirs.etcNginxSites}/${sanitizedName}.conf`,
        detectedAt: new Date().toLocaleTimeString(),
        hasSsl: true,
      };

      this.currentProjects.push(newProject);
      await this.syncSystemHosts();
      this.notifyListeners();

      processManager.emitLog(
        "nginx",
        "system",
        `[Virtual Host] Sample project created: ${sanitizedName} (${mockFramework}) -> http://${domain} (HTTPS Active)`
      );
      await processManager.reloadNginx();
      return newProject;
    }

    try {
      await mkdir(projectDir, { recursive: true });

      if (type === "laravel") {
        const publicDir = await join(projectDir, "public");
        await mkdir(publicDir, { recursive: true });
        // artisan file
        await writeTextFile(await join(projectDir, "artisan"), "#!/usr/bin/env php\n<?php // Laravel Console");
        // public/index.php
        await writeTextFile(
          await join(publicDir, "index.php"),
          `<?php\n// Laravel Front Controller for ${sanitizedName}\necho "<h1>Hello from Laravel (${sanitizedName}.test)</h1><p>Running on LADOS Local Server</p>";`
        );
      } else if (type === "wordpress") {
        await writeTextFile(
          await join(projectDir, "wp-config.php"),
          `<?php\n// WordPress Configuration for ${sanitizedName}\ndefine('DB_NAME', '${sanitizedName}_db');\ndefine('DB_USER', 'root');\ndefine('DB_PASSWORD', '');\ndefine('DB_HOST', '127.0.0.1');`
        );
        await writeTextFile(
          await join(projectDir, "index.php"),
          `<?php\n// WordPress Front Controller for ${sanitizedName}\necho "<h1>Hello from WordPress (${sanitizedName}.test)</h1><p>Running on LADOS Local Server</p>";`
        );
      } else {
        await writeTextFile(
          await join(projectDir, "index.php"),
          `<?php\n// Native PHP for ${sanitizedName}\necho "<h1>Welcome to ${sanitizedName}.test</h1><p>PHP " . phpversion() . " on LADOS Local Server</p>";`
        );
      }

      // Trigger sync
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
