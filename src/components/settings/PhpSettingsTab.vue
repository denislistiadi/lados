<script setup lang="ts">
import { useWorkspaceStore } from "@/stores/workspace";
import { useProcessManager } from "@/stores/processManager";
import { Check } from "lucide-vue-next";

const workspaceStore = useWorkspaceStore();
const processStore = useProcessManager();

const phpOptions = [
  { version: "8.4", badge: "Latest", desc: "Property hooks, asymmetric visibility" },
  { version: "8.3", badge: "Stable", desc: "Typed constants, json_validate" },
  { version: "8.2", badge: "LTS", desc: "Readonly classes, legacy compatibility" },
];

async function handleSelectPhp(version: string) {
  if (workspaceStore.activePhpVersion === version) return;
  await workspaceStore.setPhpVersion(version);

  if (processStore.services.php.status === "running") {
    await processStore.restartService("php");
  }
}
</script>

<template>
  <div class="space-y-3.5 py-1">
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
</template>
