<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import { useWorkspaceStore } from "@/stores/workspace";
import BinaryPackageCard from "@/components/BinaryPackageCard.vue";
import {
  Download,
  Terminal,
  RefreshCw,
  Sparkles,
} from "lucide-vue-next";

const downloaderStore = useBinaryDownloaderStore();
const workspaceStore = useWorkspaceStore();

const selectedCategory = ref<string>("all");
const isLaunchingTerminal = ref(false);

onMounted(async () => {
  await downloaderStore.refreshInstalledStatus();
});

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
      <BinaryPackageCard
        v-for="item in filteredCatalog"
        :key="item.id"
        :item="item"
      />
    </div>
  </div>
</template>
