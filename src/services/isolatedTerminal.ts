import { Command } from "@tauri-apps/plugin-shell";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  getWorkspaceDirectories,
  isTauri,
  normalizePath,
} from "./workspace";
import { processManager } from "./processManager";

export interface TerminalLaunchResult {
  success: boolean;
  terminalType: "wt" | "cmd" | "powershell" | "linux-terminal" | "simulated";
  workingDir: string;
  customPath: string;
  commandExecuted?: string;
  error?: string;
}

/**
 * Launches an isolated terminal session with Lados binaries (PHP, Nginx, MariaDB, Composer, mkcert)
 * placed at the very front of the system PATH.
 */
export async function openIsolatedTerminal(workingDir?: string, activePhpDir?: string): Promise<TerminalLaunchResult> {
  const dirs = await getWorkspaceDirectories();
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");

  const targetDir = normalizePath(workingDir || dirs.www);
  const effectivePhp = activePhpDir || dirs.binPhp;

  if (!isTauri()) {
    processManager.emitLog(
      "system",
      "system",
      `[Terminal] [Simulation Mode] Isolated terminal requested for directory: ${targetDir}`
    );
    return {
      success: true,
      terminalType: "simulated",
      workingDir: targetDir,
      customPath: `${effectivePhp};${dirs.binNginx};${dirs.binMariadb}/bin;${dirs.binComposer};${dirs.binMkcert}`,
    };
  }

  // =========================================================================
  // WINDOWS TERMINAL / CMD
  // =========================================================================
  if (isWindows) {
    const phpWin = effectivePhp.replace(/\//g, "\\");
    const nginxWin = dirs.binNginx.replace(/\//g, "\\");
    const mariadbWin = `${dirs.binMariadb.replace(/\//g, "\\")}\\bin`;
    const composerWin = dirs.binComposer.replace(/\//g, "\\");
    const mkcertWin = dirs.binMkcert.replace(/\//g, "\\");
    const targetDirWin = targetDir.replace(/\//g, "\\");

    // Put LADOS binary folders at the VERY FRONT of PATH
    const customLadosPath = [phpWin, nginxWin, mariadbWin, composerWin, mkcertWin].join(";");

    try {
      const batPath = await join(dirs.tmp, "lados_terminal.bat");
      const batContent = `@echo off
title LADOS Isolated Terminal
set "PATH=${customLadosPath};%PATH%"
cd /d "${targetDirWin}"
cls
echo ===================================================================
echo   LADOS ISOLATED DEVELOPMENT TERMINAL
echo ===================================================================
echo   Isolated Environment Active:
echo   - PHP:      ${phpWin}
echo   - Nginx:    ${nginxWin}
echo   - MariaDB:  ${mariadbWin}
echo   - Composer: ${composerWin}
echo   - mkcert:   ${mkcertWin}
echo   - Working:  ${targetDirWin}
echo ===================================================================
echo.
prompt [LADOS] $P$G
cmd.exe /k
`;

      await writeTextFile(batPath, batContent);

      // 1. First attempt: Modern Windows Terminal (wt.exe)
      try {
        const wtCmd = Command.create("cmd", [
          "/c",
          "start",
          "wt",
          "-d",
          targetDirWin,
          "cmd.exe",
          "/k",
          batPath,
        ]);
        const wtRes = await wtCmd.execute();
        if (wtRes.code === 0) {
          processManager.emitLog(
            "system",
            "system",
            `[Terminal] Launched Windows Terminal (wt) with isolated Lados PATH at ${targetDirWin}`
          );
          return {
            success: true,
            terminalType: "wt",
            workingDir: targetDirWin,
            customPath: customLadosPath,
            commandExecuted: `wt -d "${targetDirWin}" cmd /k "${batPath}"`,
          };
        }
      } catch {
        // wt not installed or failed, fallback to CMD
      }

      // 2. Fallback: Native Command Prompt (cmd.exe)
      const cmdPrompt = Command.create("cmd", [
        "/c",
        "start",
        "LADOS Terminal",
        batPath,
      ]);
      const cmdRes = await cmdPrompt.execute();

      if (cmdRes.code === 0) {
        processManager.emitLog(
          "system",
          "system",
          `[Terminal] Launched Command Prompt with isolated Lados PATH at ${targetDirWin}`
        );
        return {
          success: true,
          terminalType: "cmd",
          workingDir: targetDirWin,
          customPath: customLadosPath,
          commandExecuted: `cmd.exe /c start "LADOS Terminal" "${batPath}"`,
        };
      }

      throw new Error(cmdRes.stderr || "Failed to start terminal process");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      processManager.emitLog("system", "stderr", `[Terminal] Failed to launch Windows terminal: ${msg}`);
      return {
        success: false,
        terminalType: "cmd",
        workingDir: targetDir,
        customPath: customLadosPath,
        error: msg,
      };
    }
  }

  // =========================================================================
  // LINUX DEFAULT TERMINAL EMULATOR
  // =========================================================================
  const linuxLadosPath = [
    effectivePhp,
    dirs.binNginx,
    `${dirs.binMariadb}/bin`,
    dirs.binComposer,
    dirs.binMkcert,
  ].join(":");

  try {
    const shPath = await join(dirs.tmp, "lados_terminal.sh");
    const shContent = `#!/usr/bin/env bash
export PATH="${linuxLadosPath}:$PATH"
cd "${targetDir}"
echo "==================================================================="
echo "  LADOS ISOLATED DEVELOPMENT TERMINAL"
echo "==================================================================="
echo "  PHP:      ${dirs.binPhp}"
echo "  Nginx:    ${dirs.binNginx}"
echo "  MariaDB:  ${dirs.binMariadb}/bin"
echo "  Composer: ${dirs.binComposer}"
echo "  Working:  ${targetDir}"
echo "==================================================================="
exec bash --login -i
`;

    await writeTextFile(shPath, shContent);

    // Try common Linux terminal emulators
    const emulators = [
      { name: "x-terminal-emulator", args: ["-e", `bash ${shPath}`] },
      { name: "gnome-terminal", args: ["--", "bash", shPath] },
      { name: "konsole", args: ["-e", `bash ${shPath}`] },
      { name: "xfce4-terminal", args: ["-e", `bash ${shPath}`] },
      { name: "xterm", args: ["-e", `bash ${shPath}`] },
    ];

    for (const emu of emulators) {
      try {
        const cmd = Command.create(emu.name, emu.args);
        const res = await cmd.execute();
        if (res.code === 0) {
          processManager.emitLog(
            "system",
            "system",
            `[Terminal] Launched Linux terminal (${emu.name}) with isolated Lados PATH at ${targetDir}`
          );
          return {
            success: true,
            terminalType: "linux-terminal",
            workingDir: targetDir,
            customPath: linuxLadosPath,
            commandExecuted: `${emu.name} ${emu.args.join(" ")}`,
          };
        }
      } catch {
        continue;
      }
    }

    throw new Error("No compatible terminal emulator found (tried x-terminal-emulator, gnome-terminal, konsole, xterm)");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    processManager.emitLog("system", "stderr", `[Terminal] Failed to launch Linux terminal: ${msg}`);
    return {
      success: false,
      terminalType: "linux-terminal",
      workingDir: targetDir,
      customPath: linuxLadosPath,
      error: msg,
    };
  }
}
