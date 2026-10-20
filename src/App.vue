<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProcessManager } from "@/stores/processManager";
import { useVhostStore } from "@/stores/vhost";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import SettingsModal, { type SettingsTab } from "@/components/settings/SettingsModal.vue";
import NewProjectModal from "@/components/settings/NewProjectModal.vue";
import RunningDetailsCard from "@/components/RunningDetailsCard.vue";
import {
  Power,
  RotateCw,
  Folder,
  Terminal,
  RefreshCw,
  Settings,
  SlidersHorizontal,
} from "lucide-vue-next";

const workspaceStore = useWorkspaceStore();
const processStore = useProcessManager();
const vhostStore = useVhostStore();
const downloaderStore = useBinaryDownloaderStore();

// Modals / Drawer State
const showSettings = ref(false);
const activeSettingsTab = ref<SettingsTab>("php");
const showNewProjectModal = ref(false);

const phpOptions = ["8.4", "8.3", "8.2"];

onMounted(async () => {
  await workspaceStore.initialize();
  await vhostStore.initialize();
  await downloaderStore.refreshInstalledStatus();
});

const isHeroLoading = computed(() => {
  return processStore.isStartingAll || processStore.isStoppingAll;
});

// Master Toggle: Starts all servers or stops all servers cleanly (VPN style)
async function handleMasterToggle() {
  if (isHeroLoading.value) return;

  if (processStore.isAllRunning) {
    await processStore.stopAllServices();
  } else {
    await processStore.startAllServices();
  }
}

// Quick PHP Switcher: Cycles through PHP versions
async function handleCyclePhp() {
  const currentIndex = phpOptions.indexOf(workspaceStore.activePhpVersion);
  const nextIndex = (currentIndex + 1) % phpOptions.length;
  const newVer = phpOptions[nextIndex];
  await workspaceStore.setPhpVersion(newVer);

  if (processStore.services.php.status === "running") {
    await processStore.restartService("php");
  }
}

// Open settings tab directly
function openSettingsTab(tab: SettingsTab) {
  activeSettingsTab.value = tab;
  showSettings.value = true;
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

          <!-- Main Settings Trigger -->
          <button
            @click="openSettingsTab('php')"
            class="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/50 transition shadow-sm"
            title="Open Pinned Settings"
          >
            <Settings class="w-4 h-4" />
          </button>
        </div>
      </header>

      <!-- HERO: BIG VPN POWER SWITCH BUTTON -->
      <div class="flex flex-col items-center justify-center py-2 space-y-4">
        <!-- Power Button Halo / Glow Wrapper -->
        <div class="relative group">
          <!-- Animated ambient glow pulse -->
          <div
            class="absolute -inset-2.5 rounded-full blur-xl transition-all duration-700 opacity-60 group-hover:opacity-90"
            :class="processStore.isAllRunning
              ? 'bg-gradient-to-r from-emerald-500/60 to-cyan-500/60 animate-pulse'
              : 'bg-gradient-to-r from-slate-700/30 to-indigo-500/20'"
          ></div>

          <!-- Circular Switch Button -->
          <button
            @click="handleMasterToggle"
            :disabled="isHeroLoading"
            class="relative w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 shadow-2xl border-4 disabled:opacity-80"
            :class="processStore.isAllRunning
              ? 'bg-gradient-to-b from-emerald-500 to-teal-700 border-emerald-400/80 text-white shadow-emerald-500/30'
              : 'bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-600 shadow-black/50'"
          >
            <Power
              class="w-11 h-11 transition duration-300"
              :class="{
                'animate-spin': isHeroLoading,
                'drop-shadow-[0_0_12px_rgba(255,255,255,0.7)]': processStore.isAllRunning
              }"
            />
            <span class="mt-2 text-[11px] font-black uppercase tracking-wider font-mono">
              {{ isHeroLoading ? 'Processing...' : processStore.isAllRunning ? 'CONNECTED' : 'DISCONNECTED' }}
            </span>
          </button>
        </div>

        <!-- Status Helper Caption -->
        <div class="text-center space-y-0.5">
          <p class="text-xs font-medium text-slate-300">
            {{ isHeroLoading ? 'Orchestrating services in background...' : processStore.isAllRunning ? 'All local stack services are live' : 'Click to start Nginx, PHP, and MariaDB' }}
          </p>
          <p class="text-[10px] text-slate-500 font-mono">
            {{ processStore.isAllRunning ? 'HTTP 80 · FastCGI 9000 · MySQL 3306' : 'Standby Mode · Zero Memory Usage' }}
          </p>
        </div>
      </div>

      <!-- RUNNING DETAILS (COMPACT INLINE LIST) -->
      <RunningDetailsCard @open-php-settings="openSettingsTab('php')" />

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

    <!-- MODULAR SETTINGS MODAL -->
    <SettingsModal
      :show="showSettings"
      v-model:active-tab="activeSettingsTab"
      @close="showSettings = false"
      @open-new-project="showNewProjectModal = true"
    />

    <!-- MODULAR CREATE NEW PROJECT MODAL -->
    <NewProjectModal
      :show="showNewProjectModal"
      @close="showNewProjectModal = false"
    />

  </div>
</template>