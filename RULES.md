# PROJECT RULES: LADOS (Tauri v2 Pure TypeScript Local Server)

1. STACK RESTRICTION:
   - Framework: Tauri v2 (STRICTLY TypeScript, NO custom Rust backend code).
   - Frontend: Vue 3 (Composition API `<script setup lang="ts">`), TypeScript, Pinia, Tailwind CSS, `lucide-vue-next`.
   - Core Plugins: `@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-http`, `@tauri-apps/plugin-opener`.

2. CAPABILITIES & PERMISSIONS LOCK:
   - Ensure `src-tauri/capabilities/default.json` explicitly grants permissions for `shell:allow-spawn`, `shell:allow-kill`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-read-dir`, `fs:allow-watch`, and `http:allow-fetch`.

3. CROSS-PLATFORM & PROCESS RULES:
   - Windows Process Flag: When spawning processes via `@tauri-apps/plugin-shell`, always configure process creation flags or ensure background servers (Nginx/PHP/MariaDB) run cleanly without popping up black CMD windows.
   - Path Formatting: On Windows, always normalize paths to forward slashes (`/`) when writing into Nginx configuration files.
