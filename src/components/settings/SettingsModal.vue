<script setup lang="ts">
import { useVhostStore } from "@/stores/vhost";
import PhpSettingsTab from "./PhpSettingsTab.vue";
import VirtualHostsTab from "./VirtualHostsTab.vue";
import SslHostsTab from "./SslHostsTab.vue";
import BinaryDownloader from "@/components/BinaryDownloader.vue";
import ConsoleLog from "@/components/ConsoleLog.vue";
import {
  Settings,
  X,
  FileCode,
  Globe,
  Package,
  Lock,
  Terminal,
} from "lucide-vue-next";

export type SettingsTab = "php" | "sites" | "packages" | "ssl" | "logs";

defineProps<{
  show: boolean;
  activeTab: SettingsTab;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "update:activeTab", tab: SettingsTab): void;
  (e: "open-new-project"): void;
}>();

const vhostStore = useVhostStore();
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all"
    @click.self="$emit('close')"
  >
    <div class="glass-modal w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 space-y-4 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
      
      <!-- Modal Top Bar -->
      <div class="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <Settings class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm sm:text-base text-white">Settings & Tools</h3>
            <p class="text-[11px] text-slate-400">Configure PHP runtime, virtual hosts, packages, and SSL</p>
          </div>
        </div>

        <button
          @click="$emit('close')"
          class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          title="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Horizontal Tab Selector -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/60 text-xs">
        <button
          @click="$emit('update:activeTab', 'php')"
          class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          :class="activeTab === 'php' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
        >
          <FileCode class="w-3.5 h-3.5" />
          <span>PHP Version</span>
        </button>

        <button
          @click="$emit('update:activeTab', 'sites')"
          class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          :class="activeTab === 'sites' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
        >
          <Globe class="w-3.5 h-3.5" />
          <span>Virtual Hosts ({{ vhostStore.projects.length }})</span>
        </button>

        <button
          @click="$emit('update:activeTab', 'packages')"
          class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          :class="activeTab === 'packages' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
        >
          <Package class="w-3.5 h-3.5" />
          <span>Package Hub</span>
        </button>

        <button
          @click="$emit('update:activeTab', 'ssl')"
          class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          :class="activeTab === 'ssl' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
        >
          <Lock class="w-3.5 h-3.5" />
          <span>SSL & Hosts</span>
        </button>

        <button
          @click="$emit('update:activeTab', 'logs')"
          class="px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          :class="activeTab === 'logs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'"
        >
          <Terminal class="w-3.5 h-3.5" />
          <span>Console Logs</span>
        </button>
      </div>

      <!-- Active Tab Panels -->
      <PhpSettingsTab v-if="activeTab === 'php'" />
      
      <VirtualHostsTab
        v-else-if="activeTab === 'sites'"
        @open-new-project="$emit('open-new-project')"
      />

      <div v-else-if="activeTab === 'packages'" class="py-1">
        <BinaryDownloader />
      </div>

      <SslHostsTab v-else-if="activeTab === 'ssl'" />

      <div v-else-if="activeTab === 'logs'" class="py-1">
        <ConsoleLog />
      </div>

    </div>
  </div>
</template>
