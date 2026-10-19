<script setup lang="ts">
import { X, Package } from "lucide-vue-next";
import BinaryDownloader from "@/components/BinaryDownloader.vue";

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md transition-all"
    @click.self="emit('close')"
  >
    <div class="glass-modal w-full max-w-4xl rounded-2xl p-4 sm:p-6 space-y-4 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
      <!-- Modal Header -->
      <div class="flex items-center justify-between border-b border-white/10 pb-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg">
            <Package class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-base font-bold text-white tracking-tight flex items-center gap-2">
              LADOS Package Hub
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                Binary Catalog
              </span>
            </h3>
            <p class="text-[11px] text-slate-400">
              Official portable binaries for PHP, Nginx, MariaDB, Composer, and mkcert.
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

      <!-- Downloader Content -->
      <BinaryDownloader />
    </div>
  </div>
</template>
