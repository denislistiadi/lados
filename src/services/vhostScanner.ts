import { readDir, exists, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  type WorkspaceDirectories,
  normalizePath,
  isTauri,
} from "./workspace";
import { writeVirtualHostConfig, removeVirtualHostConfig } from "./configGenerator";
import { sslManager } from "./sslManager";

export type FrameworkType = "Laravel" | "WordPress" | "Native PHP" | "HTML/Static";

export interface VirtualHostProject {
  name: string;
  domain: string;
  framework: FrameworkType;
  projectPath: string;
  documentRoot: string;
  hasIndexPhp: boolean;
  hasIndexHtml: boolean;
  configFile: string;
  detectedAt: string;
  hasSsl: boolean;
}

/**
 * Detects the framework of a project inside www/<projectName>.
 */
export async function detectProjectFramework(
  projectName: string,
  projectPath: string
): Promise<{ framework: FrameworkType; documentRoot: string; hasIndexPhp: boolean; hasIndexHtml: boolean }> {
  if (!isTauri()) {
    // Browser mock detection
    const isLara = projectName.toLowerCase().includes("laravel") || projectName.toLowerCase().includes("shop");
    const isWp = projectName.toLowerCase().includes("wp") || projectName.toLowerCase().includes("blog");
    if (isLara) {
      return { framework: "Laravel", documentRoot: `${projectPath}/public`, hasIndexPhp: true, hasIndexHtml: false };
    }
    if (isWp) {
      return { framework: "WordPress", documentRoot: projectPath, hasIndexPhp: true, hasIndexHtml: false };
    }
    return { framework: "Native PHP", documentRoot: projectPath, hasIndexPhp: true, hasIndexHtml: false };
  }

  let entries: { name: string; isDirectory: boolean; isFile: boolean }[] = [];
  try {
    entries = await readDir(projectPath);
  } catch (err) {
    console.warn(`Failed to read project directory ${projectPath}:`, err);
    return { framework: "Native PHP", documentRoot: projectPath, hasIndexPhp: false, hasIndexHtml: false };
  }

  const fileNames = new Set(entries.map((e) => e.name.toLowerCase()));

  // 1. Check Laravel Detection:
  let isLaravel = fileNames.has("artisan");
  if (!isLaravel && fileNames.has("composer.json")) {
    try {
      const composerPath = await join(projectPath, "composer.json");
      const content = await readTextFile(composerPath);
      if (content.includes("laravel/framework")) {
        isLaravel = true;
      }
    } catch {
      // Ignore read errors
    }
  }

  if (isLaravel) {
    const publicPath = normalizePath(await join(projectPath, "public"));
    const publicExists = await exists(publicPath);
    return {
      framework: "Laravel",
      documentRoot: publicExists ? publicPath : projectPath,
      hasIndexPhp: true,
      hasIndexHtml: false,
    };
  }

  // 2. Check WordPress Detection:
  const isWordPress =
    fileNames.has("wp-config.php") ||
    fileNames.has("wp-config-sample.php") ||
    fileNames.has("wp-content") ||
    fileNames.has("wp-login.php");

  if (isWordPress) {
    return {
      framework: "WordPress",
      documentRoot: projectPath,
      hasIndexPhp: true,
      hasIndexHtml: false,
    };
  }

  // 3. Check Native PHP or HTML/Static:
  const hasIndexPhp = fileNames.has("index.php");
  const hasIndexHtml = fileNames.has("index.html") || fileNames.has("index.htm");
  const hasPublicDir = fileNames.has("public");

  if (hasPublicDir) {
    const publicDir = normalizePath(await join(projectPath, "public"));
    const publicIndexPhp = await exists(await join(publicDir, "index.php"));
    const publicIndexHtml = await exists(await join(publicDir, "index.html"));

    if (publicIndexPhp || publicIndexHtml) {
      return {
        framework: publicIndexPhp ? "Native PHP" : "HTML/Static",
        documentRoot: publicDir,
        hasIndexPhp: publicIndexPhp,
        hasIndexHtml: publicIndexHtml,
      };
    }
  }

  return {
    framework: hasIndexPhp ? "Native PHP" : "HTML/Static",
    documentRoot: projectPath,
    hasIndexPhp,
    hasIndexHtml,
  };
}

