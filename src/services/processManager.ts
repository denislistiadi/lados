import { Command, type Child } from "@tauri-apps/plugin-shell";
import { join } from "@tauri-apps/api/path";
import {
  getWorkspaceDirectories,
  normalizePath,
  isTauri,
  saveState,
  type WorkspaceDirectories,
} from "./workspace";
import { generateAllConfigs } from "./configGenerator";

export type ServiceType = "nginx" | "php" | "mariadb";
export type LogServiceType = ServiceType | "system";
export type ServiceStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export interface LogEntry {
  id: string;
  service: LogServiceType;
  type: "stdout" | "stderr" | "system";
  message: string;
  timestamp: string;
}

export interface ServiceInfo {
  name: ServiceType;
  displayName: string;
  status: ServiceStatus;
  pid: number | null;
  port: number;
  startTime: number | null;
  lastError: string | null;
}

export type LogListener = (entry: LogEntry) => void;
export type StatusListener = (service: ServiceType, status: ServiceStatus, info: ServiceInfo) => void;

class ProcessManagerService {
  private activeChildren: Map<ServiceType, Child> = new Map();
  private serviceInfo: Map<ServiceType, ServiceInfo> = new Map();
  private logListeners: Set<LogListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private mockIntervals: Map<ServiceType, number> = new Map();

  constructor() {
    this.initDefaultServiceInfo();
  }

  private initDefaultServiceInfo(): void {
    this.serviceInfo.set("nginx", {
      name: "nginx",
      displayName: "Nginx HTTP Server",
      status: "stopped",
      pid: null,
      port: 80,
      startTime: null,
      lastError: null,
    });

    this.serviceInfo.set("php", {
      name: "php",
      displayName: "PHP FastCGI Engine",
      status: "stopped",
      pid: null,
      port: 9000,
      startTime: null,
      lastError: null,
    });

    this.serviceInfo.set("mariadb", {
      name: "mariadb",
      displayName: "MariaDB SQL Server",
      status: "stopped",
      pid: null,
      port: 3306,
      startTime: null,
      lastError: null,
    });
  }

  public getServiceInfo(service: ServiceType): ServiceInfo {
    return (
      this.serviceInfo.get(service) || {
        name: service,
        displayName: service.toUpperCase(),
        status: "stopped",
        pid: null,
        port: 0,
        startTime: null,
        lastError: null,
      }
    );
  }

  public getAllServices(): Record<ServiceType, ServiceInfo> {
    return {
      nginx: this.getServiceInfo("nginx"),
      php: this.getServiceInfo("php"),
      mariadb: this.getServiceInfo("mariadb"),
    };
  }

  public onLog(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public emitLog(service: LogServiceType, type: "stdout" | "stderr" | "system", message: string): void {
    const lines = message.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    for (const line of lines) {
      const entry: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        service,
        type,
        message: line,
        timestamp: timeStr,
      };

      for (const listener of this.logListeners) {
        try {
          listener(entry);
        } catch (err) {
          console.error("Error in log listener:", err);
        }
      }
    }
  }

  private setStatus(service: ServiceType, status: ServiceStatus, pid: number | null = null, error: string | null = null): void {
    const current = this.getServiceInfo(service);
    const updated: ServiceInfo = {
      ...current,
      status,
      pid: status === "running" ? pid : status === "stopped" ? null : current.pid,
      startTime: status === "running" ? Date.now() : status === "stopped" ? null : current.startTime,
      lastError: error || (status === "running" ? null : current.lastError),
    };

    this.serviceInfo.set(service, updated);

    for (const listener of this.statusListeners) {
      try {
        listener(service, status, updated);
      } catch (err) {
        console.error("Error in status listener:", err);
      }
    }

    // Persist to state.json
    saveState({
      services: {
        nginx: {
          enabled: true,
          running: this.getServiceInfo("nginx").status === "running",
          port: this.getServiceInfo("nginx").port,
          pid: this.getServiceInfo("nginx").pid,
        },
        php: {
          enabled: true,
          running: this.getServiceInfo("php").status === "running",
          port: this.getServiceInfo("php").port,
          pid: this.getServiceInfo("php").pid,
        },
        mariadb: {
          enabled: true,
          running: this.getServiceInfo("mariadb").status === "running",
          port: this.getServiceInfo("mariadb").port,
          pid: this.getServiceInfo("mariadb").pid,
        },
      },
    }).catch((err) => console.warn("Failed to auto-save service state:", err));
  }

