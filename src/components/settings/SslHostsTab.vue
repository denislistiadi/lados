<script setup lang="ts">
import { ref } from "vue";
import { useVhostStore } from "@/stores/vhost";
import { getSystemHostsPath } from "@/services/hostsManager";
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  RefreshCw,
  Lock,
  CheckCircle2,
} from "lucide-vue-next";

const vhostStore = useVhostStore();
const systemHostsPath = getSystemHostsPath();
const isGeneratingFor = ref<string | null>(null);

async function handleGenerateSsl(domain: string) {
  isGeneratingFor.value = domain;
  try {
    await vhostStore.generateSslForDomain(domain);
  } finally {
    isGeneratingFor.value = null;
  }
}
</script>

<template>
  <div class="space-y-3.5 py-1">
    <!-- mkcert Section -->
    <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
              <h5 class="font-bold text-xs sm:text-sm text-white">mkcert Local Root CA</h5>
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
                ? 'mkcert is ready. Generated SSL certs are trusted by browsers (Chrome, Firefox, Edge).'
                : 'mkcert binary not found in bin/mkcert/. Download it in Package Hub.'
              }}
            </p>
          </div>
        </div>

        <button
          v-if="vhostStore.mkcertStatus.available && !vhostStore.mkcertStatus.caInstalled"
          @click="vhostStore.installCa()"
          :disabled="vhostStore.isInstallingCa"
          class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
        >
          <Key class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isInstallingCa }" />
          <span>{{ vhostStore.isInstallingCa ? 'Installing...' : 'Install Root CA' }}</span>
        </button>
      </div>
    </div>

    <!-- Hosts File Sync Section -->
    <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h5 class="font-bold text-xs sm:text-sm text-white">System Hosts File</h5>
          <p class="text-[11px] text-slate-400 font-mono">Location: {{ systemHostsPath }}</p>
        </div>

        <button
          @click="vhostStore.syncHosts()"
          :disabled="vhostStore.isSyncingHosts"
          class="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 disabled:opacity-50"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isSyncingHosts }" />
          <span>{{ vhostStore.isSyncingHosts ? 'Syncing...' : 'Sync Hosts Now' }}</span>
        </button>
      </div>

      <!-- Hosts Preview -->
      <div class="bg-slate-900/90 p-2.5 rounded-lg font-mono text-[11px] space-y-0.5 border border-slate-800">
        <span class="text-slate-500"># >>> LADOS DOMAINS START >>></span>
        <div v-for="d in vhostStore.hostsDomains" :key="d" class="text-emerald-400 pl-2">
          127.0.0.1 {{ d }}
        </div>
        <span class="text-slate-500"># >>> LADOS DOMAINS END >>></span>
      </div>
    </div>

    <!-- Domain Certificates -->
    <div class="space-y-1.5">
      <h5 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Domain Certificates (.pem)</h5>
      <div v-for="project in vhostStore.projects" :key="project.name" class="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <Lock class="w-3.5 h-3.5 text-slate-400" />
          <span class="font-mono font-semibold text-white">{{ project.domain }}</span>
        </div>

        <span v-if="project.hasSsl" class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/30">
          <CheckCircle2 class="w-3 h-3" />
          HTTPS Active
        </span>
        <button
          v-else-if="vhostStore.mkcertStatus.available"
          @click="handleGenerateSsl(project.domain)"
          :disabled="isGeneratingFor === project.domain"
          class="px-2.5 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
        >
          {{ isGeneratingFor === project.domain ? 'Generating...' : 'Generate SSL' }}
        </button>
        <span v-else class="text-[11px] text-slate-500">mkcert missing</span>
      </div>
    </div>
  </div>
</template>
