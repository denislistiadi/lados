<script setup lang="ts">
import { ref } from "vue";
import { useVhostStore } from "@/stores/vhost";
import { X } from "lucide-vue-next";

defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const vhostStore = useVhostStore();

const newProjectName = ref("");
const newProjectType = ref<"laravel" | "wordpress" | "native">("laravel");
const isCreatingProject = ref(false);

async function handleCreateProject() {
  if (!newProjectName.value.trim()) return;
  isCreatingProject.value = true;
  try {
    await vhostStore.createSample(newProjectName.value, newProjectType.value);
    newProjectName.value = "";
    emit("close");
  } finally {
    isCreatingProject.value = false;
  }
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-3.5 shadow-2xl">
      <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <h3 class="font-bold text-sm text-white">Create New Web Project</h3>
        <button
          @click="$emit('close')"
          class="text-slate-400 hover:text-white"
          title="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="space-y-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Project Folder Name</label>
          <input
            v-model="newProjectName"
            type="text"
            placeholder="e.g. my-app"
            class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
          <span class="text-[11px] text-slate-500 mt-1 block">
            Auto domain: <code>{{ newProjectName ? `${newProjectName}.test` : 'project.test' }}</code>
          </span>
        </div>

        <div>
          <label class="block text-xs text-slate-400 mb-1">Framework Preset</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              @click="newProjectType = 'laravel'"
              class="py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center"
              :class="newProjectType === 'laravel' ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'"
            >
              Laravel
            </button>
            <button
              type="button"
              @click="newProjectType = 'wordpress'"
              class="py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center"
              :class="newProjectType === 'wordpress' ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'"
            >
              WordPress
            </button>
            <button
              type="button"
              @click="newProjectType = 'native'"
              class="py-1.5 px-2 rounded-xl text-xs font-semibold border transition text-center"
              :class="newProjectType === 'native' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-950 text-slate-400 border-slate-800'"
            >
              PHP Native
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-1">
        <button
          @click="$emit('close')"
          class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
        >
          Cancel
        </button>
        <button
          @click="handleCreateProject"
          :disabled="!newProjectName.trim() || isCreatingProject"
          class="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition disabled:opacity-50"
        >
          {{ isCreatingProject ? 'Creating...' : 'Create & Host' }}
        </button>
      </div>
    </div>
  </div>
</template>
