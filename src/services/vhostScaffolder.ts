import { mkdir, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import type { WorkspaceDirectories } from "./workspace";
import type { VirtualHostProject } from "./vhostScanner";
import { sslManager } from "./sslManager";
import { writeVirtualHostConfig } from "./configGenerator";

export type SampleProjectType = "laravel" | "wordpress" | "native";

/**
 * Creates scaffold files and directories for a sample project on disk.
 */
export async function createSampleScaffold(
  projectDir: string,
  sanitizedName: string,
  type: SampleProjectType
): Promise<void> {
  await mkdir(projectDir, { recursive: true });

  if (type === "laravel") {
    const publicDir = await join(projectDir, "public");
    await mkdir(publicDir, { recursive: true });
    // artisan file
    await writeTextFile(
      await join(projectDir, "artisan"),
      "#!/usr/bin/env php\n<?php // Laravel Console"
    );
    // public/index.php
    await writeTextFile(
      await join(publicDir, "index.php"),
      `<?php\n// Laravel Front Controller for ${sanitizedName}\necho "<h1>Hello from Laravel (${sanitizedName}.test)</h1><p>Running on LADOS Local Server</p>";`
    );
  } else if (type === "wordpress") {
    await writeTextFile(
      await join(projectDir, "wp-config.php"),
      `<?php\n// WordPress Configuration for ${sanitizedName}\ndefine('DB_NAME', '${sanitizedName}_db');\ndefine('DB_USER', 'root');\ndefine('DB_PASSWORD', '');\ndefine('DB_HOST', '127.0.0.1');`
    );
    await writeTextFile(
      await join(projectDir, "index.php"),
      `<?php\n// WordPress Front Controller for ${sanitizedName}\necho "<h1>Hello from WordPress (${sanitizedName}.test)</h1><p>Running on LADOS Local Server</p>";`
    );
  } else {
    await writeTextFile(
      await join(projectDir, "index.php"),
      `<?php\n// Native PHP for ${sanitizedName}\necho "<h1>Welcome to ${sanitizedName}.test</h1><p>PHP " . phpversion() . " on LADOS Local Server</p>";`
    );
  }
}

/**
 * Creates a simulated mock project for browser preview mode.
 */
export async function createMockSampleProject(
  sanitizedName: string,
  type: SampleProjectType,
  dirs: WorkspaceDirectories
): Promise<VirtualHostProject> {
  const mockFramework = type === "laravel" ? "Laravel" : type === "wordpress" ? "WordPress" : "Native PHP";
  const projectDir = `${dirs.www}/${sanitizedName}`;
  const docRoot = type === "laravel" ? `${projectDir}/public` : projectDir;
  const domain = `${sanitizedName}.test`;

  await sslManager.generateCertificate(domain, dirs);

  return {
    name: sanitizedName,
    domain,
    framework: mockFramework,
    projectPath: projectDir,
    documentRoot: docRoot,
    hasIndexPhp: true,
    hasIndexHtml: false,
    configFile: `${dirs.etcNginxSites}/${sanitizedName}.conf`,
    detectedAt: new Date().toLocaleTimeString(),
    hasSsl: true,
  };
}

/**
 * Auto-generates local trusted SSL certificates for projects lacking certificates.
 */
export async function autoGenerateProjectsSsl(
  projects: VirtualHostProject[],
  dirs: WorkspaceDirectories
): Promise<boolean> {
  const mkcertStatus = await sslManager.checkMkcert(dirs);
  if (!mkcertStatus.available) {
    return false;
  }

  let generatedAny = false;

  for (const project of projects) {
    if (!project.hasSsl) {
      const certRes = await sslManager.generateCertificate(project.domain, dirs);
      if (certRes.success) {
        project.hasSsl = true;
        generatedAny = true;
        await writeVirtualHostConfig(project, dirs, true);
      }
    }
  }

  return generatedAny;
}
