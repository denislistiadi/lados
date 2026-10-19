<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProcessManager } from "@/stores/processManager";
import { useVhostStore } from "@/stores/vhost";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import type { VirtualHostProject, FrameworkType } from "@/services/vhostScanner";
import { getSystemHostsPath } from "@/services/hostsManager";
import ConsoleLog from "@/components/ConsoleLog.vue";
import BinaryDownloader from "@/components/BinaryDownloader.vue";
import {
  Power,
  RotateCw,
  Globe,
  FileCode,
  Database,
  Folder,
  ExternalLink,
  Terminal,
  Package,
  Lock,
  Plus,
  RefreshCw,
  X,
  Settings,
  Check,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-vue-next";

const workspaceStore = useWorkspaceStore();
const processStore = useProcessManager();
const vhostStore = useVhostStore();
const downloaderStore = useBinaryDownloaderStore();

// Modals / Drawer State
const showSettings = ref(false);
const activeSettingsTab = ref<"php" | "sites" | "packages" | "ssl" | "logs">("php");
const showNewProjectModal = ref(false);

const systemHostsPath = getSystemHostsPath();
const isGeneratingFor = ref<string | null>(null);

const newProjectName = ref("");
const newProjectType = ref<"laravel" | "wordpress" | "native">("laravel");
const isCreatingProject = ref(false);

onMounted(async () => {
  await workspaceStore.initialize();
  await vhostStore.initialize();
  await downloaderStore.refreshInstalledStatus();
});

const frameworkBadges: Record<FrameworkType, { label: string; class: string }> = {
  Laravel: { label: "Laravel", class: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  WordPress: { label: "WordPress", class: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  "Native PHP": { label: "PHP Native", class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  "HTML/Static": { label: "Static HTML", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

const phpOptions = [
  { version: "8.4", badge: "Latest", desc: "Property hooks, asymmetric visibility" },
  { version: "8.3", badge: "Stable", desc: "Typed constants, json_validate" },
  { version: "8.2", badge: "LTS", desc: "Readonly classes, legacy compatibility" },
];

const isHeroLoading = computed(() => {
  return processStore.isStartingAll || processStore.isStoppingAll;
});

// Single-Click Project Launcher: immediately opens the project domain in default browser
async function handleOpenProject(project: VirtualHostProject) {
  const url = project.hasSsl ? `https://${project.domain}` : `http://${project.domain}`;
  await workspaceStore.openBrowserUrl(url);
}

// Master Toggle: Starts all servers or stops all servers cleanly (VPN style)
async function handleMasterToggle() {
  if (isHeroLoading.value) return;

  if (processStore.isAllRunning) {
    await processStore.stopAllServices();
  } else {
    await processStore.startAllServices();
  }
}

// Select PHP Version with automatic service reload
async function handleSelectPhp(version: string) {
  if (workspaceStore.activePhpVersion === version) return;
  await workspaceStore.setPhpVersion(version);

  if (processStore.services.php.status === "running") {
    await processStore.restartService("php");
  }
}

// Quick PHP Switcher: Cycles through PHP versions
async function handleCyclePhp() {
  const versions = phpOptions.map((p) => p.version);
  const currentIndex = versions.indexOf(workspaceStore.activePhpVersion);
  const nextIndex = (currentIndex + 1) % versions.length;
  await handleSelectPhp(versions[nextIndex]);
}

// Open settings tab directly
function openSettingsTab(tab: "php" | "sites" | "packages" | "ssl" | "logs") {
  activeSettingsTab.value = tab;
  showSettings.value = true;
}

// SSL Generation handler
async function handleGenerateSsl(domain: string) {
  isGeneratingFor.value = domain;
  try {
    await vhostStore.generateSslForDomain(domain);
  } finally {
    isGeneratingFor.value = null;
  }
}

// Create new sample project
async function handleCreateProject() {
  if (!newProjectName.value.trim()) return;
  isCreatingProject.value = true;
  try {
    await vhostStore.createSample(newProjectName.value, newProjectType.value);
    newProjectName.value = "";
    showNewProjectModal.value = false;
  } finally {
    isCreatingProject.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-3 sm:p-5 font-sans selection:bg-cyan-500 selection:text-white">
    
    <!-- VPN CLIENT MAIN WINDOW (Max-Width ~430px) -->
    <div class="w-full max-w-[430px] bg-slate-900/80 border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-5 relative ring-1 ring-white/5">
      
      <!-- TOP STATUS BAR -->
      <header class="flex items-center justify-between">
        <!-- Brand & App Info -->
        <div class="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Lados Logo"
            class="w-8 h-8 rounded-xl object-cover shadow-md shadow-cyan-500/25 ring-1 ring-white/15 shrink-0"
          />
          <div>
            <div class="flex items-center gap-1.5">
              <h1 class="text-base font-extrabold tracking-tight text-white font-mono">LADOS</h1>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-400 font-semibold border border-cyan-500/20">
                v0.1.0
              </span>
            </div>
            <p class="text-[10px] text-slate-400">Local Server Stack</p>
          </div>
        </div>

        <!-- Pinned Actions (Top Right) -->
        <div class="flex items-center gap-1.5">
          <!-- Active PHP Version Pill (Click to cycle or open settings) -->
          <button
            @click="handleCyclePhp"
            class="text-[11px] font-mono px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-indigo-300 border border-indigo-500/20 transition flex items-center gap-1.5 shadow-sm"
            title="Click to cycle active PHP version (8.4, 8.3, 8.2)"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            v{{ workspaceStore.activePhpVersion }}
            <RefreshCw class="w-2.5 h-2.5 opacity-60" />
          </button>

          <!-- Settings & Tools Button -->
          <button
            @click="openSettingsTab('php')"
            class="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-400 hover:text-white border border-slate-700/70 transition shadow-sm relative"
            title="Settings & Tools"
          >
            <Settings class="w-4 h-4" />
            <span
              v-if="downloaderStore.isDownloadingAny"
              class="w-2 h-2 rounded-full bg-amber-400 absolute top-1 right-1 animate-ping"
            ></span>
          </button>
        </div>
      </header>

      <!-- CENTER STAGE: BIG VPN POWER SWITCH -->
      <div class="flex flex-col items-center justify-center py-4 relative select-none">
        <!-- Multi-layered glowing pulse waves when running -->
        <div
          v-if="processStore.isAllRunning"
          class="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-ping pointer-events-none"
        ></div>
        <div
          v-if="processStore.isAllRunning"
          class="absolute w-52 h-52 rounded-full bg-emerald-500/5 animate-pulse pointer-events-none"
        ></div>

        <!-- The Giant Circular Power Button -->
        <button
          @click="handleMasterToggle"
          :disabled="isHeroLoading"
          class="relative w-32 h-32 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl group active:scale-95"
          :class="[
            processStore.isAllRunning
              ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-emerald-500/40 ring-8 ring-emerald-500/20 hover:scale-105'
              : processStore.isAnyRunning
              ? 'bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-amber-500/40 ring-8 ring-amber-500/20 hover:scale-105'
              : 'bg-gradient-to-b from-slate-800 to-slate-900 text-slate-400 border border-slate-700/80 shadow-black/60 ring-4 ring-slate-800/40 hover:text-white hover:border-slate-600 hover:scale-105',
            isHeroLoading ? 'opacity-80 cursor-wait' : 'cursor-pointer'
          ]"
        >
          <RefreshCw v-if="isHeroLoading" class="w-12 h-12 animate-spin text-white" />
          <Power v-else class="w-12 h-12 sm:w-14 sm:h-14 transition-transform group-hover:scale-110" />
        </button>

        <!-- VPN Status Indicator & Wording -->
        <div class="mt-4 text-center">
          <div class="flex items-center justify-center gap-2">
            <span
              class="w-2.5 h-2.5 rounded-full inline-block transition-all"
              :class="processStore.isAllRunning
                ? 'bg-emerald-400 ring-4 ring-emerald-400/20'
                : processStore.isAnyRunning
                ? 'bg-amber-400 ring-4 ring-amber-400/20'
                : 'bg-slate-600'"
            ></span>
            <span class="text-sm font-extrabold tracking-widest uppercase font-mono text-white">
              {{
                isHeroLoading
                  ? (processStore.isStartingAll ? 'CONNECTING...' : 'DISCONNECTING...')
                  : processStore.isAllRunning
                  ? 'CONNECTED'
                  : processStore.isAnyRunning
                  ? 'PARTIALLY ACTIVE'
                  : 'DISCONNECTED'
              }}
            </span>
          </div>
          <p class="text-[11px] text-slate-400 mt-1">
            {{
              processStore.isAllRunning
                ? 'All local servers are active and ready'
                : processStore.isAnyRunning
                ? 'Some services are stopped. Tap to sync'
                : 'Tap power button to start local stack'
            }}
          </p>
        </div>
      </div>

      <!-- RUNNING DETAILS CARD (COMPACT STACK MONITOR) -->
      <div class="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
        <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider pb-1 border-b border-slate-800/80">
          <span>RUNNING DETAILS</span>
          <span :class="processStore.isAllRunning ? 'text-emerald-400' : 'text-slate-500'">
            {{ processStore.isAllRunning ? '3/3 SERVICES LIVE' : processStore.isAnyRunning ? '1/3 ACTIVE' : 'STACK OFFLINE' }}
          </span>
        </div>

        <!-- 1. Nginx Row -->
        <div class="flex items-center justify-between text-xs py-0.5">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="processStore.services.nginx.status === 'running' ? 'bg-emerald-400 ring-2 ring-emerald-500/20' : 'bg-slate-600'"
            ></span>
            <Globe class="w-3.5 h-3.5 text-sky-400" />
            <span class="font-semibold text-slate-200">Nginx</span>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              v-if="processStore.services.nginx.status === 'running'"
              @click="workspaceStore.openBrowserUrl('http://localhost')"
              class="text-[11px] font-mono text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-0.5"
              title="Open http://localhost in browser"
            >
              :80
              <ExternalLink class="w-2.5 h-2.5" />
            </button>
            <span v-else class="text-[11px] font-mono text-slate-500">:80</span>

            <button
              @click="processStore.services.nginx.status === 'running' ? processStore.stopService('nginx') : processStore.startService('nginx')"
              class="px-2 py-0.5 rounded-md text-[10px] font-semibold border transition"
              :class="processStore.services.nginx.status === 'running'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'"
            >
              {{ processStore.services.nginx.status === 'running' ? 'Stop' : 'Start' }}
            </button>
          </div>
        </div>

        <!-- 2. PHP FastCGI Row -->
        <div class="flex items-center justify-between text-xs py-0.5">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="processStore.services.php.status === 'running' ? 'bg-emerald-400 ring-2 ring-emerald-500/20' : 'bg-slate-600'"
            ></span>
            <FileCode class="w-3.5 h-3.5 text-indigo-400" />
            <span class="font-semibold text-slate-200">PHP FastCGI</span>
            <span class="text-[10px] font-mono text-indigo-400 px-1 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/20">
              v{{ workspaceStore.activePhpVersion }}
            </span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-mono" :class="processStore.services.php.status === 'running' ? 'text-slate-300' : 'text-slate-500'">:9000</span>

            <button
              v-if="processStore.services.php.status === 'running'"
              @click="processStore.restartService('php')"
              class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Restart PHP FastCGI"
            >
              <RotateCw class="w-3 h-3" />
            </button>

            <button
              @click="processStore.services.php.status === 'running' ? processStore.stopService('php') : processStore.startService('php')"
              class="px-2 py-0.5 rounded-md text-[10px] font-semibold border transition"
              :class="processStore.services.php.status === 'running'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'"
            >
              {{ processStore.services.php.status === 'running' ? 'Stop' : 'Start' }}
            </button>
          </div>
        </div>

        <!-- 3. MariaDB Row -->
        <div class="flex items-center justify-between text-xs py-0.5">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              :class="processStore.services.mariadb.status === 'running' ? 'bg-emerald-400 ring-2 ring-emerald-500/20' : 'bg-slate-600'"
            ></span>
            <Database class="w-3.5 h-3.5 text-emerald-400" />
            <span class="font-semibold text-slate-200">MariaDB</span>
          </div>

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] font-mono" :class="processStore.services.mariadb.status === 'running' ? 'text-slate-300' : 'text-slate-500'">:3306</span>

            <button
              v-if="processStore.services.mariadb.status === 'running'"
              @click="processStore.restartService('mariadb')"
              class="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Restart MariaDB"
            >
              <RotateCw class="w-3 h-3" />
            </button>

            <button
              @click="processStore.services.mariadb.status === 'running' ? processStore.stopService('mariadb') : processStore.startService('mariadb')"
              class="px-2 py-0.5 rounded-md text-[10px] font-semibold border transition"
              :class="processStore.services.mariadb.status === 'running'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'"
            >
              {{ processStore.services.mariadb.status === 'running' ? 'Stop' : 'Start' }}
            </button>
          </div>
        </div>

        <!-- Quick Sites Summary Trigger -->
        <div class="pt-1 border-t border-slate-800/60">
          <button
            @click="openSettingsTab('sites')"
            class="w-full px-2.5 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-left flex items-center justify-between text-[11px] transition group"
          >
            <div class="flex items-center gap-1.5 text-slate-300">
              <Globe class="w-3.5 h-3.5 text-cyan-400" />
              <span>{{ vhostStore.projects.length }} Local Virtual Hosts</span>
              <span class="text-slate-500 font-mono">(*.test)</span>
            </div>
            <div class="flex items-center gap-1 text-cyan-400 group-hover:translate-x-0.5 transition">
              <span>View Sites</span>
              <ChevronRight class="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>

      <!-- PINNED DOCK (BOTTOM SHORTCUTS) -->
      <footer class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        <!-- Terminal Launcher -->
        <button
          @click="downloaderStore.launchTerminal()"
          class="flex-1 py-2 px-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition flex items-center justify-center gap-1.5 text-xs font-semibold"
          title="Open Isolated Terminal (PATH prioritized)"
        >
          <Terminal class="w-3.5 h-3.5 text-cyan-400" />
          <span>Terminal</span>
        </button>

        <!-- Open Web Root Directory -->
        <button
          @click="workspaceStore.openDirectory(workspaceStore.directories?.www || 'www')"
          class="flex-1 py-2 px-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition flex items-center justify-center gap-1.5 text-xs font-semibold"
          title="Open www/ Directory in File Explorer"
        >
          <Folder class="w-3.5 h-3.5 text-amber-400" />
          <span>www/</span>
        </button>

        <!-- Debug Console Logs Drawer -->
        <button
          @click="openSettingsTab('logs')"
          class="flex-1 py-2 px-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition flex items-center justify-center gap-1.5 text-xs font-semibold"
          title="View Debug & Console Logs"
        >
          <RotateCw class="w-3.5 h-3.5 text-indigo-400" />
          <span>Logs</span>
        </button>

        <!-- Full Settings Modal Trigger -->
        <button
          @click="openSettingsTab('php')"
          class="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition shrink-0"
          title="Open Full Settings & Tools"
        >
          <SlidersHorizontal class="w-3.5 h-3.5" />
        </button>
      </footer>

    </div>

    <!-- SETTINGS & TOOLS MODAL / DRAWER (DISEMATKAN) -->
    <div
      v-if="showSettings"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all"
      @click.self="showSettings = false"
    >
      <div class="glass-modal w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        
        <!-- Modal Top Bar -->
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Settings class="w-4 h-4" />
            </div>
            <div>
              <h3 class="font-bold text-sm sm:text-base text-white">Settings & Tools</h3>
              <p class="text-[11px] text-slate-400">Configure PHP runtime, virtual hosts, packages, and SSL</p>
            </div>
          </div>

          <button
            @click="showSettings = false"
            class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Horizontal Tab Selector -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/60 text-xs">
          <button
            @click="activeSettingsTab = 'php'"
            class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            :class="activeSettingsTab === 'php' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            <FileCode class="w-3.5 h-3.5" />
            <span>PHP Version</span>
          </button>

          <button
            @click="activeSettingsTab = 'sites'"
            class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            :class="activeSettingsTab === 'sites' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            <Globe class="w-3.5 h-3.5" />
            <span>Virtual Hosts ({{ vhostStore.projects.length }})</span>
          </button>

          <button
            @click="activeSettingsTab = 'packages'"
            class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            :class="activeSettingsTab === 'packages' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            <Package class="w-3.5 h-3.5" />
            <span>Package Hub</span>
          </button>

          <button
            @click="activeSettingsTab = 'ssl'"
            class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            :class="activeSettingsTab === 'ssl' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            <Lock class="w-3.5 h-3.5" />
            <span>SSL & Hosts</span>
          </button>

          <button
            @click="activeSettingsTab = 'logs'"
            class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
            :class="activeSettingsTab === 'logs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
          >
            <Terminal class="w-3.5 h-3.5" />
            <span>Console Logs</span>
          </button>
        </div>

        <!-- TAB 1: PHP VERSION SWITCHER -->
        <div v-if="activeSettingsTab === 'php'" class="space-y-3.5 py-1">
          <div class="space-y-1">
            <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Select Active PHP Version</h4>
            <p class="text-xs text-slate-400">
              Switching version automatically reloads PHP FastCGI (:9000) and rewrites <code class="text-indigo-300">php.ini</code>.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              v-for="opt in phpOptions"
              :key="opt.version"
              @click="handleSelectPhp(opt.version)"
              class="p-3.5 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 relative"
              :class="workspaceStore.activePhpVersion === opt.version
                ? 'bg-indigo-500/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'"
            >
              <div class="flex items-center justify-between">
                <span class="font-bold font-mono text-sm text-white">PHP {{ opt.version }}</span>
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                  :class="workspaceStore.activePhpVersion === opt.version
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'"
                >
                  {{ opt.badge }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 leading-tight">{{ opt.desc }}</p>
              <div v-if="workspaceStore.activePhpVersion === opt.version" class="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold pt-1">
                <Check class="w-3.5 h-3.5" />
                <span>Active Runtime</span>
              </div>
            </button>
          </div>

          <!-- Quick Paths Preview -->
          <div v-if="workspaceStore.directories" class="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div class="flex items-center justify-between">
              <span>PHP Binary:</span>
              <span class="text-cyan-400">{{ workspaceStore.directories.binPhp }}/</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Configuration:</span>
              <span class="text-slate-300">{{ workspaceStore.directories.etcPhp }}/php.ini</span>
            </div>
          </div>
        </div>

        <!-- TAB 2: VIRTUAL HOSTS -->
        <div v-if="activeSettingsTab === 'sites'" class="space-y-3 py-1">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Local Projects (www/)</h4>
              <p class="text-xs text-slate-400">Scanned and mapped to <code class="text-cyan-400">&lt;project&gt;.test</code></p>
            </div>
            <button
              @click="showNewProjectModal = true"
              class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>+ New Project</span>
            </button>
          </div>

          <!-- Sites List -->
          <div v-if="vhostStore.projects.length > 0" class="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            <div
              v-for="project in vhostStore.projects"
              :key="project.name"
              class="w-full p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                  <Globe class="w-3.5 h-3.5" />
                </div>
                <div class="min-w-0 text-left">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs sm:text-sm text-white font-mono truncate">{{ project.domain }}</span>
                    <span
                      class="text-[10px] px-1.5 py-0.2 rounded-full border"
                      :class="frameworkBadges[project.framework]?.class || 'bg-slate-800 text-slate-400 border-slate-700'"
                    >
                      {{ frameworkBadges[project.framework]?.label || project.framework }}
                    </span>
                    <span v-if="project.hasSsl" class="text-[10px] text-emerald-400 flex items-center gap-0.5" title="HTTPS Active">
                      <Lock class="w-3 h-3" />
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 font-mono truncate">{{ project.documentRoot }}</p>
                </div>
              </div>

              <button
                @click="handleOpenProject(project)"
                class="px-2.5 py-1 rounded-lg bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1 transition shrink-0"
              >
                <span>Open</span>
                <ExternalLink class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- Empty Sites State -->
          <div v-else class="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
            <p class="text-xs text-slate-400">No project directories found inside <code class="text-cyan-400">www/</code>.</p>
            <button
              @click="showNewProjectModal = true"
              class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold inline-flex items-center gap-1 transition"
            >
              <Plus class="w-3.5 h-3.5" />
              Create Sample Project
            </button>
          </div>
        </div>

        <!-- TAB 3: PACKAGE HUB -->
        <div v-if="activeSettingsTab === 'packages'" class="py-1">
          <BinaryDownloader />
        </div>

        <!-- TAB 4: SSL & HOSTS -->
        <div v-if="activeSettingsTab === 'ssl'" class="space-y-3.5 py-1">
          <!-- mkcert Section -->
          <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div class="flex items-start gap-2.5">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5"
                  :class="vhostStore.mkcertStatus.caInstalled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'"
                >
                  <ShieldCheck v-if="vhostStore.mkcertStatus.caInstalled" class="w-4 h-4" />
                  <ShieldAlert v-else class="w-4 h-4" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h5 class="font-bold text-xs sm:text-sm text-white">mkcert Local Root CA</h5>
                    <span
                      class="text-[10px] px-2 py-0.2 rounded-full font-semibold border"
                      :class="vhostStore.mkcertStatus.caInstalled
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'"
                    >
                      {{ vhostStore.mkcertStatus.caInstalled ? 'Root CA Installed' : 'Not Installed' }}
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    {{ vhostStore.mkcertStatus.available
                      ? 'mkcert is ready. Generated SSL certs are trusted by browsers (Chrome, Firefox, Edge).'
                      : 'mkcert binary not found in bin/mkcert/. Download it in Package Hub.'
                    }}
                  </p>
                </div>
              </div>

              <button
                v-if="vhostStore.mkcertStatus.available && !vhostStore.mkcertStatus.caInstalled"
                @click="vhostStore.installCa()"
                :disabled="vhostStore.isInstallingCa"
                class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
              >
                <Key class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isInstallingCa }" />
                <span>{{ vhostStore.isInstallingCa ? 'Installing...' : 'Install Root CA' }}</span>
              </button>
            </div>
          </div>

          <!-- Hosts File Sync Section -->
          <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h5 class="font-bold text-xs sm:text-sm text-white">System Hosts File</h5>
                <p class="text-[11px] text-slate-400 font-mono">Location: {{ systemHostsPath }}</p>
              </div>

              <button
                @click="vhostStore.syncHosts()"
                :disabled="vhostStore.isSyncingHosts"
                class="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
              >
                <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isSyncingHosts }" />
                <span>{{ vhostStore.isSyncingHosts ? 'Syncing...' : 'Sync Hosts Now' }}</span>
              </button>
            </div>

            <!-- Hosts Preview -->
            <div class="bg-slate-900/90 p-2.5 rounded-lg font-mono text-[11px] space-y-0.5 border border-slate-800">
              <span class="text-slate-500"># >>> LADOS DOMAINS START >>></span>
              <div v-for="d in vhostStore.hostsDomains" :key="d" class="text-emerald-400 pl-2">
                127.0.0.1 {{ d }}
              </div>
              <span class="text-slate-500"># >>> LADOS DOMAINS END >>></span>
            </div>
          </div>

          <!-- Domain Certificates -->
          <div class="space-y-1.5">
            <h5 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Domain Certificates (.pem)</h5>
            <div v-for="project in vhostStore.projects" :key="project.name" class="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <Lock class="w-3.5 h-3.5 text-slate-400" />
                <span class="font-mono font-semibold text-white">{{ project.domain }}</span>
              </div>

              <span v-if="project.hasSsl" class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30">
                <CheckCircle2 class="w-3 h-3" />
                HTTPS Active
              </span>
              <button
                v-else-if="vhostStore.mkcertStatus.available"
                @click="handleGenerateSsl(project.domain)"
                :disabled="isGeneratingFor === project.domain"
                class="px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
              >
                {{ isGeneratingFor === project.domain ? 'Generating...' : 'Generate SSL' }}
              </button>
              <span v-else class="text-[11px] text-slate-500">mkcert missing</span>
            </div>
          </div>
        </div>

        <!-- TAB 5: CONSOLE LOGS -->
        <div v-if="activeSettingsTab === 'logs'" class="py-1">
          <ConsoleLog />
        </div>

      </div>
    </div>

    <!-- MODAL: CREATE NEW PROJECT -->
    <div
      v-if="showNewProjectModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      @click.self="showNewProjectModal = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3.5 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <h3 class="font-bold text-sm text-white">Create New Web Project</h3>
          <button
            @click="showNewProjectModal = false"
            class="text-slate-400 hover:text-white"
            title="Close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs text-slate-400 mb-1">Project Folder Name</label>
            <input
              v-model="newProjectName"
              type="text"
              placeholder="e.g. my-app"
              class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
            <span class="text-[11px] text-slate-500 mt-1 block">
              Auto domain: <code>{{ newProjectName ? `${newProjectName}.test` : 'project.test' }}</code>
            </span>
          </div>

          <div>
            <label class="block text-xs text-slate-400 mb-1">Framework Preset</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                @click="newProjectType = 'laravel'"
                class="py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center"
                :class="newProjectType === 'laravel' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'"
              >
                Laravel
              </button>
              <button
                type="button"
                @click="newProjectType = 'wordpress'"
                class="py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center"
                :class="newProjectType === 'wordpress' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'"
              >
                WordPress
              </button>
              <button
                type="button"
                @click="newProjectType = 'native'"
                class="py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center"
                :class="newProjectType === 'native' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'"
              >
                PHP Native
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            @click="showNewProjectModal = false"
            class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            @click="handleCreateProject"
            :disabled="!newProjectName.trim() || isCreatingProject"
            class="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition disabled:opacity-50"
          >
            {{ isCreatingProject ? 'Creating...' : 'Create & Host' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>