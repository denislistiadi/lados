<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProcessManager } from "@/stores/processManager";
import { useBinaryDownloaderStore } from "@/stores/binaryDownloader";
import { type CatalogItem, type DownloadProgress, formatBytes } from "@/services/binaryCatalog";
import {
  Check,
  Download,
  FolderOpen,
  RefreshCw,
  Upload,
  Trash2,
  FileArchive,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-vue-next";

const workspaceStore = useWorkspaceStore();
const processStore = useProcessManager();
const downloaderStore = useBinaryDownloaderStore();

const isInstallingZip = ref(false);
const zipProgress = ref<DownloadProgress | null>(null);
const selectedZipFile = ref<File | null>(null);
const customVersionName = ref("");
const autoActivate = ref(true);
const zipInputRef = ref<HTMLInputElement | null>(null);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

onMounted(async () => {
  await workspaceStore.refreshPhpVersions();
  await downloaderStore.refreshInstalledStatus();
});

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  const file = target.files[0];
  selectedZipFile.value = file;
  errorMessage.value = null;
  successMessage.value = null;

  const match = file.name.match(/(\d+\.\d+(?:\.\d+)?)/);
  customVersionName.value = match ? match[1] : file.name.replace(/\.zip$/i, "");
}

async function handleInstallZip() {
  if (!selectedZipFile.value) return;
  isInstallingZip.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    const arrayBuffer = await selectedZipFile.value.arrayBuffer();
    const versionLabel = customVersionName.value.trim() || selectedZipFile.value.name.replace(/\.zip$/i, "");

    const installed = await workspaceStore.installPhpFromZip(
      arrayBuffer,
      versionLabel,
      (prog) => {
        zipProgress.value = prog;
      }
    );

    successMessage.value = `Berhasil memasang ${installed.label}!`;

    if (autoActivate.value) {
      await handleSelectPhp(installed.id);
    }

    selectedZipFile.value = null;
    customVersionName.value = "";
    if (zipInputRef.value) zipInputRef.value.value = "";
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : String(err);
  } finally {
    isInstallingZip.value = false;
    zipProgress.value = null;
  }
}

async function handleSelectPhp(versionId: string) {
  if (workspaceStore.activePhpVersion === versionId) return;
  await workspaceStore.setPhpVersion(versionId);

  if (processStore.services.php.status === "running") {
    await processStore.restartService("php");
  }
}

async function handleDeleteCustom(versionId: string) {
  if (!confirm(`Hapus folder PHP "${versionId}" dari bin/php?`)) return;
  await workspaceStore.deleteCustomPhpVersion(versionId);
}

async function handleDownloadCatalog(item: CatalogItem) {
  await downloaderStore.installBinary(item);
  await workspaceStore.refreshPhpVersions();
}

const officialCatalogItems = computed(() => {
  return downloaderStore.catalog.filter((c) => c.category === "php");
});

function isCatalogItemInstalled(item: CatalogItem): boolean {
  const idShort = item.id.replace("php-", "");
  return workspaceStore.phpVersions.some(
    (v) => v.id === idShort || v.folderName === idShort || v.version === item.version
  );
}
</script>

