import { type Child } from "@tauri-apps/plugin-shell";
import {
  getWorkspaceDirectories,
  isTauri,
  type WorkspaceDirectories,
} from "./workspace";
import { generateAllConfigs } from "./configGenerator";
import {
  type ServiceType,
  type LogServiceType,
  type ServiceStatus,
  type LogEntry,
  type ServiceInfo,
  type LogListener,
  type StatusListener,
} from "./processTypes";
import { processLogger } from "./processLogger";
import { serviceStateManager } from "./serviceState";
import { processSimulator } from "./processSimulator";
import {
  createNginxCommand,
  createNginxReloadCommand,
  createPhpCommand,
  createMariaDbCommand,
  bindProcessEvents,
} from "./serviceCommands";
import { killProcess } from "./processKiller";

// Re-export all types and listeners for zero-breaking backward compatibility
export type {
  ServiceType,
  LogServiceType,
  ServiceStatus,
  LogEntry,
  ServiceInfo,
  LogListener,
  StatusListener,
};

class ProcessManagerService {
  private activeChildren: Map<ServiceType, Child> = new Map();

  public getServiceInfo(service: ServiceType): ServiceInfo {
    return serviceStateManager.getServiceInfo(service);
  }

  public getAllServices(): Record<ServiceType, ServiceInfo> {
    return serviceStateManager.getAllServices();
  }

  public onLog(listener: LogListener): () => void {
    return processLogger.onLog(listener);
  }

  public onStatusChange(listener: StatusListener): () => void {
    return serviceStateManager.onStatusChange(listener);
  }

  public emitLog(service: LogServiceType, type: "stdout" | "stderr" | "system", message: string): void {
    processLogger.emitLog(service, type, message);
  }

  public async ensureConfigurations(dirs: WorkspaceDirectories): Promise<void> {
    try {
      await generateAllConfigs(dirs);
    } catch (err) {
      console.warn("Failed to generate default configs:", err);
    }
  }

