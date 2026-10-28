<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useProcessManager } from "@/stores/processManager";
import type { LogServiceType } from "@/services/processManager";
import {
  Terminal,
  Trash2,
  Copy,
  Check,
  ArrowDown,
  Globe,
  FileCode,
  Database,
  Layers,
  Cpu,
} from "lucide-vue-next";

const store = useProcessManager();
const logContainer = ref<HTMLDivElement | null>(null);
const isCopied = ref(false);

const serviceIcons: Record<string, typeof Terminal> = {
  system: Cpu,
  nginx: Globe,
  php: FileCode,
  mariadb: Database,
};

function scrollToBottom() {
  if (store.autoScroll && logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
}

watch(
  () => store.logs.length,
  () => {
    nextTick(scrollToBottom);
  }
);

async function copyAllLogs() {
  const text = store.filteredLogs
    .map((l) => `[${l.timestamp}] [${l.service.toUpperCase()}] [${l.type}] ${l.message}`)
    .join("\n");
  try {
    await navigator.clipboard.writeText(text);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy logs:", err);
  }
}

function getLogTextClass(log: { type: string; message: string }): string {
  if (log.type === "system") {
    return "text-amber-300 font-semibold";
  }
  if (log.type === "stdout") {
    return "text-slate-200";
  }
  // For stderr: distinguish between genuine errors, warnings, and informational notices
  const lower = log.message.toLowerCase();
  if (lower.includes("[error]") || lower.includes("fatal error") || lower.includes("[process error]")) {
    return "text-rose-400 font-medium";
  }
  if (lower.includes("[warning]") || lower.includes("[warn]")) {
    return "text-amber-400";
  }
  if (lower.includes("[note]") || lower.includes("[info]") || lower.includes("[notice]")) {
    return "text-slate-300";
  }
  return "text-rose-400 font-medium";
}
</script>

<template>
  <div class="rounded-xl border border-slate-800 bg-slate-950 flex flex-col h-[250px] sm:h-[300px] shadow-2xl overflow-hidden">
    <!-- Console Header / Toolbar -->
    <div class="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 mr-1">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
        </div>
        <Terminal class="w-3.5 h-3.5 text-cyan-400" />
        <span class="text-xs font-semibold text-slate-200 tracking-wide uppercase">Console Log Output</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
          {{ store.filteredLogs.length }} lines
        </span>
      </div>

      <!-- Filter Tabs & Actions -->
      <div class="flex items-center gap-1.5">
        <!-- Service Filter Buttons -->
        <div class="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
          <button
            @click="store.setFilter('all')"
            class="px-2.5 py-1 rounded-md transition font-medium text-xs flex items-center gap-1"
            :class="store.filter === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          >
            <Layers class="w-3 h-3" />
            All
          </button>
          <button
            v-for="svc in (['system', 'nginx', 'php', 'mariadb'] as LogServiceType[])"
            :key="svc"
            @click="store.setFilter(svc)"
            class="px-2.5 py-1 rounded-md transition font-medium text-xs flex items-center gap-1 capitalize"
            :class="store.filter === svc ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-sm' : 'text-slate-400 hover:text-slate-200'"
          >
            <component :is="serviceIcons[svc]" class="w-3 h-3" />
            {{ svc }}
          </button>
        </div>

        <!-- Auto-scroll Toggle -->
        <button
          @click="store.toggleAutoScroll"
          class="p-1.5 rounded-lg border text-xs transition flex items-center gap-1"
          :class="store.autoScroll ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-slate-800/80 border-slate-700 text-slate-400'"
          :title="store.autoScroll ? 'Auto-scroll Enabled' : 'Auto-scroll Disabled'"
        >
          <ArrowDown class="w-3.5 h-3.5" :class="{ 'animate-bounce': store.autoScroll }" />
        </button>

        <!-- Copy Logs -->
        <button
          @click="copyAllLogs"
          class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition"
          title="Copy Logs to Clipboard"
        >
          <Check v-if="isCopied" class="w-3.5 h-3.5 text-emerald-400" />
          <Copy v-else class="w-3.5 h-3.5" />
        </button>

        <!-- Clear Logs -->
        <button
          @click="store.clearLogs(store.filter === 'all' ? undefined : store.filter)"
          class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 hover:text-rose-300 border border-slate-700 text-slate-400 transition"
          title="Clear Logs"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Log Lines Terminal Display -->
    <div
      ref="logContainer"
      class="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text scroll-smooth"
    >
      <div v-if="store.filteredLogs.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
        <Terminal class="w-8 h-8 opacity-40" />
        <p class="text-xs">No process logs available yet.</p>
        <p class="text-[11px] text-slate-500">Logs from Nginx, PHP, and MariaDB will appear here in real-time.</p>
      </div>

      <div
        v-for="log in store.filteredLogs"
        :key="log.id"
        class="flex items-start gap-2.5 leading-relaxed hover:bg-slate-900/40 px-2 py-0.5 rounded transition"
      >
        <!-- Timestamp -->
        <span class="text-slate-500 shrink-0 select-none text-[11px]">
          {{ log.timestamp }}
        </span>

        <!-- Service Tag Badge -->
        <span
          class="text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 uppercase tracking-wider select-none border"
          :class="{
            'bg-sky-500/10 text-sky-400 border-sky-500/20': log.service === 'nginx',
            'bg-indigo-500/10 text-indigo-400 border-indigo-500/20': log.service === 'php',
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': log.service === 'mariadb',
          }"
        >
          {{ log.service }}
        </span>

        <!-- Message Body -->
        <span
          class="break-all flex-1"
          :class="getLogTextClass(log)"
        >
          {{ log.message }}
        </span>
      </div>
    </div>
  </div>
</template>
