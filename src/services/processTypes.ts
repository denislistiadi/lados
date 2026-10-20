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

export function createDefaultServiceInfo(): Map<ServiceType, ServiceInfo> {
  const map = new Map<ServiceType, ServiceInfo>();
  map.set("nginx", {
    name: "nginx",
    displayName: "Nginx HTTP Server",
    status: "stopped",
    pid: null,
    port: 80,
    startTime: null,
    lastError: null,
  });

  map.set("php", {
    name: "php",
    displayName: "PHP FastCGI Engine",
    status: "stopped",
    pid: null,
    port: 9000,
    startTime: null,
    lastError: null,
  });

  map.set("mariadb", {
    name: "mariadb",
    displayName: "MariaDB SQL Server",
    status: "stopped",
    pid: null,
    port: 3306,
    startTime: null,
    lastError: null,
  });

  return map;
}
