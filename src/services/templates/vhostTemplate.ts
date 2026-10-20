import { type WorkspaceDirectories, normalizePath } from "../workspace";
import type { VirtualHostProject } from "../vhostScanner";

/**
 * Builds Nginx virtual host server block configuration for a specific project.
 * Supports SSL HTTPS (port 443) when hasSsl is enabled.
 */
export function buildVirtualHostConfig(
  project: VirtualHostProject,
  dirs: WorkspaceDirectories,
  hasSsl = false
): string {
  const normDocRoot = normalizePath(project.documentRoot);
  const normLogs = normalizePath(dirs.logs);
  const normSsl = normalizePath(dirs.etcNginxSsl);
  const projectName = project.name;
  const domain = project.domain;

  // Framework-specific rewrite rules
  let tryFilesRule = "try_files $uri $uri/ /index.php?$query_string;";
  if (project.framework === "WordPress") {
    tryFilesRule = "try_files $uri $uri/ /index.php?$args;";
  } else if (project.framework === "HTML/Static") {
    tryFilesRule = "try_files $uri $uri/ /index.html;";
  }

  const sslDirectives = hasSsl
    ? `
    listen       443 ssl;
    ssl_certificate      "${normSsl}/${domain}.pem";
    ssl_certificate_key  "${normSsl}/${domain}-key.pem";
    ssl_protocols        TLSv1.2 TLSv1.3;
    ssl_ciphers          HIGH:!aNULL:!MD5;
`
    : "";

  return `# ====================================================================
# LADOS Virtual Host: ${domain}
# Project: ${projectName}
# Detected Framework: ${project.framework}
# SSL Status: ${hasSsl ? "Enabled (HTTPS port 443)" : "Disabled (HTTP port 80 only)"}
# Document Root: ${normDocRoot}
# ====================================================================

server {
    listen       80;${sslDirectives}
    server_name  ${domain} www.${domain};
    root         "${normDocRoot}";
    index        index.php index.html index.htm;

    # Per-project Logging
    access_log   "${normLogs}/${projectName}_access.log";
    error_log    "${normLogs}/${projectName}_error.log" warn;

    client_max_body_size 128M;

    location / {
        ${tryFilesRule}
    }

    # Pass PHP scripts to FastCGI server listening on 127.0.0.1:9000
    location ~ \\.php$ {
        fastcgi_pass   127.0.0.1:9000;
        fastcgi_index  index.php;
        fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
        include        fastcgi_params;
    }

    # Deny access to sensitive files
    location ~ /\\.(?!well-known).* {
        deny all;
        access_log off;
        log_not_found off;
    }
}
`;
}
