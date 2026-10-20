import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { join } from "@tauri-apps/api/path";
import {
  getWorkspaceDirectories,
  isTauri,
} from "./workspace";
import { processManager } from "./processManager";
import {
  LADOS_START_MARKER,
  LADOS_END_MARKER,
  getSystemHostsPath,
  extractLadosDomains,
  formatLadosBlock,
  mergeHostsContent,
} from "./hostsParser";

// Re-export parser functions and constants for backward compatibility
export {
  LADOS_START_MARKER,
  LADOS_END_MARKER,
  getSystemHostsPath,
  extractLadosDomains,
  formatLadosBlock,
  mergeHostsContent,
};

export interface HostsSyncResult {
  success: boolean;
  updatedDomains: string[];
  escalated: boolean;
  error?: string;
}

/**
 * Reads the system hosts file and extracts Lados managed domains.
 */
export async function readSystemHosts(): Promise<{ fullContent: string; ladosDomains: string[] }> {
  const hostsPath = getSystemHostsPath();

  if (!isTauri()) {
    const saved = localStorage.getItem("lados_simulated_hosts");
    const content = saved || `127.0.0.1 localhost\n::1 localhost\n\n${formatLadosBlock(["welcome.test"])}\n`;
    return {
      fullContent: content,
      ladosDomains: extractLadosDomains(content),
    };
  }

  try {
    const content = await readTextFile(hostsPath);
    return {
      fullContent: content,
      ladosDomains: extractLadosDomains(content),
    };
  } catch (err) {
    console.warn("Failed to read system hosts directly, trying fallback:", err);
    return {
      fullContent: "",
      ladosDomains: [],
    };
  }
}

/**
 * Synchronizes domain list into the system hosts file inside the Lados marker block.
 * Handles Privilege Escalation (Windows UAC via PowerShell RunAs or Linux Polkit via pkexec).
 */
export async function syncHostsDomains(domainsToSync: string[], requestElevation = false): Promise<HostsSyncResult> {
  const dirs = await getWorkspaceDirectories();
  const hostsPath = getSystemHostsPath();
  const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");

  // Always ensure 'welcome.test' is present
  const uniqueDomains = [...new Set(["welcome.test", ...domainsToSync])];

  processManager.emitLog(
    "nginx",
    "system",
    `[Hosts Sync] Synchronizing ${uniqueDomains.length} domains to ${hostsPath}...`
  );

  if (!isTauri()) {
    // Browser simulation
    const current = await readSystemHosts();
    const updatedContent = mergeHostsContent(current.fullContent, uniqueDomains);
    localStorage.setItem("lados_simulated_hosts", updatedContent);
    processManager.emitLog(
      "nginx",
      "system",
      `[Hosts Sync] [Simulation Mode] Hosts file updated successfully: ${uniqueDomains.join(", ")}`
    );
    return {
      success: true,
      updatedDomains: uniqueDomains,
      escalated: false,
    };
  }

  let currentContent = "";
  try {
    const res = await readSystemHosts();
    currentContent = res.fullContent;
  } catch {
    currentContent = "127.0.0.1 localhost\n";
  }

  const currentDomains = extractLadosDomains(currentContent);
  const isIdentical =
    currentDomains.length === uniqueDomains.length &&
    uniqueDomains.every((d) => currentDomains.includes(d));

  if (isIdentical && currentContent.includes(LADOS_START_MARKER)) {
    processManager.emitLog("nginx", "system", "[Hosts Sync] Hosts file already up-to-date. No write needed.");
    return {
      success: true,
      updatedDomains: uniqueDomains,
      escalated: false,
    };
  }

  const updatedContent = mergeHostsContent(currentContent, uniqueDomains);

  // 1. Attempt Direct Write (succeeds if running with Administrator privileges)
  try {
    await writeTextFile(hostsPath, updatedContent);
    processManager.emitLog("nginx", "system", "[Hosts Sync] Hosts file written successfully (Direct write).");
    return {
      success: true,
      updatedDomains: uniqueDomains,
      escalated: false,
    };
  } catch (directErr) {
    if (!requestElevation) {
      processManager.emitLog(
        "nginx",
        "system",
        "[Hosts Sync] Hosts file update requires Administrator privileges. Click 'Sync Hosts' in Settings when ready."
      );
      return {
        success: false,
        updatedDomains: [],
        escalated: false,
        error: "Administrator privileges required",
      };
    }
    processManager.emitLog(
      "nginx",
      "system",
      `[Hosts Sync] Direct write permission denied: ${directErr}. Requesting Privilege Escalation...`
    );
  }

  // 2. Privilege Escalation (Windows UAC or Linux Polkit)
  try {
    // Write staging content to portable tmp/hosts.lados
    const tempHostsPath = await join(dirs.tmp, "hosts.lados");
    await writeTextFile(tempHostsPath, updatedContent);

    if (isWindows) {
      // Windows UAC Elevation using Start-Process -Verb RunAs
      processManager.emitLog(
        "nginx",
        "system",
        "[Hosts Sync] Prompting Windows UAC Administrator dialog..."
      );

      // We run powershell with Start-Process to trigger native UAC prompt
      const escapedTemp = tempHostsPath.replace(/\\/g, "\\\\");
      const psScript = `Start-Process powershell -ArgumentList '-NoProfile -Command Copy-Item -Force \\"${escapedTemp}\\" \\"C:\\\\Windows\\\\System32\\\\drivers\\\\etc\\\\hosts\\"' -Verb RunAs -Wait`;

      const command = Command.create("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        psScript,
      ]);

      const output = await command.execute();

      if (output.code === 0) {
        processManager.emitLog(
          "nginx",
          "system",
          `[Hosts Sync] Hosts file updated successfully via UAC elevation: ${uniqueDomains.join(", ")}`
        );
        return {
          success: true,
          updatedDomains: uniqueDomains,
          escalated: true,
        };
      } else {
        const errMsg = output.stderr || output.stdout || "UAC prompt was cancelled or denied";
        processManager.emitLog("nginx", "stderr", `[Hosts Sync] UAC Escalation failed: ${errMsg}`);
        return {
          success: false,
          updatedDomains: [],
          escalated: true,
          error: errMsg,
        };
      }
    } else {
      // Linux Polkit Escalation using pkexec
      processManager.emitLog("nginx", "system", "[Hosts Sync] Requesting Linux Polkit elevation via pkexec...");

      const command = Command.create("pkexec", ["cp", tempHostsPath, "/etc/hosts"]);
      const output = await command.execute();

      if (output.code === 0) {
        processManager.emitLog(
          "nginx",
          "system",
          `[Hosts Sync] /etc/hosts updated successfully via Polkit: ${uniqueDomains.join(", ")}`
        );
        return {
          success: true,
          updatedDomains: uniqueDomains,
          escalated: true,
        };
      } else {
        const errMsg = output.stderr || output.stdout || "Polkit elevation failed";
        processManager.emitLog("nginx", "stderr", `[Hosts Sync] Polkit Escalation failed: ${errMsg}`);
        return {
          success: false,
          updatedDomains: [],
          escalated: true,
          error: errMsg,
        };
      }
    }
  } catch (escalateErr) {
    const msg = escalateErr instanceof Error ? escalateErr.message : String(escalateErr);
    processManager.emitLog("nginx", "stderr", `[Hosts Sync] Privilege Escalation error: ${msg}`);
    return {
      success: false,
      updatedDomains: [],
      escalated: true,
      error: msg,
    };
  }
}