/**
 * Scans www/ directory to detect all project folders, frameworks, and SSL status.
 */
export async function scanVirtualHosts(dirs: WorkspaceDirectories): Promise<VirtualHostProject[]> {
  const normWww = normalizePath(dirs.www);

  if (!isTauri()) {
    // Web fallback demo projects
    const demoProjects = JSON.parse(localStorage.getItem("lados_demo_projects") || "null") || [
      { name: "tokoku", framework: "Laravel", hasIndexPhp: true, hasIndexHtml: false },
      { name: "myblog", framework: "WordPress", hasIndexPhp: true, hasIndexHtml: false },
      { name: "company-profile", framework: "Native PHP", hasIndexPhp: true, hasIndexHtml: false },
    ];

    const certs = JSON.parse(localStorage.getItem("lados_simulated_certs") || "[]");

    return demoProjects.map((p: { name: string; framework: FrameworkType }) => {
      const pPath = `${normWww}/${p.name}`;
      const docRoot = p.framework === "Laravel" ? `${pPath}/public` : pPath;
      const domain = `${p.name}.test`;
      return {
        name: p.name,
        domain,
        framework: p.framework,
        projectPath: pPath,
        documentRoot: docRoot,
        hasIndexPhp: true,
        hasIndexHtml: false,
        configFile: `${dirs.etcNginxSites}/${p.name}.conf`,
        detectedAt: new Date().toLocaleTimeString(),
        hasSsl: certs.includes(domain),
      };
    });
  }

  const projects: VirtualHostProject[] = [];

  try {
    const entries = await readDir(normWww);

    for (const entry of entries) {
      if (!entry.isDirectory || entry.name.startsWith(".")) {
        continue;
      }

      const projectName = entry.name;
      const domain = `${projectName}.test`;
      const projectPath = normalizePath(await join(normWww, projectName));

      const [detection, hasSsl] = await Promise.all([
        detectProjectFramework(projectName, projectPath),
        sslManager.hasCertificate(domain, dirs),
      ]);

      projects.push({
        name: projectName,
        domain,
        framework: detection.framework,
        projectPath,
        documentRoot: detection.documentRoot,
        hasIndexPhp: detection.hasIndexPhp,
        hasIndexHtml: detection.hasIndexHtml,
        configFile: `${dirs.etcNginxSites}/${projectName}.conf`,
        detectedAt: new Date().toLocaleTimeString(),
        hasSsl,
      });
    }
  } catch (err) {
    console.error("Failed to scan www directory for virtual hosts:", err);
  }

  return projects;
}

/**
 * Scans www/ and synchronizes all server blocks into etc/nginx/sites-enabled/.
 * - Writes new / updated config files.
 * - Deletes config files for removed projects.
 * Returns the list of active virtual hosts and boolean indicating if any changes occurred.
 */
export async function scanAndSyncVirtualHosts(
  dirs: WorkspaceDirectories,
  previousProjects: VirtualHostProject[] = []
): Promise<{ projects: VirtualHostProject[]; hasChanges: boolean }> {
  const currentProjects = await scanVirtualHosts(dirs);

  const prevMap = new Map(previousProjects.map((p) => [p.name, p]));
  const currentMap = new Map(currentProjects.map((p) => [p.name, p]));

  let hasChanges = false;

  // 1. Check for removed projects -> delete .conf file
  for (const prev of previousProjects) {
    if (!currentMap.has(prev.name)) {
      hasChanges = true;
      await removeVirtualHostConfig(prev.name, dirs);
    }
  }

  // 2. Check for added or modified projects -> write .conf file
  for (const curr of currentProjects) {
    const prev = prevMap.get(curr.name);
    const isNew = !prev;
    const isModified =
      prev &&
      (prev.documentRoot !== curr.documentRoot ||
        prev.framework !== curr.framework ||
        prev.hasSsl !== curr.hasSsl);

    if (isNew || isModified) {
      hasChanges = true;
      await writeVirtualHostConfig(curr, dirs, curr.hasSsl);
    }
  }

  return {
    projects: currentProjects,
    hasChanges,
  };
}
