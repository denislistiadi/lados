import {
  type ServiceType,
  type ServiceStatus,
  type ServiceInfo,
  type StatusListener,
  createDefaultServiceInfo,
} from "./processTypes";
import { saveState } from "./workspace";

class ServiceStateManager {
  private serviceInfo: Map<ServiceType, ServiceInfo> = createDefaultServiceInfo();
  private statusListeners: Set<StatusListener> = new Set();

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

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public setStatus(service: ServiceType, status: ServiceStatus, pid: number | null = null, error: string | null = null): void {
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
}

export const serviceStateManager = new ServiceStateManager();
