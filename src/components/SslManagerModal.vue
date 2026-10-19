<script setup lang="ts">
import { ref } from "vue";
import { useVhostStore } from "@/stores/vhost";
import { useWorkspaceStore } from "@/stores/workspace";
import { getSystemHostsPath } from "@/services/hostsManager";
import {
  X,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Key,
  RefreshCw,
  Folder,
  FileText,
  CheckCircle2,
} from "lucide-vue-next";

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const vhostStore = useVhostStore();
const workspaceStore = useWorkspaceStore();

const systemHostsPath = getSystemHostsPath();
const isGeneratingFor = ref<string | null>(null);

async function handleInstallCa() {
  await vhostStore.installCa();
}

async function handleSyncHosts() {
  await vhostStore.syncHosts();
}

async function handleGenerate(domain: string) {
  isGeneratingFor.value = domain;
  try {
    await vhostStore.generateSslForDomain(domain);
  } finally {
    isGeneratingFor.value = null;
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all"
    @click.self="emit('close')"
  >
    <div class="glass-modal w-full max-w-4xl rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center shadow-lg shrink-0">
            <Lock class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              SSL & System Hosts Manager
              <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                mkcert + UAC
              </span>
            </h3>
            <p class="text-[11px] text-slate-400">
              Local trusted SSL certificates (*.test) and domain routing in system hosts.
            </p>
          </div>
        </div>

        <button
          @click="emit('close')"
          class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 transition"
          title="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Section 1: mkcert Root CA Status & Installation -->
      <div class="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5"
              :class="vhostStore.mkcertStatus.caInstalled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'"
            >
              <ShieldCheck v-if="vhostStore.mkcertStatus.caInstalled" class="w-4 h-4" />
              <ShieldAlert v-else class="w-4 h-4" />
            </div>

            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-xs sm:text-sm text-white">mkcert Local Root CA</h4>
                <span
                  class="text-[10px] px-2 py-0.2 rounded-full font-semibold border"
                  :class="vhostStore.mkcertStatus.caInstalled
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'"
                >
                  {{ vhostStore.mkcertStatus.caInstalled ? 'Root CA Installed' : 'Not Installed' }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-0.5">
                {{ vhostStore.mkcertStatus.available
                  ? 'mkcert binary detected. Generated certificates are automatically trusted by browsers (Chrome, Firefox, Edge).'
                  : 'mkcert binary not found in bin/mkcert/ or PATH. Please download it from the Package Hub.'
                }}
              </p>
            </div>
          </div>

          <button
            v-if="vhostStore.mkcertStatus.available && !vhostStore.mkcertStatus.caInstalled"
            @click="handleInstallCa"
            :disabled="vhostStore.isInstallingCa"
            class="px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-violet-600/25 shrink-0 disabled:opacity-50"
          >
            <Key class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isInstallingCa }" />
            <span>{{ vhostStore.isInstallingCa ? 'Installing CA...' : 'Install Root CA (mkcert -install)' }}</span>
          </button>
        </div>
      </div>

      <!-- Section 2: System Hosts File Sync -->
      <div class="p-3.5 sm:p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <FileText class="w-4 h-4 text-cyan-400" />
              <h4 class="font-bold text-xs sm:text-sm text-white">System Hosts File</h4>
            </div>
            <p class="text-[11px] text-slate-400 font-mono">
              Location: <span class="text-slate-300">{{ systemHostsPath }}</span>
            </p>
          </div>

          <button
            @click="handleSyncHosts"
            :disabled="vhostStore.isSyncingHosts"
            class="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-600/25 shrink-0 disabled:opacity-50"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isSyncingHosts }" />
            <span>{{ vhostStore.isSyncingHosts ? 'Syncing...' : 'Sync Hosts Now' }}</span>
          </button>
        </div>

        <!-- Hosts Block Preview -->
        <div class="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] space-y-0.5">
          <span class="text-slate-500"># >>> LADOS DOMAINS START >>></span>
          <div v-for="d in vhostStore.hostsDomains" :key="d" class="text-emerald-400 pl-2">
            127.0.0.1 {{ d }}
          </div>
          <span class="text-slate-500"># >>> LADOS DOMAINS END >>></span>
        </div>
      </div>

      <!-- Section 3: Domain SSL Status Table -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
            <Lock class="w-4 h-4 text-emerald-400" />
            Domain SSL Certificates (.pem)
          </h4>
          <button
            v-if="workspaceStore.directories"
            @click="workspaceStore.openDirectory(workspaceStore.directories.etcNginxSsl)"
            class="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
          >
            <Folder class="w-3.5 h-3.5" />
            Open etc/nginx/ssl
          </button>
        </div>

        <div class="space-y-1.5">
          <div
            v-for="project in vhostStore.projects"
            :key="project.name"
            class="p-2.5 sm:p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center border shrink-0"
                :class="project.hasSsl
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700'"
              >
                <Lock class="w-3.5 h-3.5" />
              </div>
              <div>
                <span class="font-bold text-xs sm:text-sm text-white font-mono">{{ project.domain }}</span>
                <p class="text-[10px] sm:text-[11px] text-slate-400">
                  {{ project.hasSsl ? `${project.domain}.pem & ${project.domain}-key.pem ready` : 'No local SSL certificate' }}
                </p>
              </div>
            </div>

            <!-- Action: Generate SSL if missing -->
            <div>
              <span
                v-if="project.hasSsl"
                class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold"
              >
                <CheckCircle2 class="w-3 h-3" />
                HTTPS Active
              </span>
              <button
                v-else-if="vhostStore.mkcertStatus.available"
                @click="handleGenerate(project.domain)"
                :disabled="isGeneratingFor === project.domain"
                class="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
              >
                <Key class="w-3 h-3" :class="{ 'animate-spin': isGeneratingFor === project.domain }" />
                <span>{{ isGeneratingFor === project.domain ? 'Generating...' : 'Generate Certificate' }}</span>
              </button>
              <span
                v-else
                class="text-[11px] text-slate-500"
              >
                mkcert not available
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
