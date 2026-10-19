<script setup lang="ts">
import { ref } from "vue";
import { useVhostStore } from "@/stores/vhost";
import { useWorkspaceStore } from "@/stores/workspace";
import type { FrameworkType } from "@/services/vhostScanner";
import { getSystemHostsPath } from "@/services/hostsManager";
import {
  Globe,
  Folder,
  ExternalLink,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  FolderTree,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Key,
  Terminal,
} from "lucide-vue-next";
import { openIsolatedTerminal } from "@/services/isolatedTerminal";

const vhostStore = useVhostStore();
const workspaceStore = useWorkspaceStore();

const showCreateModal = ref(false);
const newProjectName = ref("");
const newProjectType = ref<"laravel" | "wordpress" | "native">("laravel");
const isCreating = ref(false);

const frameworkColors: Record<FrameworkType, string> = {
  Laravel: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  WordPress: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  "Native PHP": "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
  "HTML/Static": "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
};

async function handleCreateProject() {
  if (!newProjectName.value.trim()) return;
  isCreating.value = true;
  try {
    await vhostStore.createSample(newProjectName.value, newProjectType.value);
    newProjectName.value = "";
    showCreateModal.value = false;
  } finally {
    isCreating.value = false;
  }
}

async function quickCreate(name: string, type: "laravel" | "wordpress" | "native") {
  isCreating.value = true;
  try {
    await vhostStore.createSample(name, type);
  } finally {
    isCreating.value = false;
  }
}

async function handleSyncHosts() {
  await vhostStore.syncHosts();
}

async function handleGenerateSsl(domain: string) {
  await vhostStore.generateSslForDomain(domain);
}

async function handleOpenTerminal(projectPath: string) {
  await openIsolatedTerminal(projectPath);
}
</script>

