<script setup lang="ts">
import { ref } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import { useVhostStore } from "@/stores/vhost";
import {
  Terminal,
  Folder,
  FileCode,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-vue-next";

const emit = defineEmits<{
  (e: "openSslModal"): void;
}>();

const workspaceStore = useWorkspaceStore();
const downloaderStore = useBinaryDownloaderStore();
const vhostStore = useVhostStore();

const isLaunchingTerminal = ref(false);

async function handleTerminal() {
  isLaunchingTerminal.value = true;
  try {
    const dir = workspaceStore.directories?.www;
    await downloaderStore.launchTerminal(dir);
  } finally {
    isLaunchingTerminal.value = false;
  }
}

async function handleOpenWww() {
  if (workspaceStore.directories) {
    await workspaceStore.openDirectory(workspaceStore.directories.www);
  }
}

async function handleOpenEtc() {
  if (workspaceStore.directories) {
    await workspaceStore.openDirectory(workspaceStore.directories.etc);
  }
}

async function handleSyncHosts() {
  await vhostStore.syncHosts();
}
</script>

<template>
  <div class="glass-dock p-4 rounded-2xl space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Sparkles class="w-4 h-4 text-amber-400" />
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300">Quick Action Dock</h4>
      </div>
      <span class="text-[11px] text-slate-400 font-mono">Pintasan Lingkungan Kerja</span>
    </div>

    <!-- Horizontal Grid of Shortcut Tiles -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <!-- 1. Isolated Terminal -->
      <button
        @click="handleTerminal"
        :disabled="isLaunchingTerminal"
        class="glass-panel glass-panel-hover p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-2 group transition active:scale-95 disabled:opacity-50"
        title="Open isolated terminal with Lados binaries prioritized in PATH"
      >
        <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition shadow-sm">
          <Terminal class="w-4 h-4" :class="{ 'animate-spin': isLaunchingTerminal }" />
        </div>
        <div>
          <span class="font-bold text-xs text-white block">Isolated Terminal</span>
          <span class="text-[10px] text-slate-400 font-mono">PHP & Composer</span>
        </div>
      </button>

      <!-- 2. Folder www/ -->
      <button
        @click="handleOpenWww"
        class="glass-panel glass-panel-hover p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-2 group transition active:scale-95"
        title="Open www/ directory in File Explorer"
      >
        <div class="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition shadow-sm">
          <Folder class="w-4 h-4" />
        </div>
        <div>
          <span class="font-bold text-xs text-white block">www/ Folder</span>
          <span class="text-[10px] text-slate-400 font-mono">Web Root Projects</span>
        </div>
      </button>

      <!-- 3. Folder etc/ -->
      <button
        @click="handleOpenEtc"
        class="glass-panel glass-panel-hover p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-2 group transition active:scale-95"
        title="Open etc/ configuration directory in File Explorer"
      >
        <div class="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center group-hover:scale-110 transition shadow-sm">
          <FileCode class="w-4 h-4" />
        </div>
        <div>
          <span class="font-bold text-xs text-white block">etc/ Folder</span>
          <span class="text-[10px] text-slate-400 font-mono">Nginx, PHP, MariaDB</span>
        </div>
      </button>

      <!-- 4. Sync Hosts -->
      <button
        @click="handleSyncHosts"
        :disabled="vhostStore.isSyncingHosts"
        class="glass-panel glass-panel-hover p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-2 group transition active:scale-95 disabled:opacity-50"
        title="Synchronize *.test domains to system hosts file (with secure UAC dialog if needed)"
      >
        <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition shadow-sm">
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': vhostStore.isSyncingHosts }" />
        </div>
        <div>
          <span class="font-bold text-xs text-white block">Sync Hosts</span>
          <span class="text-[10px] text-slate-400 font-mono">{{ vhostStore.hostsDomains.length }} Domains Registered</span>
        </div>
      </button>

      <!-- 5. SSL & mkcert Panel -->
      <button
        @click="emit('openSslModal')"
        class="glass-panel glass-panel-hover p-3 rounded-xl flex flex-col items-center justify-center text-center space-y-2 group transition active:scale-95 col-span-2 sm:col-span-1"
        title="Open SSL certificates and mkcert Root CA management panel"
      >
        <div class="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center group-hover:scale-110 transition shadow-sm">
          <Lock class="w-4 h-4" />
        </div>
        <div>
          <span class="font-bold text-xs text-white block">SSL & mkcert Panel</span>
          <span class="text-[10px] text-slate-400 font-mono">{{ vhostStore.sslActiveCount }} Active SSL</span>
        </div>
      </button>
    </div>
  </div>
</template>
