import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  processManager,
  type ServiceType,
  type LogServiceType,
  type ServiceStatus,
  type ServiceInfo,
  type LogEntry,
} from "@/services/processManager";

export const useProcessManager = defineStore("processManager", () => {
  const services = ref<Record<ServiceType, ServiceInfo>>(processManager.getAllServices());
  const logs = ref<LogEntry[]>([]);
  const filter = ref<LogServiceType | "all">("all");
  const maxLogs = ref<number>(800);
  const autoScroll = ref<boolean>(true);
  const isStartingAll = ref<boolean>(false);
  const isStoppingAll = ref<boolean>(false);

  let initialized = false;

  function initListeners(): void {
    if (initialized) return;
    initialized = true;

    // Listen to live logs from processManager
    processManager.onLog((entry: LogEntry) => {
      logs.value.push(entry);
      if (logs.value.length > maxLogs.value) {
        logs.value.splice(0, logs.value.length - maxLogs.value);
      }
    });

    // Listen to status changes from processManager
    processManager.onStatusChange((service: ServiceType, _status: ServiceStatus, info: ServiceInfo) => {
      services.value = {
        ...services.value,
        [service]: info,
      };
    });
  }

  // Initialize immediately
  initListeners();

  const filteredLogs = computed(() => {
    if (filter.value === "all") {
      return logs.value;
    }
    return logs.value.filter((l) => l.service === filter.value);
  });

  const isAnyRunning = computed(() => {
    return Object.values(services.value).some((s) => s.status === "running");
  });

  const isAllRunning = computed(() => {
    return Object.values(services.value).every((s) => s.status === "running");
  });

  async function startService(service: ServiceType): Promise<boolean> {
    return processManager.startService(service);
  }

  async function stopService(service: ServiceType): Promise<boolean> {
    return processManager.stopService(service);
  }

  async function restartService(service: ServiceType): Promise<boolean> {
    return processManager.restartService(service);
  }

  async function startAllServices(): Promise<Record<ServiceType, boolean>> {
    isStartingAll.value = true;
    try {
      return await processManager.startAllServices();
    } finally {
      isStartingAll.value = false;
    }
  }

  async function stopAllServices(): Promise<Record<ServiceType, boolean>> {
    isStoppingAll.value = true;
    try {
      return await processManager.stopAllServices();
    } finally {
      isStoppingAll.value = false;
    }
  }

  function clearLogs(service?: LogServiceType): void {
    if (service) {
      logs.value = logs.value.filter((l) => l.service !== service);
    } else {
      logs.value = [];
    }
  }

  function setFilter(newFilter: LogServiceType | "all"): void {
    filter.value = newFilter;
  }

  function toggleAutoScroll(): void {
    autoScroll.value = !autoScroll.value;
  }

  return {
    services,
    logs,
    filter,
    filteredLogs,
    isAnyRunning,
    isAllRunning,
    isStartingAll,
    isStoppingAll,
    autoScroll,
    startService,
    stopService,
    restartService,
    startAllServices,
    stopAllServices,
    clearLogs,
    setFilter,
    toggleAutoScroll,
  };
});