<template>
  <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-4">
    <!-- Header / Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <FolderTree class="w-5 h-5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-white tracking-tight">Virtual Hosts, System Hosts & SSL</h3>
            <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {{ vhostStore.totalProjects }} sites ({{ vhostStore.sslActiveCount }} SSL)
            </span>
          </div>
          <p class="text-xs text-slate-400">
            Real-time watcher &bull; Domain router &bull; Trusted local SSL (.pem)
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Watcher Status Indicator -->
        <button
          @click="vhostStore.isWatching ? vhostStore.stopWatch() : vhostStore.startWatch()"
          class="text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition"
          :class="vhostStore.isWatching ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'"
          :title="vhostStore.isWatching ? 'Click to pause watcher' : 'Click to start watcher'"
        >
          <span class="w-1.5 h-1.5 rounded-full" :class="vhostStore.isWatching ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'"></span>
          <span>{{ vhostStore.isWatching ? 'Watcher Active' : 'Watcher Paused' }}</span>
          <Eye v-if="vhostStore.isWatching" class="w-3 h-3 ml-0.5 opacity-70" />
          <EyeOff v-else class="w-3 h-3 ml-0.5 opacity-70" />
        </button>

        <!-- Scan Now Button -->
        <button
          @click="vhostStore.scanAndSync"
          :disabled="vhostStore.isScanning"
          class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700 disabled:opacity-50"
          title="Scan and Sync Now"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': vhostStore.isScanning }" />
        </button>

        <!-- New Project Button -->
        <button
          @click="showCreateModal = !showCreateModal"
          class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>
    </div>

    <!-- System Integrations Status Bar (Hosts File & mkcert SSL) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
      <!-- Hosts File Card -->
      <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Globe class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-slate-200">System Hosts</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                {{ vhostStore.hostsDomains.length }} routed
              </span>
            </div>
            <p class="text-[11px] text-slate-400 font-mono truncate" :title="getSystemHostsPath()">
              {{ getSystemHostsPath() }}
            </p>
          </div>
        </div>

        <button
          @click="handleSyncHosts"
          :disabled="vhostStore.isSyncingHosts"
          class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-900/30 text-indigo-300 hover:text-indigo-200 border border-slate-700 text-xs font-medium flex items-center gap-1 transition shrink-0 disabled:opacity-50"
          title="Synchronize hosts file with UAC / Polkit escalation if needed"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': vhostStore.isSyncingHosts }" />
          <span>{{ vhostStore.isSyncingHosts ? 'Syncing...' : 'Sync Hosts' }}</span>
        </button>
      </div>

      <!-- mkcert SSL Card -->
      <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
            :class="vhostStore.mkcertStatus.available ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'"
          >
            <ShieldCheck v-if="vhostStore.mkcertStatus.available" class="w-4 h-4" />
            <ShieldAlert v-else class="w-4 h-4" />
          </div>
          <div class="truncate">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-slate-200">mkcert Local SSL</span>
              <span
                class="text-[10px] px-1.5 py-0.2 rounded font-mono"
                :class="vhostStore.mkcertStatus.available ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'"
              >
                {{ vhostStore.mkcertStatus.available ? 'Ready' : 'Not in bin/mkcert/' }}
              </span>
            </div>
            <p class="text-[11px] text-slate-400 truncate">
              {{ vhostStore.mkcertStatus.available ? 'Local trusted Root CA installed' : 'Place mkcert in bin/mkcert/ to enable HTTPS' }}
            </p>
          </div>
        </div>

        <button
          v-if="vhostStore.mkcertStatus.available && !vhostStore.mkcertStatus.caInstalled"
          @click="vhostStore.installCa"
          :disabled="vhostStore.isInstallingCa"
          class="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center gap-1 transition shrink-0"
        >
          <Key class="w-3 h-3" />
          <span>{{ vhostStore.isInstallingCa ? 'Installing...' : 'Install CA' }}</span>
        </button>
      </div>
    </div>

    <!-- Quick Create Modal / Inline Drawer -->
    <div
      v-if="showCreateModal"
      class="p-4 rounded-xl bg-slate-950/90 border border-cyan-500/30 space-y-3 animate-in fade-in duration-200"
    >
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
          Create New Project in <span class="text-cyan-400 font-mono">www/</span>
        </h4>
        <button @click="showCreateModal = false" class="text-slate-500 hover:text-slate-300 text-xs">&times; Close</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="sm:col-span-2">
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Project Folder Name</label>
          <input
            v-model="newProjectName"
            type="text"
            placeholder="e.g. tokoku, my-api, portal"
            class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
            @keydown.enter="handleCreateProject"
          />
        </div>

        <div>
          <label class="block text-[11px] font-medium text-slate-400 mb-1">Framework Type</label>
          <select
            v-model="newProjectType"
            class="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
          >
            <option value="laravel">Laravel (public/ root)</option>
            <option value="wordpress">WordPress</option>
            <option value="native">Native PHP</option>
          </select>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <button
          @click="showCreateModal = false"
          class="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition"
        >
          Cancel
        </button>
        <button
          @click="handleCreateProject"
          :disabled="isCreating || !newProjectName.trim()"
          class="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
        >
          <Plus class="w-3.5 h-3.5" />
          <span>{{ isCreating ? 'Creating...' : 'Create & Auto-Host' }}</span>
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="vhostStore.projects.length === 0"
      class="p-8 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-3"
    >
      <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
        <Globe class="w-6 h-6" />
      </div>
      <div>
        <h4 class="text-sm font-semibold text-white">No Virtual Host Projects Detected Yet</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Add any subfolder inside <code class="text-cyan-400">www/</code> (e.g. <code class="text-slate-300">www/tokoku/</code>).
          Lados will detect the framework, assign <code class="text-slate-300">&lt;project&gt;.test</code>, sync your system hosts, and generate SSL certificates automatically!
        </p>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
        <button
          @click="quickCreate('tokoku', 'laravel')"
          :disabled="isCreating"
          class="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Sparkles class="w-3.5 h-3.5" />
          + Sample Laravel (tokoku.test)
        </button>
        <button
          @click="quickCreate('myblog', 'wordpress')"
          :disabled="isCreating"
          class="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/30 text-sky-300 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Sparkles class="w-3.5 h-3.5" />
          + Sample WordPress (myblog.test)
        </button>
        <button
          @click="quickCreate('portal', 'native')"
          :disabled="isCreating"
          class="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium flex items-center gap-1.5 transition"
        >
          <Sparkles class="w-3.5 h-3.5" />
          + Sample Native PHP (portal.test)
        </button>
      </div>
    </div>

    <!-- Virtual Hosts List Table / Grid -->
    <div v-else class="space-y-2.5">
      <div
        v-for="project in vhostStore.projects"
        :key="project.name"
        class="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
      >
        <!-- Project & Domain Info -->
        <div class="flex items-start md:items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0 group-hover:border-cyan-500/40 transition">
            <Globe class="w-5 h-5" />
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-sm text-white font-mono">{{ project.domain }}</span>

              <!-- Framework Badge -->
              <span
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                :class="frameworkColors[project.framework] || 'bg-slate-800 text-slate-300 border-slate-700'"
              >
                {{ project.framework }}
              </span>

              <!-- SSL Badge -->
              <span
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1"
                :class="project.hasSsl ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'"
              >
                <Lock class="w-2.5 h-2.5" />
                <span>{{ project.hasSsl ? 'SSL HTTPS' : 'HTTP Only' }}</span>
              </span>
            </div>

            <div class="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span class="text-slate-500">Root:</span>
              <span class="text-slate-300 truncate max-w-sm" :title="project.documentRoot">
                {{ project.documentRoot }}
              </span>
            </div>
          </div>
        </div>

        <!-- Right Side: Action Buttons -->
        <div class="flex items-center gap-2 self-end md:self-center">
          <!-- Generate SSL button if not yet active and mkcert is available -->
          <button
            v-if="!project.hasSsl && vhostStore.mkcertStatus.available"
            @click="handleGenerateSsl(project.domain)"
            class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/40 border border-slate-700 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 text-xs font-medium flex items-center gap-1 transition"
            title="Generate local SSL certificate via mkcert"
          >
            <Key class="w-3 h-3 text-emerald-400" />
            <span>Generate SSL</span>
          </button>

          <!-- Open Directory in Explorer -->
          <button
            @click="workspaceStore.openDirectory(project.projectPath)"
            class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            :title="`Open folder: ${project.projectPath}`"
          >
            <Folder class="w-3.5 h-3.5" />
          </button>

          <!-- Open Isolated Terminal in this Project -->
          <button
            @click="handleOpenTerminal(project.projectPath)"
            class="p-2 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 transition"
            :title="`Open Isolated Terminal in ${project.name}`"
          >
            <Terminal class="w-3.5 h-3.5" />
          </button>

          <!-- Open HTTP / HTTPS in Browser -->
          <button
            @click="workspaceStore.openBrowserUrl(project.hasSsl ? `https://${project.domain}` : `http://${project.domain}`)"
            class="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-xs font-semibold flex items-center gap-1 transition"
            :title="`Open ${project.hasSsl ? 'https' : 'http'}://${project.domain}`"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Open ({{ project.hasSsl ? 'HTTPS' : 'HTTP' }})</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
