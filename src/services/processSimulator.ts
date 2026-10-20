import type { ServiceType } from "./processTypes";
import { processLogger } from "./processLogger";
import { serviceStateManager } from "./serviceState";

class ProcessSimulator {
  private mockIntervals: Map<ServiceType, number> = new Map();

  public simulateStart(service: ServiceType, port: number): boolean {
    const fakePid = Math.floor(1000 + Math.random() * 9000);
    serviceStateManager.setStatus(service, "running", fakePid);
    processLogger.emitLog(
      service,
      "system",
      `[Simulation Mode] ${service.toUpperCase()} started on port ${port} (PID: ${fakePid})`
    );
    processLogger.emitLog(
      service,
      "stdout",
      `Ready for incoming connections on 127.0.0.1:${port}`
    );

    const interval = window.setInterval(() => {
      if (serviceStateManager.getServiceInfo(service).status === "running") {
        processLogger.emitLog(
          service,
          "stdout",
          `[${new Date().toLocaleTimeString()}] Health check OK. Connections: ${Math.floor(Math.random() * 5)}`
        );
      }
    }, 15000);

    this.mockIntervals.set(service, interval);
    return true;
  }

  public simulateStop(service: ServiceType): boolean {
    const interval = this.mockIntervals.get(service);
    if (interval) {
      clearInterval(interval);
      this.mockIntervals.delete(service);
    }

    serviceStateManager.setStatus(service, "stopped");
    processLogger.emitLog(
      service,
      "system",
      `[Simulation Mode] ${service.toUpperCase()} stopped cleanly.`
    );
    return true;
  }
}

export const processSimulator = new ProcessSimulator();