  public async startNginx(): Promise<boolean> {
    if (this.getServiceInfo("nginx").status === "running") {
      this.emitLog("nginx", "system", "Nginx is already running.");
      return true;
    }

    serviceStateManager.setStatus("nginx", "starting");
    this.emitLog("nginx", "system", "Starting Nginx HTTP Server...");

    const dirs = await getWorkspaceDirectories();
    await this.ensureConfigurations(dirs);

    if (!isTauri()) {
      return processSimulator.simulateStart("nginx", 80);
    }

    try {
      const { command, args } = await createNginxCommand(dirs);
      this.emitLog("nginx", "system", `Command: nginx ${args.join(" ")}`);
      bindProcessEvents("nginx", command, () => this.activeChildren.delete("nginx"));

      const child = await command.spawn();
      this.activeChildren.set("nginx", child);
      serviceStateManager.setStatus("nginx", "running", child.pid);
      this.emitLog("nginx", "system", `Nginx started successfully (PID: ${child.pid}) on port 80`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      serviceStateManager.setStatus("nginx", "error", null, msg);
      this.emitLog("nginx", "stderr", `Failed to start Nginx: ${msg}`);
      this.emitLog("nginx", "system", "Hint: Ensure Nginx binary is located in bin/nginx/ or accessible in system PATH.");
      return false;
    }
  }

  public async reloadNginx(): Promise<boolean> {
    const info = this.getServiceInfo("nginx");
    if (info.status !== "running") {
      this.emitLog("nginx", "system", "Nginx is not running; configuration saved for next startup.");
      return false;
    }

    const dirs = await getWorkspaceDirectories();
    this.emitLog("nginx", "system", "Reloading Nginx configuration (hot reload)...");

    if (!isTauri()) {
      this.emitLog("nginx", "system", "[Simulation Mode] Nginx configuration reloaded successfully.");
      return true;
    }

    try {
      const command = await createNginxReloadCommand(dirs);
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

  public async startPhp(): Promise<boolean> {
    if (this.getServiceInfo("php").status === "running") {
      this.emitLog("php", "system", "PHP is already running.");
      return true;
    }

    serviceStateManager.setStatus("php", "starting");
    this.emitLog("php", "system", "Starting PHP FastCGI Engine on port 9000...");

    const dirs = await getWorkspaceDirectories();
    await this.ensureConfigurations(dirs);

    if (!isTauri()) {
      return processSimulator.simulateStart("php", 9000);
    }

    try {
      const { command, args, programName } = await createPhpCommand(dirs);
      this.emitLog("php", "system", `Command: ${programName} ${args.join(" ")}`);
      bindProcessEvents("php", command, () => this.activeChildren.delete("php"));

      const child = await command.spawn();
      this.activeChildren.set("php", child);
      serviceStateManager.setStatus("php", "running", child.pid);
      this.emitLog("php", "system", `PHP FastCGI engine started successfully (PID: ${child.pid}) on 127.0.0.1:9000`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      serviceStateManager.setStatus("php", "error", null, msg);
      this.emitLog("php", "stderr", `Failed to start PHP: ${msg}`);
      this.emitLog("php", "system", "Hint: Ensure php-cgi.exe is located in bin/php/ or accessible in system PATH.");
      return false;
    }
  }

  public async startMariaDb(): Promise<boolean> {
    if (this.getServiceInfo("mariadb").status === "running") {
      this.emitLog("mariadb", "system", "MariaDB is already running.");
      return true;
    }

    serviceStateManager.setStatus("mariadb", "starting");
    this.emitLog("mariadb", "system", "Starting MariaDB SQL Server...");

    const dirs = await getWorkspaceDirectories();
    await this.ensureConfigurations(dirs);

    if (!isTauri()) {
      return processSimulator.simulateStart("mariadb", 3306);
    }

    try {
      const { command, args } = await createMariaDbCommand(dirs);
      this.emitLog("mariadb", "system", `Command: mysqld ${args.join(" ")}`);
      bindProcessEvents("mariadb", command, () => this.activeChildren.delete("mariadb"));

      const child = await command.spawn();
      this.activeChildren.set("mariadb", child);
      serviceStateManager.setStatus("mariadb", "running", child.pid);
      this.emitLog("mariadb", "system", `MariaDB server started successfully (PID: ${child.pid}) on port 3306`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      serviceStateManager.setStatus("mariadb", "error", null, msg);
      this.emitLog("mariadb", "stderr", `Failed to start MariaDB: ${msg}`);
      this.emitLog("mariadb", "system", "Hint: Ensure mysqld.exe is located in bin/mariadb/bin/ or accessible in system PATH.");
      return false;
    }
  }

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

  public async stopService(service: ServiceType): Promise<boolean> {
    const info = this.getServiceInfo(service);
    if (info.status === "stopped") {
      this.emitLog(service, "system", `${service} is already stopped.`);
      return true;
    }

    serviceStateManager.setStatus(service, "stopping");
    this.emitLog(service, "system", `Stopping ${info.displayName}...`);

    if (!isTauri()) {
      return processSimulator.simulateStop(service);
    }

    const child = this.activeChildren.get(service);
    const pid = info.pid;

    try {
      await killProcess(child, pid);
      this.activeChildren.delete(service);
      serviceStateManager.setStatus(service, "stopped");
      this.emitLog(service, "system", `${info.displayName} stopped cleanly.`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitLog(service, "stderr", `Error stopping ${service}: ${msg}`);
      serviceStateManager.setStatus(service, "stopped");
      this.activeChildren.delete(service);
      return false;
    }
  }

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

  public async stopAllServices(): Promise<Record<ServiceType, boolean>> {
    this.emitLog("nginx", "system", "=== Stopping All Lados Stack Services (Graceful Shutdown) ===");
    const nginxStopped = await this.stopService("nginx");
    const phpStopped = await this.stopService("php");
    const mariadbStopped = await this.stopService("mariadb");

    return {
      nginx: nginxStopped,
      php: phpStopped,
      mariadb: mariadbStopped,
    };
  }

  public async restartService(service: ServiceType): Promise<boolean> {
    await this.stopService(service);
    await new Promise((resolve) => setTimeout(resolve, 800));
    return this.startService(service);
  }
}

export const processManager = new ProcessManagerService();
