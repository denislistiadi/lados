import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { Command } from "@tauri-apps/plugin-shell";
import { join } from "@tauri-apps/api/path";
import {
  type WorkspaceDirectories,
  getWorkspaceDirectories,
  isTauri,
  normalizePath,
} from "./workspace";
import { processManager } from "./processManager";

export interface MkcertStatus {
  available: boolean;
  version?: string;
  binaryPath?: string;
  isCustomBin: boolean;
  caInstalled: boolean;
}

export interface SslCertResult {
  success: boolean;
  domain: string;
  certPath: string;
  keyPath: string;
  error?: string;
}

class SslManagerService {
  private cachedStatus: MkcertStatus | null = null;

  /**
   * Checks if mkcert is available in bin/mkcert/ or in system PATH.
   */
  public async checkMkcert(dirs?: WorkspaceDirectories): Promise<MkcertStatus> {
    const workspaceDirs = dirs || (await getWorkspaceDirectories());

    if (!isTauri()) {
      // Browser simulation
      const simulatedAvailable = localStorage.getItem("lados_simulated_mkcert") !== "false";
      return {
        available: simulatedAvailable,
        version: "v1.4.4-portable",
        binaryPath: `${workspaceDirs.binMkcert}/mkcert.exe`,
        isCustomBin: true,
        caInstalled: true,
      };
    }

    const isWindows = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("windows");
    const exeName = isWindows ? "mkcert.exe" : "mkcert";
    const customBinPath = normalizePath(await join(workspaceDirs.binMkcert, exeName));

    // 1. Check portable bin/mkcert/
    const hasCustomBin = await exists(customBinPath);
    if (hasCustomBin) {
      try {
        const cmd = Command.create("bin-mkcert", ["-version"], { cwd: workspaceDirs.root });
        const output = await cmd.execute();
        this.cachedStatus = {
          available: true,
          version: output.stdout.trim() || "1.4.4",
          binaryPath: customBinPath,
          isCustomBin: true,
          caInstalled: true,
        };
        return this.cachedStatus;
      } catch {
        // Fallback to custom path found
        this.cachedStatus = {
          available: true,
          binaryPath: customBinPath,
          isCustomBin: true,
          caInstalled: false,
        };
        return this.cachedStatus;
      }
    }

    // 2. Check system PATH
    try {
      const sysCmd = Command.create("mkcert", ["-version"]);
      const sysOut = await sysCmd.execute();
      if (sysOut.code === 0) {
        this.cachedStatus = {
          available: true,
          version: sysOut.stdout.trim(),
          binaryPath: "mkcert (System PATH)",
          isCustomBin: false,
          caInstalled: true,
        };
        return this.cachedStatus;
      }
    } catch {
      // Not in path
    }

    this.cachedStatus = {
      available: false,
      isCustomBin: false,
      caInstalled: false,
    };
    return this.cachedStatus;
  }

