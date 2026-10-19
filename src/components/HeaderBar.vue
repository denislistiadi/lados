<script setup lang="ts">
import { computed, ref } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProcessManager } from "@/stores/processManager";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import { isTauri } from "@/services/workspace";
import {
  Server,
  Play,
  Square,
  Package,
  RefreshCw,
  Code2,
  CheckCircle2,
  ChevronDown,
} from "lucide-vue-next";

const emit = defineEmits<{
  (e: "openDownloader"): void;
  (e: "openSslModal"): void;
}>();

const workspaceStore = useWorkspaceStore();
const processStore = useProcessManager();
const downloaderStore = useBinaryDownloaderStore();

const showPhpDropdown = ref(false);
const phpVersions = [
  { id: "8.4", label: "PHP 8.4", badge: "Latest", desc: "Property hooks, JIT optimizations" },
  { id: "8.3", label: "PHP 8.3", badge: "Stable", desc: "Typed constants, json_validate" },
  { id: "8.2", label: "PHP 8.2", badge: "LTS", desc: "Readonly classes, mature stability" },
];

const globalStatus = computed(() => {
  if (processStore.isAllRunning) {
    return {
      label: "All Services Running",
      class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      dot: "bg-emerald-400 animate-pulse",
    };
  }
  if (processStore.isAnyRunning) {
    return {
      label: "Services Partially Active",
      class: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      dot: "bg-amber-400 animate-pulse",
    };
  }
  return {
    label: "All Services Stopped",
    class: "bg-slate-800 text-slate-400 border-slate-700",
    dot: "bg-slate-500",
  };
});

async function selectPhpVersion(version: string) {
  showPhpDropdown.value = false;
  if (workspaceStore.activePhpVersion === version) return;

  await workspaceStore.setPhpVersion(version);
  // Auto-restart PHP if currently running to load the newly selected version
  if (processStore.services.php.status === "running") {
    await processStore.restartService("php");
  }
}
</script>

<template>
  <header class="glass-panel sticky top-0 z-40 px-6 py-3 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
    <!-- Brand & Logo -->
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
        <Server class="w-5 h-5 text-white" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-extrabold tracking-tight text-white font-mono">LADOS</h1>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 font-semibold uppercase tracking-wider">
            v0.1.0 Bento
          </span>
        </div>
        <p class="text-xs text-slate-400 font-medium">Portable Local Web Server Stack &bull; Pure TypeScript</p>
      </div>
    </div>

    <!-- Center / Actions Section -->
    <div class="flex items-center gap-3 flex-wrap">
      <!-- Global Status Indicator -->
      <div
        class="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border transition shadow-sm font-medium"
        :class="globalStatus.class"
      >
        <span class="w-2 h-2 rounded-full" :class="globalStatus.dot"></span>
        <span>{{ globalStatus.label }}</span>
      </div>

      <!-- Active PHP Version Switcher Pill / Dropdown -->
      <div class="relative">
        <button
          @click="showPhpDropdown = !showPhpDropdown"
          class="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 text-xs font-semibold flex items-center gap-2 transition shadow-sm"
          title="Ganti versi PHP aktif"
        >
          <Code2 class="w-3.5 h-3.5 text-indigo-400" />
          <span>PHP {{ workspaceStore.activePhpVersion }}</span>
          <ChevronDown class="w-3 h-3 text-slate-400 transition" :class="{ 'rotate-180': showPhpDropdown }" />
        </button>

        <!-- PHP Dropdown Menu -->
        <div
          v-if="showPhpDropdown"
          class="absolute left-0 mt-2 w-64 rounded-2xl glass-modal p-2 shadow-2xl z-50 space-y-1"
        >
          <div class="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/5">
            Pilih Versi PHP Aktif
          </div>

          <button
            v-for="ver in phpVersions"
            :key="ver.id"
            @click="selectPhpVersion(ver.id)"
            class="w-full p-2.5 rounded-xl text-left transition flex items-start justify-between gap-2"
            :class="workspaceStore.activePhpVersion === ver.id
              ? 'bg-indigo-600/20 text-white border border-indigo-500/30'
              : 'hover:bg-slate-800/80 text-slate-300'"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs">{{ ver.label }}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  {{ ver.badge }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-0.5">{{ ver.desc }}</p>
            </div>
            <CheckCircle2
              v-if="workspaceStore.activePhpVersion === ver.id"
              class="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
            />
          </button>
        </div>
      </div>

      <!-- Package Hub (Modal Downloader) Button -->
      <button
        @click="emit('openDownloader')"
        class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-900/50 to-slate-900 hover:from-indigo-800/60 hover:to-slate-800 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition shadow-sm"
        title="Open Package Hub (Binary Downloader & Package Manager)"
      >
        <Package class="w-3.5 h-3.5 text-indigo-400" />
        <span>Package Hub</span>
        <span
          v-if="downloaderStore.isDownloadingAny"
          class="w-2 h-2 rounded-full bg-amber-400 animate-ping"
        ></span>
      </button>

      <div class="h-4 w-px bg-slate-800 hidden sm:block"></div>

      <!-- Global Service Controls: Start All & Stop All -->
      <div class="flex items-center gap-2">
        <button
          @click="processStore.startAllServices"
          :disabled="processStore.isStartingAll || processStore.isAllRunning"
          class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Start all servers (Nginx, PHP, MariaDB)"
        >
          <Play class="w-3.5 h-3.5" :class="{ 'animate-spin': processStore.isStartingAll }" />
          <span>{{ processStore.isStartingAll ? 'Starting...' : 'Start All' }}</span>
        </button>

        <button
          @click="processStore.stopAllServices"
          :disabled="processStore.isStoppingAll || !processStore.isAnyRunning"
          class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-rose-600/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Stop all servers cleanly (Graceful Termination)"
        >
          <Square class="w-3.5 h-3.5" :class="{ 'animate-spin': processStore.isStoppingAll }" />
          <span>{{ processStore.isStoppingAll ? 'Stopping...' : 'Stop All' }}</span>
        </button>
      </div>

      <!-- Refresh Workspace & Runtime Badge -->
      <div class="flex items-center gap-2 ml-1">
        <span
          class="text-[11px] px-2 py-1 rounded-lg border font-mono hidden md:inline-block"
          :class="isTauri() ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
        >
          {{ isTauri() ? "Tauri v2" : "Browser" }}
        </span>

        <button
          @click="workspaceStore.refresh"
          :disabled="workspaceStore.isLoading"
          class="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition disabled:opacity-50"
          title="Refresh status server dan konfigurasi"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': workspaceStore.isLoading }" />
        </button>
      </div>
    </div>
  </header>
</template>