  /**
   * Generates or updates default configuration files in etc/nginx, etc/php, etc/mariadb.
   * Adheres strictly to RULE 3: Windows paths are normalized to forward slashes (/) for Nginx.
   */
  public async ensureConfigurations(dirs: WorkspaceDirectories): Promise<void> {
    try {
      await generateAllConfigs(dirs);
    } catch (err) {
      console.warn("Failed to generate default configs:", err);
    }
  }

  /**
   * Starts Nginx portable binary:
   * Command: nginx -p <path> -c <config> -g "daemon off;"
   */
  public async startNginx(): Promise<boolean> {
    if (this.getServiceInfo("nginx").status === "running") {
      this.emitLog("nginx", "system", "Nginx is already running.");
      return true;
    }

    this.setStatus("nginx", "starting");
    this.emitLog("nginx", "system", "Starting Nginx HTTP Server...");

    const dirs = await getWorkspaceDirectories();
    await this.ensureConfigurations(dirs);

    if (!isTauri()) {
      return this.simulateStart("nginx", 80);
    }

    try {
      const normRoot = normalizePath(dirs.root);
      const configPath = normalizePath(await join(dirs.etcNginx, "nginx.conf"));

      // Nginx portable execution: -p <path> -c <config> -g "daemon off;"
      const args = ["-p", normRoot, "-c", configPath, "-g", "daemon off;"];

      this.emitLog("nginx", "system", `Command: nginx ${args.join(" ")}`);

      // Spawn process with processGroup to prevent zombies
      const command = Command.create("nginx", args, {
        cwd: dirs.root,
        processGroup: true,
      });

      this.bindCommandEvents("nginx", command);

      const child = await command.spawn();
      this.activeChildren.set("nginx", child);
      this.setStatus("nginx", "running", child.pid);
      this.emitLog("nginx", "system", `Nginx started successfully (PID: ${child.pid}) on port 80`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus("nginx", "error", null, msg);
      this.emitLog("nginx", "stderr", `Failed to start Nginx: ${msg}`);
      this.emitLog("nginx", "system", "Hint: Ensure Nginx binary is located in bin/nginx/ or accessible in system PATH.");
      return false;
    }
  }

  /**
   * Reloads Nginx configuration (hot reload without downtime).
   */
  public async reloadNginx(): Promise<boolean> {
    const info = this.getServiceInfo("nginx");
    if (info.status !== "running") {
      this.emitLog("nginx", "system", "Nginx is not running; configuration saved for next startup.");
      return false;
    }

    const dirs = await getWorkspaceDirectories();
    const normRoot = normalizePath(dirs.root);
    const configPath = normalizePath(await join(dirs.etcNginx, "nginx.conf"));

    this.emitLog("nginx", "system", "Reloading Nginx configuration (hot reload)...");

    if (!isTauri()) {
      this.emitLog("nginx", "system", "[Simulation Mode] Nginx configuration reloaded successfully.");
      return true;
    }

    try {
      const command = Command.create("nginx", ["-p", normRoot, "-c", configPath, "-s", "reload"], {
        cwd: dirs.root,
      });
      const output = await command.execute();
      if (output.code === 0) {
        this.emitLog("nginx", "system", "Nginx reloaded successfully without downtime.");
        return true;
      } else {
        const err = output.stderr || output.stdout;
        this.emitLog("nginx", "stderr", `Nginx reload failed: ${err}`);
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitLog("nginx", "stderr", `Failed to reload Nginx: ${msg}`);
      return false;
    }
  }

  /**
   * Starts PHP FastCGI Engine:
   * Windows: php-cgi.exe on port 9000
   * Linux: php-fpm on port 9000
   */
  public async startPhp(): Promise<boolean> {
    if (this.getServiceInfo("php").status === "running") {
      this.emitLog("php", "system", "PHP is already running.");
      return true;
    }

    this.setStatus("php", "starting");
    this.emitLog("php", "system", "Starting PHP FastCGI Engine on port 9000...");

    const dirs = await getWorkspaceDirectories();
    await this.ensureConfigurations(dirs);

    if (!isTauri()) {
      return this.simulateStart("php", 9000);
    }

    try {
      const phpIniPath = normalizePath(await join(dirs.etcPhp, "php.ini"));
      const isWindows = navigator.userAgent.toLowerCase().includes("windows");
      const programName = isWindows ? "php-cgi" : "php-fpm";

      // PHP FastCGI arguments
      const args = ["-b", "127.0.0.1:9000", "-c", phpIniPath];

      this.emitLog("php", "system", `Command: ${programName} ${args.join(" ")}`);

      const command = Command.create(programName, args, {
        cwd: dirs.root,
        env: {
          PHP_FCGI_MAX_REQUESTS: "0",
          PHP_FCGI_CHILDREN: "4",
        },
        processGroup: true,
      });

      this.bindCommandEvents("php", command);

      const child = await command.spawn();
      this.activeChildren.set("php", child);
      this.setStatus("php", "running", child.pid);
      this.emitLog("php", "system", `PHP FastCGI engine started successfully (PID: ${child.pid}) on 127.0.0.1:9000`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus("php", "error", null, msg);
      this.emitLog("php", "stderr", `Failed to start PHP: ${msg}`);
      this.emitLog("php", "system", "Hint: Ensure php-cgi.exe is located in bin/php/ or accessible in system PATH.");
      return false;
    }
  }

  /**
   * Starts MariaDB SQL Server:
   * Command: mysqld with --defaults-file=<config> and --datadir=<datadir>
   */
  public async startMariaDb(): Promise<boolean> {
    if (this.getServiceInfo("mariadb").status === "running") {
      this.emitLog("mariadb", "system", "MariaDB is already running.");
      return true;
    }

    this.setStatus("mariadb", "starting");
    this.emitLog("mariadb", "system", "Starting MariaDB SQL Server...");

    const dirs = await getWorkspaceDirectories();
    await this.ensureConfigurations(dirs);

    if (!isTauri()) {
      return this.simulateStart("mariadb", 3306);
    }

    try {
      const myIniPath = normalizePath(await join(dirs.etcMariadb, "my.ini"));
      const dataDirPath = normalizePath(dirs.data);

      const args = [
        `--defaults-file=${myIniPath}`,
        `--datadir=${dataDirPath}`,
        "--console",
      ];

      this.emitLog("mariadb", "system", `Command: mysqld ${args.join(" ")}`);

      const command = Command.create("mysqld", args, {
        cwd: dirs.root,
        processGroup: true,
      });

      this.bindCommandEvents("mariadb", command);

      const child = await command.spawn();
      this.activeChildren.set("mariadb", child);
      this.setStatus("mariadb", "running", child.pid);
      this.emitLog("mariadb", "system", `MariaDB server started successfully (PID: ${child.pid}) on port 3306`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus("mariadb", "error", null, msg);
      this.emitLog("mariadb", "stderr", `Failed to start MariaDB: ${msg}`);
      this.emitLog("mariadb", "system", "Hint: Ensure mysqld.exe is located in bin/mariadb/bin/ or accessible in system PATH.");
      return false;
    }
  }

  /**
   * Binds stdout, stderr, close, and error events to process.
   */
  private bindCommandEvents(service: ServiceType, command: Command<string>): void {
    command.stdout.on("data", (data: string) => {
      this.emitLog(service, "stdout", data);
    });

    command.stderr.on("data", (data: string) => {
      this.emitLog(service, "stderr", data);
    });

    command.on("error", (error: string) => {
      this.emitLog(service, "stderr", `[Process Error] ${error}`);
      this.setStatus(service, "error", null, error);
    });

    command.on("close", (payload: { code: number | null; signal: number | null }) => {
      this.activeChildren.delete(service);
      const wasRunning = this.getServiceInfo(service).status === "running";
      const exitMsg = `Process terminated (Exit Code: ${payload.code ?? "N/A"}, Signal: ${payload.signal ?? "N/A"})`;

      if (wasRunning && payload.code !== 0 && payload.code !== null) {
        this.emitLog(service, "stderr", exitMsg);
        this.setStatus(service, "error", null, exitMsg);
      } else {
        this.emitLog(service, "system", exitMsg);
        this.setStatus(service, "stopped");
      }
    });
  }

  /**
   * Starts a specific service by name.
   */
  public async startService(service: ServiceType): Promise<boolean> {
    switch (service) {
      case "nginx":
        return this.startNginx();
      case "php":
        return this.startPhp();
      case "mariadb":
        return this.startMariaDb();
      default:
        return false;
    }
  }

  /**
   * Stops a specific service with graceful termination to prevent zombie processes.
   */
  public async stopService(service: ServiceType): Promise<boolean> {
    const info = this.getServiceInfo(service);
    if (info.status === "stopped") {
      this.emitLog(service, "system", `${service} is already stopped.`);
      return true;
    }

    this.setStatus(service, "stopping");
    this.emitLog(service, "system", `Stopping ${info.displayName}...`);

    if (!isTauri()) {
      return this.simulateStop(service);
    }

    const child = this.activeChildren.get(service);
    const pid = info.pid;

    try {
      if (child) {
        await child.kill();
        this.emitLog(service, "system", `Sent kill signal to PID ${child.pid}`);
      }

      // Safety on Windows: ensure process tree is cleanly killed
      if (pid && navigator.userAgent.toLowerCase().includes("windows")) {
        try {
          const taskkillCmd = Command.create("taskkill", ["/F", "/T", "/PID", String(pid)]);
          await taskkillCmd.execute();
        } catch {
          // Process might already be dead
        }
      }

      this.activeChildren.delete(service);
      this.setStatus(service, "stopped");
      this.emitLog(service, "system", `${info.displayName} stopped cleanly.`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitLog(service, "stderr", `Error stopping ${service}: ${msg}`);
      this.setStatus(service, "stopped");
      this.activeChildren.delete(service);
      return false;
    }
  }

  /**
   * Starts all core services in proper order:
   * 1. MariaDB (Database)
   * 2. PHP (FastCGI backend)
   * 3. Nginx (Web Server routing to PHP)
   */
  public async startAllServices(): Promise<Record<ServiceType, boolean>> {
    this.emitLog("nginx", "system", "=== Starting All Lados Stack Services ===");

    const mariadbSuccess = await this.startMariaDb();
    const phpSuccess = await this.startPhp();
    const nginxSuccess = await this.startNginx();

    return {
      mariadb: mariadbSuccess,
      php: phpSuccess,
      nginx: nginxSuccess,
    };
  }

  /**
   * Stops all active services ensuring zero zombie processes remaining on the OS.
   */
  public async stopAllServices(): Promise<Record<ServiceType, boolean>> {
    this.emitLog("nginx", "system", "=== Stopping All Lados Stack Services (Graceful Shutdown) ===");

    // Stop in reverse dependency order: Nginx -> PHP -> MariaDB
    const nginxStopped = await this.stopService("nginx");
    const phpStopped = await this.stopService("php");
    const mariadbStopped = await this.stopService("mariadb");

    return {
      nginx: nginxStopped,
      php: phpStopped,
      mariadb: mariadbStopped,
    };
  }

  /**
   * Restarts a single service.
   */
  public async restartService(service: ServiceType): Promise<boolean> {
    await this.stopService(service);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return this.startService(service);
  }

  /**
   * Web simulation runner for browser preview mode.
   */
  private simulateStart(service: ServiceType, port: number): boolean {
    const fakePid = Math.floor(1000 + Math.random() * 9000);
    this.setStatus(service, "running", fakePid);
    this.emitLog(service, "system", `[Simulation Mode] ${service.toUpperCase()} started on port ${port} (PID: ${fakePid})`);
    this.emitLog(service, "stdout", `Ready for incoming connections on 127.0.0.1:${port}`);

    const interval = window.setInterval(() => {
      if (this.getServiceInfo(service).status === "running") {
        this.emitLog(service, "stdout", `[${new Date().toLocaleTimeString()}] Health check OK. Connections: ${Math.floor(Math.random() * 5)}`);
      }
    }, 15000);

    this.mockIntervals.set(service, interval);
    return true;
  }

  private simulateStop(service: ServiceType): boolean {
    const interval = this.mockIntervals.get(service);
    if (interval) {
      clearInterval(interval);
      this.mockIntervals.delete(service);
    }

    this.setStatus(service, "stopped");
    this.emitLog(service, "system", `[Simulation Mode] ${service.toUpperCase()} stopped cleanly.`);
    return true;
  }
}

export const processManager = new ProcessManagerService();
