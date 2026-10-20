import { writeTextFile, remove, exists, mkdir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  type WorkspaceDirectories,
  isTauri,
} from "./workspace";
import type { VirtualHostProject } from "./vhostScanner";
import {
  buildNginxConfig,
  buildMimeTypes,
  buildFastCgiParams,
} from "./templates/nginxTemplate";
import { buildPhpIni } from "./templates/phpTemplate";
import { buildMariaDbIni } from "./templates/mariadbTemplate";
import { buildVirtualHostConfig } from "./templates/vhostTemplate";

// Re-export all template generators for backward compatibility & direct use
export {
  buildNginxConfig,
  buildMimeTypes,
  buildFastCgiParams,
  buildPhpIni,
  buildMariaDbIni,
  buildVirtualHostConfig,
};

export interface ConfigGenerationResult {
  nginxConf: string;
  phpIni: string;
  mariaDbIni: string;
  timestamp: string;
}

/**
 * Automatically writes or updates etc/nginx/nginx.conf, etc/php/php.ini, and etc/mariadb/my.ini.
 */
export async function generateAllConfigs(dirs: WorkspaceDirectories): Promise<ConfigGenerationResult> {
  const nginxConfContent = buildNginxConfig(dirs);
  const phpIniContent = buildPhpIni(dirs);
  const mariaDbIniContent = buildMariaDbIni(dirs);
  const mimeTypesContent = buildMimeTypes();
  const fastcgiParamsContent = buildFastCgiParams();

  if (isTauri()) {
    // 1. Ensure target directories exist
    const dirsToEnsure = [
      dirs.etc,
      dirs.etcNginx,
      dirs.etcNginxSites,
      dirs.etcNginxSsl,
      dirs.etcPhp,
      dirs.etcMariadb,
    ];
    for (const d of dirsToEnsure) {
      const dExists = await exists(d);
      if (!dExists) {
        await mkdir(d, { recursive: true });
      }
    }

    // 2. Write Nginx files
    const nginxConfPath = await join(dirs.etcNginx, "nginx.conf");
    const mimeTypesPath = await join(dirs.etcNginx, "mime.types");
    const fastcgiParamsPath = await join(dirs.etcNginx, "fastcgi_params");

    await Promise.all([
      writeTextFile(nginxConfPath, nginxConfContent),
      writeTextFile(mimeTypesPath, mimeTypesContent),
      writeTextFile(fastcgiParamsPath, fastcgiParamsContent),
    ]);

    // Backward-compat mirror: write etc/nginx.conf as well
    const legacyNginxConf = await join(dirs.etc, "nginx.conf");
    await writeTextFile(legacyNginxConf, nginxConfContent);

    // 3. Write PHP php.ini
    const phpIniPath = await join(dirs.etcPhp, "php.ini");
    await writeTextFile(phpIniPath, phpIniContent);

    // Backward-compat mirror: write etc/php.ini as well
    const legacyPhpIni = await join(dirs.etc, "php.ini");
    await writeTextFile(legacyPhpIni, phpIniContent);

    // 4. Write MariaDB my.ini and my.cnf
    const mariaDbIniPath = await join(dirs.etcMariadb, "my.ini");
    const mariaDbCnfPath = await join(dirs.etcMariadb, "my.cnf");

    await Promise.all([
      writeTextFile(mariaDbIniPath, mariaDbIniContent),
      writeTextFile(mariaDbCnfPath, mariaDbIniContent),
    ]);

    // Backward-compat mirror: write etc/my.cnf as well
    const legacyMyCnf = await join(dirs.etc, "my.cnf");
    await writeTextFile(legacyMyCnf, mariaDbIniContent);
  }

  return {
    nginxConf: nginxConfContent,
    phpIni: phpIniContent,
    mariaDbIni: mariaDbIniContent,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Writes or updates an Nginx virtual host configuration file.
 */
export async function writeVirtualHostConfig(
  project: VirtualHostProject,
  dirs: WorkspaceDirectories,
  hasSsl = false
): Promise<string> {
  const content = buildVirtualHostConfig(project, dirs, hasSsl);
  const fileName = `${project.name}.conf`;

  if (isTauri()) {
    const filePath = await join(dirs.etcNginxSites, fileName);
    await writeTextFile(filePath, content);
    return filePath;
  }

  return `${dirs.etcNginxSites}/${fileName}`;
}

/**
 * Removes an Nginx virtual host configuration file.
 */
export async function removeVirtualHostConfig(projectName: string, dirs: WorkspaceDirectories): Promise<void> {
  const fileName = `${projectName}.conf`;

  if (isTauri()) {
    const filePath = await join(dirs.etcNginxSites, fileName);
    const fileExists = await exists(filePath);
    if (fileExists) {
      await remove(filePath);
    }
  }
}
