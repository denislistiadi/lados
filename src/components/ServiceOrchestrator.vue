<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useProcessManager } from "@/stores/processManager";
import { useWorkspaceStore } from "@/stores/workspace";
import type { ServiceType } from "@/services/processManager";
import {
  Globe,
  FileCode,
  Database,
  Play,
  Square,
  RotateCw,
  ExternalLink,
  Cpu,
  Clock,
  Radio,
  Server,
  RefreshCw,
} from "lucide-vue-next";

const processStore = useProcessManager();
const workspaceStore = useWorkspaceStore();

const now = ref(Date.now());
let timer: number | null = null;

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function formatUptime(startTime: number | null): string {
  if (!startTime) return "Offline";
  const diffSec = Math.floor((now.value - startTime) / 1000);
  if (diffSec < 60) return `${diffSec} detik`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}j ${mins % 60}m`;
}

const serviceMeta: Record<
  ServiceType,
  {
    icon: typeof Globe;
    accent: string;
    borderAccent: string;
    bgAccent: string;
    glow: string;
    tag: string;
  }
> = {
  nginx: {
    icon: Globe,
    accent: "text-sky-400",
    borderAccent: "border-sky-500/30",
    bgAccent: "bg-sky-500/10",
    glow: "shadow-sky-500/20",
    tag: "Web Server & Reverse Proxy",
  },
  php: {
    icon: FileCode,
    accent: "text-indigo-400",
    borderAccent: "border-indigo-500/30",
    bgAccent: "bg-indigo-500/10",
    glow: "shadow-indigo-500/20",
    tag: "FastCGI Process Manager",
  },
  mariadb: {
    icon: Database,
    accent: "text-emerald-400",
    borderAccent: "border-emerald-500/30",
    bgAccent: "bg-emerald-500/10",
    glow: "shadow-emerald-500/20",
    tag: "Relational Database Server",
  },
};
</script>

<template>
  <div class="space-y-3">
    <!-- Bento Cell Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <Cpu class="w-4 h-4" />
        </div>
        <h3 class="text-sm font-bold uppercase tracking-wider text-slate-200">
          Service Orchestrator
        </h3>
      </div>
      <span class="text-[11px] text-slate-400 font-mono">
        Port Binding: 80 / 9000 / 3306
      </span>
    </div>

    <!-- 3-Column Bento Grid of Service Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div
        v-for="(svc, name) in processStore.services"
        :key="name"
        class="glass-panel glass-panel-hover p-5 rounded-2xl flex flex-col justify-between space-y-4 relative overflow-hidden"
      >
        <!-- Background Ambient Glow -->
        <div
          class="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20"
          :class="svc.status === 'running' ? 'bg-emerald-500' : 'bg-slate-700'"
        ></div>

        <!-- Card Header: Icon, Name & Status Badge -->
        <div class="flex items-start justify-between gap-3 relative z-10">
          <div class="flex items-center gap-3">
            <div
              class="w-11 h-11 rounded-xl flex items-center justify-center border transition shadow-lg"
              :class="[
                serviceMeta[name].bgAccent,
                serviceMeta[name].borderAccent,
                serviceMeta[name].accent,
                serviceMeta[name].glow,
              ]"
            >
              <component :is="serviceMeta[name].icon || Server" class="w-5 h-5" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-base text-white capitalize font-mono">{{ svc.name }}</h4>
                <span
                  v-if="name === 'php'"
                  class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono font-semibold"
                >
                  v{{ workspaceStore.activePhpVersion }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400">{{ serviceMeta[name].tag }}</p>
            </div>
          </div>

          <!-- Status Indicator Pill -->
          <span
            class="text-[10px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 uppercase tracking-wider shadow-sm"
            :class="{
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/30': svc.status === 'running',
              'bg-amber-500/10 text-amber-400 border-amber-500/30': svc.status === 'starting' || svc.status === 'stopping',
              'bg-rose-500/10 text-rose-400 border-rose-500/30': svc.status === 'error',
              'bg-slate-800 text-slate-400 border-slate-700': svc.status === 'stopped',
            }"
          >
            <span
              class="w-1.5 h-1.5 rounded-full"
              :class="{
                'bg-emerald-400 animate-pulse': svc.status === 'running',
                'bg-amber-400 animate-spin': svc.status === 'starting' || svc.status === 'stopping',
                'bg-rose-400': svc.status === 'error',
                'bg-slate-500': svc.status === 'stopped',
              }"
            ></span>
            {{ svc.status }}
          </span>
        </div>

        <!-- Metric Details Panel -->
        <div class="bg-slate-950/70 p-3 rounded-xl border border-white/5 space-y-1.5 text-xs font-mono relative z-10">
          <div class="flex items-center justify-between text-slate-400">
            <span class="flex items-center gap-1.5">
              <Radio class="w-3 h-3 text-cyan-400" />
              Port:
            </span>
            <span class="text-cyan-300 font-bold">:{{ svc.port }}</span>
          </div>

          <div class="flex items-center justify-between text-slate-400">
            <span>PID:</span>
            <span class="text-slate-200">{{ svc.pid ?? '—' }}</span>
          </div>

          <div class="flex items-center justify-between text-slate-400">
            <span class="flex items-center gap-1.5">
              <Clock class="w-3 h-3 text-slate-500" />
              Uptime:
            </span>
            <span class="text-slate-300">{{ formatUptime(svc.startTime) }}</span>
          </div>

          <div v-if="svc.lastError" class="text-rose-400 text-[11px] truncate pt-1 border-t border-slate-800/80" :title="svc.lastError">
            {{ svc.lastError }}
          </div>
        </div>

        <!-- Action Controls -->
        <div class="flex items-center gap-2 pt-1 relative z-10">
          <button
            v-if="svc.status === 'stopped' || svc.status === 'error'"
            @click="processStore.startService(name)"
            class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-emerald-600/20 active:scale-95"
          >
            <Play class="w-3.5 h-3.5" />
            <span>Start</span>
          </button>

          <button
            v-if="svc.status === 'running'"
            @click="processStore.stopService(name)"
            class="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md shadow-rose-600/20 active:scale-95"
          >
            <Square class="w-3.5 h-3.5" />
            <span>Stop</span>
          </button>

          <button
            v-if="svc.status === 'running'"
            @click="processStore.restartService(name)"
            class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition shadow-sm active:scale-95"
            title="Restart Service"
          >
            <RotateCw class="w-3.5 h-3.5" />
          </button>

          <button
            v-if="svc.status === 'starting' || svc.status === 'stopping'"
            disabled
            class="flex-1 py-2 px-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60"
          >
            <RefreshCw class="w-3.5 h-3.5 animate-spin" />
            <span>Processing...</span>
          </button>

          <!-- Quick Web Preview for Nginx -->
          <button
            v-if="name === 'nginx' && svc.status === 'running'"
            @click="workspaceStore.openBrowserUrl('http://localhost')"
            class="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-400 hover:text-sky-300 transition"
            title="Open http://localhost in Browser"
          >
            <ExternalLink class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
