<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import { useWorkspaceStore } from "@/stores/workspace";
import {
  type CatalogItem,
  formatBytes,
} from "@/services/binaryDownloader";
import {
  Download,
  Terminal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  Layers,
  Sparkles,
  Cpu,
  Globe,
  Database,
  FileCode,
  ShieldCheck,
} from "lucide-vue-next";

const downloaderStore = useBinaryDownloaderStore();
const workspaceStore = useWorkspaceStore();

const selectedCategory = ref<string>("all");
const isLaunchingTerminal = ref(false);

onMounted(async () => {
  await downloaderStore.refreshInstalledStatus();
});

const categoryIcons: Record<string, typeof Cpu> = {
  php: FileCode,
  nginx: Globe,
  mariadb: Database,
  composer: Layers,
  mkcert: ShieldCheck,
};

const categoryTabs = [
  { id: "all", label: "All Binaries" },
  { id: "php", label: "PHP" },
  { id: "nginx", label: "Nginx" },
  { id: "mariadb", label: "MariaDB" },
  { id: "tools", label: "Composer & Tools" },
];

const filteredCatalog = computed(() => {
  if (selectedCategory.value === "all") {
    return downloaderStore.catalog;
  }
  if (selectedCategory.value === "tools") {
    return downloaderStore.catalog.filter(
      (c) => c.category === "composer" || c.category === "mkcert"
    );
  }
  return downloaderStore.catalog.filter((c) => c.category === selectedCategory.value);
});

async function handleDownload(item: CatalogItem) {
  await downloaderStore.installBinary(item);
}

async function handleLaunchTerminal() {
  isLaunchingTerminal.value = true;
  try {
    const dir = workspaceStore.directories?.www;
    await downloaderStore.launchTerminal(dir);
  } finally {
    isLaunchingTerminal.value = false;
  }
}
</script>

<template>
  <div class="space-y-3 sm:space-y-3.5">
    <!-- Header with Terminal Banner -->
    <div class="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Download class="w-3.5 h-3.5" />
          </div>
          <h3 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            Binary Downloader & Isolated Terminal
            <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
              Pure TS + JSZip
            </span>
          </h3>
        </div>
        <p class="text-[11px] sm:text-xs text-slate-400 max-w-2xl leading-relaxed">
          Download official portable packages for PHP, Nginx, MariaDB, Composer, and mkcert directly into the portable <code class="text-indigo-300">bin/</code> directory. Launch an isolated terminal where Lados binaries are automatically prioritized in the PATH variable.
        </p>
      </div>

      <!-- Quick Action: Launch Isolated Terminal -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          @click="downloaderStore.refreshInstalledStatus"
          :disabled="downloaderStore.isChecking"
          class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition disabled:opacity-50"
          title="Check binary installation status"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': downloaderStore.isChecking }" />
        </button>

        <button
          @click="handleLaunchTerminal"
          :disabled="isLaunchingTerminal"
          class="px-3.5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-indigo-600/25 active:scale-95 disabled:opacity-50"
          title="Open isolated terminal with Lados PATH prioritized"
        >
          <Terminal class="w-3.5 h-3.5" :class="{ 'animate-pulse': isLaunchingTerminal }" />
          <span>{{ isLaunchingTerminal ? "Opening Terminal..." : "Open Isolated Terminal" }}</span>
        </button>
      </div>
    </div>

    <!-- Category Filter Tabs -->
    <div class="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
      <div class="flex items-center gap-1.5 overflow-x-auto py-0.5">
        <button
          v-for="tab in categoryTabs"
          :key="tab.id"
          @click="selectedCategory = tab.id"
          class="px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition border whitespace-nowrap"
          :class="selectedCategory === tab.id
            ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
            : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- PATH preview hint -->
      <span class="text-[10px] sm:text-[11px] text-slate-500 hidden sm:inline-flex items-center gap-1">
        <Sparkles class="w-3 h-3 text-amber-400" />
        PATH: <code>bin/php; bin/nginx; bin/mariadb/bin; bin/composer</code>
      </span>
    </div>

    <!-- Catalog Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="item in filteredCatalog"
        :key="item.id"
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
    </div>
  </div>
</template>
