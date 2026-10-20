<script setup lang="ts">
import { useWorkspaceStore } from "@/stores/workspace";
import { useProcessManager } from "@/stores/processManager";
import {
  Globe,
  FileCode,
  Database,
  Power,
  ChevronRight,
} from "lucide-vue-next";

defineEmits<{
  (e: "open-php-settings"): void;
}>();

const workspaceStore = useWorkspaceStore();
const processStore = useProcessManager();

async function handleToggleService(service: "nginx" | "php" | "mariadb") {
  if (processStore.services[service].status === "running") {
    await processStore.stopService(service);
  } else {
    await processStore.startService(service);
  }
}
</script>

<template>
  <div class="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2.5">
    <div class="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
      <span>Running Details</span>
      <span class="text-[10px] text-slate-500 font-mono lowercase">managed locally</span>
    </div>

    <!-- Service Item: Nginx -->
    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/40 hover:border-slate-700/60 transition">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <Globe class="w-3.5 h-3.5" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-white">Nginx Web Server</span>
            <span class="w-1.5 h-1.5 rounded-full" :class="processStore.services.nginx.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'"></span>
          </div>
          <p class="text-[10px] text-slate-400 font-mono">Port :80 (HTTP / SSL :443)</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          v-if="processStore.services.nginx.status === 'running'"
          @click="workspaceStore.openBrowserUrl('http://localhost')"
          class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/20 transition"
        >
          Open :80
        </button>
        <button
          @click="handleToggleService('nginx')"
          class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          :title="processStore.services.nginx.status === 'running' ? 'Stop Nginx' : 'Start Nginx'"
        >
          <Power class="w-3 h-3" :class="processStore.services.nginx.status === 'running' ? 'text-emerald-400' : 'text-slate-500'" />
        </button>
      </div>
    </div>

    <!-- Service Item: PHP FastCGI -->
    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/40 hover:border-slate-700/60 transition">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <FileCode class="w-3.5 h-3.5" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-white">PHP FastCGI</span>
            <span class="w-1.5 h-1.5 rounded-full" :class="processStore.services.php.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'"></span>
          </div>
          <p class="text-[10px] text-slate-400 font-mono">Port :9000 · v{{ workspaceStore.activePhpVersion }}</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          @click="$emit('open-php-settings')"
          class="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/20 transition flex items-center gap-1"
        >
          <span>v{{ workspaceStore.activePhpVersion }}</span>
          <ChevronRight class="w-2.5 h-2.5" />
        </button>
        <button
          @click="handleToggleService('php')"
          class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          :title="processStore.services.php.status === 'running' ? 'Stop PHP' : 'Start PHP'"
        >
          <Power class="w-3 h-3" :class="processStore.services.php.status === 'running' ? 'text-emerald-400' : 'text-slate-500'" />
        </button>
      </div>
    </div>

    <!-- Service Item: MariaDB -->
    <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/40 hover:border-slate-700/60 transition">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
          <Database class="w-3.5 h-3.5" />
        </div>
        <div>
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-semibold text-white">MariaDB Server</span>
            <span class="w-1.5 h-1.5 rounded-full" :class="processStore.services.mariadb.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'"></span>
          </div>
          <p class="text-[10px] text-slate-400 font-mono">Port :3306 (MySQL default)</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          @click="handleToggleService('mariadb')"
          class="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          :title="processStore.services.mariadb.status === 'running' ? 'Stop MariaDB' : 'Start MariaDB'"
        >
          <Power class="w-3 h-3" :class="processStore.services.mariadb.status === 'running' ? 'text-emerald-400' : 'text-slate-500'" />
        </button>
      </div>
    </div>
  </div>
</template>
