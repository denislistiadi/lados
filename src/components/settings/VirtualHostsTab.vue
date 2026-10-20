<script setup lang="ts">
import { useWorkspaceStore } from "@/stores/workspace";
import { useVhostStore } from "@/stores/vhost";
import type { VirtualHostProject, FrameworkType } from "@/services/vhostScanner";
import { Globe, Plus, Lock, ExternalLink } from "lucide-vue-next";

defineEmits<{
  (e: "open-new-project"): void;
}>();

const workspaceStore = useWorkspaceStore();
const vhostStore = useVhostStore();

const frameworkBadges: Record<FrameworkType, { label: string; class: string }> = {
  Laravel: { label: "Laravel", class: "bg-rose-500/10 text-rose-400 border-rose-500/20" },
  WordPress: { label: "WordPress", class: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  "Native PHP": { label: "PHP Native", class: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  "HTML/Static": { label: "Static HTML", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

async function handleOpenProject(project: VirtualHostProject) {
  const url = project.hasSsl ? `https://${project.domain}` : `http://${project.domain}`;
  await workspaceStore.openBrowserUrl(url);
}
</script>

<template>
  <div class="space-y-3 py-1">
    <div class="flex items-center justify-between">
      <div>
        <h4 class="text-xs font-bold text-slate-300 uppercase tracking-wider">Local Projects (www/)</h4>
        <p class="text-xs text-slate-400">Scanned and mapped to <code class="text-cyan-400">&lt;project&gt;.test</code></p>
      </div>
      <button
        @click="$emit('open-new-project')"
        class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>+ New Project</span>
      </button>
    </div>

    <!-- Sites List -->
    <div v-if="vhostStore.projects.length > 0" class="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
      <div
        v-for="project in vhostStore.projects"
        :key="project.name"
        class="w-full p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
            <Globe class="w-3.5 h-3.5" />
          </div>
          <div class="min-w-0 text-left">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-xs sm:text-sm text-white font-mono truncate">{{ project.domain }}</span>
              <span
                class="text-[10px] px-1.5 py-0.2 rounded-full border"
                :class="frameworkBadges[project.framework]?.class || 'bg-slate-800 text-slate-400 border-slate-700'"
              >
                {{ frameworkBadges[project.framework]?.label || project.framework }}
              </span>
              <span v-if="project.hasSsl" class="text-[10px] text-emerald-400 flex items-center gap-0.5" title="HTTPS Active">
                <Lock class="w-3 h-3" />
              </span>
            </div>
            <p class="text-[10px] text-slate-500 font-mono truncate">{{ project.documentRoot }}</p>
          </div>
        </div>

        <button
          @click="handleOpenProject(project)"
          class="px-2.5 py-1 rounded-lg bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1 transition shrink-0"
        >
          <span>Open</span>
          <ExternalLink class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Empty Sites State -->
    <div v-else class="p-6 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-center space-y-2">
      <p class="text-xs text-slate-400">No project directories found inside <code class="text-cyan-400">www/</code>.</p>
      <button
        @click="$emit('open-new-project')"
        class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold inline-flex items-center gap-1 transition"
      >
        <Plus class="w-3.5 h-3.5" />
        Create Sample Project
      </button>
    </div>
  </div>
</template>