  /**
   * Installs mkcert local root CA into the system trust store.
   */
  public async installLocalCa(): Promise<boolean> {
    const dirs = await getWorkspaceDirectories();
    const status = await this.checkMkcert(dirs);

    if (!status.available) {
      processManager.emitLog("nginx", "stderr", "[SSL] Cannot install CA: mkcert binary not found in bin/mkcert/ or PATH.");
      return false;
    }

    processManager.emitLog("nginx", "system", "[SSL] Installing mkcert local Root CA into system trust store...");

    if (!isTauri()) {
      processManager.emitLog("nginx", "system", "[SSL] [Simulation Mode] Root CA installed successfully.");
      return true;
    }

    try {
      const prog = status.isCustomBin ? "bin-mkcert" : "mkcert";
      const cmd = Command.create(prog, ["-install"], { cwd: dirs.root });
      const output = await cmd.execute();

      if (output.code === 0) {
        processManager.emitLog("nginx", "system", `[SSL] Root CA installed: ${output.stdout || "Success"}`);
        return true;
      } else {
        processManager.emitLog("nginx", "stderr", `[SSL] Root CA installation warning: ${output.stderr || output.stdout}`);
        return false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      processManager.emitLog("nginx", "stderr", `[SSL] Root CA install error: ${msg}`);
      return false;
    }
  }

  /**
   * Checks if an SSL certificate already exists for a domain.
   */
  public async hasCertificate(domain: string, dirs?: WorkspaceDirectories): Promise<boolean> {
    const workspaceDirs = dirs || (await getWorkspaceDirectories());
    const certPath = normalizePath(await join(workspaceDirs.etcNginxSsl, `${domain}.pem`));
    const keyPath = normalizePath(await join(workspaceDirs.etcNginxSsl, `${domain}-key.pem`));

    if (!isTauri()) {
      const certs = JSON.parse(localStorage.getItem("lados_simulated_certs") || "[]");
      return certs.includes(domain);
    }

    const [hasCert, hasKey] = await Promise.all([exists(certPath), exists(keyPath)]);
    return hasCert && hasKey;
  }

  /**
   * Generates a local SSL certificate (.pem) for a .test domain inside etc/nginx/ssl/.
   */
  public async generateCertificate(domain: string, dirs?: WorkspaceDirectories): Promise<SslCertResult> {
    const workspaceDirs = dirs || (await getWorkspaceDirectories());
    const status = await this.checkMkcert(workspaceDirs);

    const certPath = normalizePath(await join(workspaceDirs.etcNginxSsl, `${domain}.pem`));
    const keyPath = normalizePath(await join(workspaceDirs.etcNginxSsl, `${domain}-key.pem`));

    // Ensure ssl folder exists
    if (isTauri()) {
      const sslDirExists = await exists(workspaceDirs.etcNginxSsl);
      if (!sslDirExists) {
        await mkdir(workspaceDirs.etcNginxSsl, { recursive: true });
      }
    }

    if (!status.available) {
      processManager.emitLog(
        "nginx",
        "system",
        `[SSL] mkcert not found in bin/mkcert/. Skipped local HTTPS certificate generation for ${domain}.`
      );
      return {
        success: false,
        domain,
        certPath,
        keyPath,
        error: "mkcert not found",
      };
    }

    processManager.emitLog("nginx", "system", `[SSL] Generating trusted SSL certificate for ${domain}...`);

    if (!isTauri()) {
      // Browser simulation
      const certs = JSON.parse(localStorage.getItem("lados_simulated_certs") || "[]");
      if (!certs.includes(domain)) {
        certs.push(domain);
        localStorage.setItem("lados_simulated_certs", JSON.stringify(certs));
      }
      processManager.emitLog(
        "nginx",
        "system",
        `[SSL] [Simulation Mode] Generated local SSL certificate: ${domain}.pem and ${domain}-key.pem`
      );
      return {
        success: true,
        domain,
        certPath,
        keyPath,
      };
    }

    try {
      const prog = status.isCustomBin ? "bin-mkcert" : "mkcert";
      const args = [
        "-cert-file",
        certPath,
        "-key-file",
        keyPath,
        domain,
        `*.${domain}`,
        "localhost",
        "127.0.0.1",
      ];

      const command = Command.create(prog, args, { cwd: workspaceDirs.root });
      const output = await command.execute();

      if (output.code === 0) {
        processManager.emitLog(
          "nginx",
          "system",
          `[SSL] Successfully generated trusted certificate for ${domain} (${domain}.pem)`
        );
        return {
          success: true,
          domain,
          certPath,
          keyPath,
        };
      } else {
        const err = output.stderr || output.stdout || "Certificate creation failed";
        processManager.emitLog("nginx", "stderr", `[SSL] mkcert generation failed for ${domain}: ${err}`);
        return {
          success: false,
          domain,
          certPath,
          keyPath,
          error: err,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      processManager.emitLog("nginx", "stderr", `[SSL] Error running mkcert for ${domain}: ${msg}`);
      return {
        success: false,
        domain,
        certPath,
        keyPath,
        error: msg,
      };
    }
  }
}

export const sslManager = new SslManagerService();