<template>
  <div class="space-y-4 py-1 text-slate-300">
    <!-- Active Runtime Header Card -->
    <div class="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-lg space-y-2.5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Active PHP Runtime</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              FastCGI :9000
            </span>
          </div>
          <h3 class="text-base font-extrabold text-white flex items-center gap-2 font-mono">
            PHP {{ workspaceStore.activePhpVersion }}
          </h3>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="workspaceStore.refreshPhpVersions"
            :disabled="workspaceStore.isScanningPhp"
            class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            title="Scan folder bin/php untuk mendeteksi versi PHP terpasang"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': workspaceStore.isScanningPhp }" />
            <span>Scan Folder</span>
          </button>

          <button
            @click="workspaceStore.openPhpDirectory"
            class="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Buka folder bin/php di File Explorer"
          >
            <FolderOpen class="w-3.5 h-3.5 text-indigo-400" />
            <span>Buka bin/php</span>
          </button>
        </div>
      </div>

      <!-- Quick path info -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 text-slate-400">
        <div class="truncate">
          <span class="text-slate-500">Folder: </span>
          <span class="text-cyan-400">{{ workspaceStore.activePhpPath || `${workspaceStore.directories?.binPhp}` }}</span>
        </div>
        <div class="truncate">
          <span class="text-slate-500">Config: </span>
          <span class="text-slate-300">{{ workspaceStore.directories?.etcPhp }}/php.ini</span>
        </div>
      </div>
    </div>

    <!-- Alert Messages -->
    <div v-if="successMessage" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
      <CheckCircle2 class="w-4 h-4 shrink-0 text-emerald-400" />
      <span>{{ successMessage }}</span>
    </div>
    <div v-if="errorMessage" class="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
      <AlertCircle class="w-4 h-4 shrink-0 text-rose-400" />
      <span>{{ errorMessage }}</span>
    </div>

    <!-- SECTION 1: Pasang PHP dari Download Sendiri (ZIP) -->
    <div class="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Upload class="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 class="text-xs font-bold text-white uppercase tracking-wider">Pasang Versi PHP dari Download Sendiri</h4>
            <p class="text-[11px] text-slate-400">
              Pilih file <code class="text-indigo-300">.zip</code> PHP (misal dari windows.php.net) untuk dipasang ke Lados.
            </p>
          </div>
        </div>
      </div>

      <!-- File Picker & Controls -->
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        <div class="sm:col-span-5 space-y-1">
          <label class="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <FileArchive class="w-3 h-3 text-indigo-400" />
            File ZIP PHP
          </label>
          <input
            ref="zipInputRef"
            type="file"
            accept=".zip"
            @change="handleFileSelect"
            :disabled="isInstallingZip"
            class="block w-full text-xs text-slate-300 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/30 file:text-indigo-200 hover:file:bg-indigo-600/40 file:cursor-pointer border border-slate-800 rounded-xl bg-slate-900/80 px-2 py-1"
          />
        </div>

        <div class="sm:col-span-4 space-y-1">
          <label class="text-[11px] font-semibold text-slate-400">Label / Folder Versi</label>
          <input
            type="text"
            v-model="customVersionName"
            :disabled="isInstallingZip || !selectedZipFile"
            placeholder="Contoh: 8.1.31 atau php-7.4"
            class="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div class="sm:col-span-3">
          <button
            @click="handleInstallZip"
            :disabled="!selectedZipFile || isInstallingZip"
            class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download class="w-3.5 h-3.5" :class="{ 'animate-bounce': isInstallingZip }" />
            <span>{{ isInstallingZip ? 'Mengekstrak...' : 'Ekstrak & Pasang' }}</span>
          </button>
        </div>
      </div>

      <!-- Auto activate checkbox -->
      <div v-if="selectedZipFile" class="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
        <input
          id="auto-activate"
          type="checkbox"
          v-model="autoActivate"
          class="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
        />
        <label for="auto-activate" class="cursor-pointer select-none">
          Jadikan versi aktif setelah ekstraksi selesai
        </label>
      </div>

      <!-- Extraction Progress Bar -->
      <div v-if="isInstallingZip && zipProgress" class="space-y-1.5 p-3 rounded-xl bg-slate-900/90 border border-indigo-500/30">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-indigo-300 font-semibold">{{ zipProgress.message }}</span>
          <span class="text-white font-bold">{{ zipProgress.percentage }}%</span>
        </div>
        <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            class="bg-gradient-to-r from-indigo-500 to-cyan-400 h-2 rounded-full transition-all duration-200"
            :style="{ width: `${zipProgress.percentage}%` }"
          ></div>
        </div>
      </div>
    </div>

    <!-- SECTION 2: Daftar Versi PHP Terpasang -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <span>Versi PHP Terpasang</span>
          <span class="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
            {{ workspaceStore.phpVersions.length }}
          </span>
        </h4>
        <span class="text-[11px] text-slate-500">Klik kartu untuk beralih runtime</span>
      </div>

      <div v-if="workspaceStore.phpVersions.length === 0" class="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
        <p class="text-xs text-slate-400">Belum ada versi PHP terpasang di <code class="text-indigo-300">bin/php/</code>.</p>
        <p class="text-[11px] text-slate-500">Pasang dari file ZIP di atas atau unduh dari Katalog Resmi di bawah.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <div
          v-for="ver in workspaceStore.phpVersions"
          :key="ver.id"
          class="p-3 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 relative group"
          :class="ver.isActive
            ? 'bg-indigo-500/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30'
            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'"
        >
          <div class="flex items-start justify-between gap-1.5">
            <div class="space-y-0.5">
              <span class="font-bold font-mono text-sm text-white flex items-center gap-1.5">
                {{ ver.label }}
              </span>
              <p class="text-[10px] font-mono text-slate-400 truncate max-w-[180px]" :title="ver.path">
                {{ ver.path.replace(/^.*[\\/]/, 'bin/php/') }}
              </p>
            </div>

            <span
              class="text-[10px] px-2 py-0.5 rounded-full font-semibold border shrink-0"
              :class="ver.isCustom
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'"
            >
              {{ ver.isCustom ? 'Custom' : 'Official' }}
            </span>
          </div>

          <div class="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <div v-if="ver.isActive" class="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
              <Check class="w-3.5 h-3.5" />
              <span>Aktif</span>
            </div>
            <button
              v-else
              @click="handleSelectPhp(ver.id)"
              class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-[11px] font-semibold transition"
            >
              Gunakan
            </button>

            <!-- Delete Custom Version Button -->
            <button
              v-if="ver.isCustom && !ver.isActive"
              @click="handleDeleteCustom(ver.id)"
              class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
              title="Hapus versi custom ini dari disk"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 3: Unduh dari Katalog Resmi Lados -->
    <div class="p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800/80 space-y-2.5">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles class="w-3.5 h-3.5 text-indigo-400" />
          <span>Katalog Resmi Lados</span>
        </h4>
        <a
          href="https://windows.php.net/downloads/releases/archives/"
          target="_blank"
          class="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
        >
          <span>Arsip PHP Resmi</span>
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div
          v-for="item in officialCatalogItems"
          :key="item.id"
          class="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-2"
        >
          <div class="space-y-0.5">
            <span class="text-xs font-bold text-white font-mono">{{ item.name }}</span>
            <p class="text-[10px] text-slate-400">{{ formatBytes(item.sizeEstimateBytes || 0) }}</p>
          </div>

          <span
            v-if="isCatalogItemInstalled(item)"
            class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
          >
            Terpasang
          </span>
          <button
            v-else
            @click="handleDownloadCatalog(item)"
            :disabled="downloaderStore.isDownloadingAny"
            class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1 transition disabled:opacity-50"
          >
            <Download class="w-3 h-3" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
