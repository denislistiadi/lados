import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { vhostWatcher } from "@/services/vhostWatcher";
import type { VirtualHostProject } from "@/services/vhostScanner";
import { sslManager, type MkcertStatus } from "@/services/sslManager";
import { readSystemHosts, syncHostsDomains } from "@/services/hostsManager";

export const useVhostStore = defineStore("vhost", () => {
  const projects = ref<VirtualHostProject[]>([]);
  const isWatching = ref<boolean>(false);
  const isScanning = ref<boolean>(false);
  const lastSyncTime = ref<string | null>(null);

  // SSL & mkcert state
  const mkcertStatus = ref<MkcertStatus>({
    available: false,
    caInstalled: false,
    isCustomBin: false,
  });
  const isInstallingCa = ref<boolean>(false);
  const isGeneratingSsl = ref<boolean>(false);

  // Hosts state
  const hostsDomains = ref<string[]>([]);
  const isSyncingHosts = ref<boolean>(false);
  const hostsLastEscalated = ref<boolean>(false);

  let initialized = false;

  async function checkSslStatus(): Promise<void> {
    mkcertStatus.value = await sslManager.checkMkcert();
  }

  async function refreshHosts(): Promise<void> {
    const res = await readSystemHosts();
    hostsDomains.value = res.ladosDomains;
  }

  async function initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;

    isScanning.value = true;
    try {
      await checkSslStatus();
      await refreshHosts();

      vhostWatcher.onProjectsChange((updatedProjects) => {
        projects.value = updatedProjects;
        lastSyncTime.value = new Date().toLocaleTimeString();
        isWatching.value = vhostWatcher.getIsWatching();
      });

      await vhostWatcher.init();
      isWatching.value = vhostWatcher.getIsWatching();
      await refreshHosts();
    } catch (err) {
      console.error("Failed to initialize vhost store:", err);
    } finally {
      isScanning.value = false;
    }
  }

  async function scanAndSync(): Promise<void> {
    isScanning.value = true;
    try {
      projects.value = await vhostWatcher.scanAndSync();
      lastSyncTime.value = new Date().toLocaleTimeString();
      await refreshHosts();
      await checkSslStatus();
    } finally {
      isScanning.value = false;
    }
  }

  async function createSample(name: string, type: "laravel" | "wordpress" | "native"): Promise<VirtualHostProject | null> {
    isScanning.value = true;
    try {
      const created = await vhostWatcher.createSampleProject(name, type);
      await refreshHosts();
      return created;
    } finally {
      isScanning.value = false;
    }
  }

  async function syncHosts(): Promise<boolean> {
    isSyncingHosts.value = true;
    try {
      const domains = projects.value.map((p) => p.domain);
      const res = await syncHostsDomains(domains, true);
      hostsLastEscalated.value = res.escalated;
      await refreshHosts();
      return res.success;
    } finally {
      isSyncingHosts.value = false;
    }
  }

  async function installCa(): Promise<boolean> {
    isInstallingCa.value = true;
    try {
      const success = await sslManager.installLocalCa();
      await checkSslStatus();
      return success;
    } finally {
      isInstallingCa.value = false;
    }
  }

  async function generateSslForDomain(domain: string): Promise<boolean> {
    isGeneratingSsl.value = true;
    try {
      const res = await sslManager.generateCertificate(domain);
      if (res.success) {
        await scanAndSync();
      }
      return res.success;
    } finally {
      isGeneratingSsl.value = false;
    }
  }

  function startWatch(): void {
    vhostWatcher.startWatcher().then((success) => {
      isWatching.value = success;
    });
  }

  function stopWatch(): void {
    vhostWatcher.stopWatcher();
    isWatching.value = false;
  }

  const totalProjects = computed(() => projects.value.length);
  const sslActiveCount = computed(() => projects.value.filter((p) => p.hasSsl).length);

  const frameworkCount = computed(() => {
    const counts: Record<string, number> = {
      Laravel: 0,
      WordPress: 0,
      "Native PHP": 0,
      "HTML/Static": 0,
    };
    for (const p of projects.value) {
      counts[p.framework] = (counts[p.framework] || 0) + 1;
    }
    return counts;
  });

  return {
    projects,
    isWatching,
    isScanning,
    lastSyncTime,
    totalProjects,
    sslActiveCount,
    frameworkCount,
    mkcertStatus,
    isInstallingCa,
    isGeneratingSsl,
    hostsDomains,
    isSyncingHosts,
    hostsLastEscalated,
    initialize,
    scanAndSync,
    createSample,
    syncHosts,
    installCa,
    generateSslForDomain,
    startWatch,
    stopWatch,
  };
});
