<script setup lang="ts">
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import { useWorkspaceStore } from "@/stores/workspace";
import {
  type CatalogItem,
  formatBytes,
} from "@/services/binaryDownloader";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  Layers,
  Cpu,
  Globe,
  Database,
  FileCode,
  ShieldCheck,
} from "lucide-vue-next";

defineProps<{
  item: CatalogItem;
}>();

const downloaderStore = useBinaryDownloaderStore();
const workspaceStore = useWorkspaceStore();

const categoryIcons: Record<string, typeof Cpu> = {
  php: FileCode,
  nginx: Globe,
  mariadb: Database,
  composer: Layers,
  mkcert: ShieldCheck,
};

async function handleDownload(item: CatalogItem) {
  await downloaderStore.installBinary(item);
}
</script>

<template>
  <div
    class="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition shadow-lg flex flex-col justify-between space-y-3"
  >
    <!-- Card Header -->
    <div class="space-y-1.5">
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700/60 flex items-center justify-center text-cyan-400 shrink-0">
            <component :is="categoryIcons[item.category] || Cpu" class="w-4 h-4" />
          </div>
          <div>
            <h4 class="font-bold text-xs sm:text-sm text-white">{{ item.name }}</h4>
            <span class="text-[10px] sm:text-[11px] font-mono text-slate-400">v{{ item.version }}</span>
          </div>
        </div>

        <!-- Installation Status Badge -->
        <span
          v-if="downloaderStore.installedStatus[item.id]?.installed"
          class="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shrink-0"
        >
          <CheckCircle2 class="w-3 h-3 text-emerald-400" />
          Installed
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium shrink-0"
        >
          Not Installed
        </span>
      </div>

      <p class="text-[11px] sm:text-xs text-slate-400 leading-relaxed min-h-[32px]">
        {{ item.description }}
      </p>
    </div>

    <!-- Meta info (size, target path) -->
    <div class="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80 space-y-1 text-[10px] sm:text-[11px] font-mono">
      <div class="flex items-center justify-between text-slate-400">
        <span>Target:</span>
        <span class="text-cyan-400">bin/{{ item.targetSubdir }}/</span>
      </div>
      <div class="flex items-center justify-between text-slate-400">
        <span>Size:</span>
        <span class="text-slate-300">{{ formatBytes(item.sizeEstimateBytes || 0) }}</span>
      </div>
      <div class="flex items-center justify-between text-slate-400">
        <span>Format:</span>
        <span class="text-slate-300">{{ item.isZip ? "ZIP Archive (JSZip)" : "Standalone Binary" }}</span>
      </div>
    </div>

    <!-- Download & Progress Area -->
    <div class="space-y-2">
      <!-- Active Download Progress Bar -->
      <div
        v-if="downloaderStore.activeDownloads[item.id] && downloaderStore.activeDownloads[item.id].stage !== 'idle'"
        class="space-y-1"
      >
        <div class="flex items-center justify-between text-[10px] sm:text-[11px]">
          <span class="text-indigo-400 font-semibold truncate max-w-[180px]">
            {{ downloaderStore.activeDownloads[item.id].message }}
          </span>
          <span class="text-slate-300 font-mono">
            {{ downloaderStore.activeDownloads[item.id].percentage }}%
          </span>
        </div>

        <!-- Progress Track -->
        <div class="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            class="h-full rounded-full transition-all duration-200"
            :class="{
              'bg-gradient-to-r from-indigo-500 to-cyan-400': downloaderStore.activeDownloads[item.id].stage === 'downloading',
              'bg-gradient-to-r from-amber-500 to-yellow-400 animate-pulse': downloaderStore.activeDownloads[item.id].stage === 'extracting',
              'bg-emerald-500': downloaderStore.activeDownloads[item.id].stage === 'completed',
              'bg-rose-500': downloaderStore.activeDownloads[item.id].stage === 'error',
            }"
            :style="{ width: `${downloaderStore.activeDownloads[item.id].percentage}%` }"
          ></div>
        </div>

        <div
          v-if="downloaderStore.activeDownloads[item.id].error"
          class="text-rose-400 text-[10px] flex items-center gap-1 pt-0.5"
        >
          <AlertCircle class="w-3 h-3 shrink-0" />
          <span class="truncate">{{ downloaderStore.activeDownloads[item.id].error }}</span>
        </div>
      </div>

      <!-- Actions: Install / Re-install Button -->
      <div class="flex items-center gap-1.5">
        <button
          @click="handleDownload(item)"
          :disabled="downloaderStore.activeDownloads[item.id]?.stage === 'downloading' || downloaderStore.activeDownloads[item.id]?.stage === 'extracting'"
          class="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
          :class="downloaderStore.installedStatus[item.id]?.installed
            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'"
        >
          <RefreshCw
            v-if="downloaderStore.activeDownloads[item.id]?.stage === 'downloading' || downloaderStore.activeDownloads[item.id]?.stage === 'extracting'"
            class="w-3.5 h-3.5 animate-spin"
          />
          <Download v-else class="w-3.5 h-3.5" />
          <span>
            {{
              downloaderStore.activeDownloads[item.id]?.stage === 'downloading'
                ? 'Downloading...'
                : downloaderStore.activeDownloads[item.id]?.stage === 'extracting'
                ? 'Extracting...'
                : downloaderStore.installedStatus[item.id]?.installed
                ? 'Reinstall'
                : 'Download & Install'
            }}
          </span>
        </button>

        <!-- Quick Open Folder in Explorer -->
        <button
          v-if="workspaceStore.directories"
          @click="workspaceStore.openDirectory(`${workspaceStore.directories.bin}/${item.targetSubdir}`)"
          class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
          title="Open binary directory"
        >
          <Folder class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
