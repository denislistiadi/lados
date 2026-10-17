import { writeTextFile, remove, exists, mkdir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import {
  type WorkspaceDirectories,
  normalizePath,
  isTauri,
} from "./workspace";
import type { VirtualHostProject } from "./vhostScanner";

export interface ConfigGenerationResult {
  nginxConf: string;
  phpIni: string;
  mariaDbIni: string;
  timestamp: string;
}

/**
 * Builds standard Nginx configuration with absolute forward-slash paths.
 * Adheres strictly to RULE 3: On Windows, always normalize paths to forward slashes (/).
 */
export function buildNginxConfig(dirs: WorkspaceDirectories): string {
  const normLogs = normalizePath(dirs.logs);
  const normTmp = normalizePath(dirs.tmp);
  const normWww = normalizePath(dirs.www);
  const normSites = normalizePath(dirs.etcNginxSites);

  return `# ====================================================================
# LADOS Portable Nginx Master Configuration
# Automatically generated with absolute forward-slash paths (RULE 3)
# ====================================================================

worker_processes  1;

error_log  "${normLogs}/nginx_error.log" warn;
pid        "${normTmp}/nginx.pid";

events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    # Logging settings
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  "${normLogs}/nginx_access.log"  main;

    # Performance & buffer settings
    sendfile        on;
    tcp_nopush      on;
    tcp_nodelay     on;
    keepalive_timeout  65;
    client_max_body_size 128M;

    # FastCGI timeout settings
    fastcgi_connect_timeout 300s;
    fastcgi_send_timeout 300s;
    fastcgi_read_timeout 300s;
    fastcgi_buffer_size 128k;
    fastcgi_buffers 4 256k;
    fastcgi_busy_buffers_size 256k;

    # Gzip Compression
    gzip  on;
    gzip_min_length  1024;
    gzip_types  text/plain text/css application/json application/javascript text/xml application/xml;

    # ----------------------------------------------------------------
    # Default Server Block (localhost / 127.0.0.1)
    # ----------------------------------------------------------------
    server {
        listen       80 default_server;
        server_name  localhost 127.0.0.1;
        root         "${normWww}";
        index        index.php index.html index.htm;

        location / {
            try_files $uri $uri/ /index.php?$query_string;
        }

        # FastCGI execution for PHP
        location ~ \\.php$ {
            fastcgi_pass   127.0.0.1:9000;
            fastcgi_index  index.php;
            fastcgi_param  SCRIPT_FILENAME  $document_root$fastcgi_script_name;
            include        fastcgi_params;
        }

        # Deny hidden files (.git, .env, .htaccess)
        location ~ /\\. {
            deny  all;
            access_log off;
            log_not_found off;
        }
    }

    # ----------------------------------------------------------------
    # Include all auto-generated Virtual Hosts from sites-enabled
    # ----------------------------------------------------------------
    include "${normSites}/*.conf";
}
`;
}

/**
 * Builds standard PHP php.ini configuration with absolute forward-slash paths.
 */
export function buildPhpIni(dirs: WorkspaceDirectories): string {
  const normRoot = normalizePath(dirs.root);
  const normLogs = normalizePath(dirs.logs);
  const normTmp = normalizePath(dirs.tmp);

  return `; ====================================================================
; LADOS Portable PHP Configuration
; Automatically generated with absolute forward-slash paths
; ====================================================================

[PHP]
engine = On
short_open_tag = Off
precision = 14
output_buffering = 4096
zlib.output_compression = Off
implicit_flush = Off
unserialize_callback_func =
serialize_precision = -1

; Resource Limits
max_execution_time = 300
max_input_time = 60
memory_limit = 512M

; Error handling and logging
error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT
display_errors = On
display_startup_errors = On
log_errors = On
error_log = "${normLogs}/php_error.log"
log_errors_max_len = 1024
ignore_repeated_errors = Off
ignore_repeated_source = Off

; Data Handling
variables_order = "GPCS"
request_order = "GP"
register_argc_argv = Off
auto_globals_jit = On
post_max_size = 128M

; File Uploads
file_uploads = On
upload_tmp_dir = "${normTmp}"
upload_max_filesize = 128M
max_file_uploads = 20

; Paths and Directories
extension_dir = "${normRoot}/bin/php/ext"
sys_temp_dir = "${normTmp}"
enable_dl = Off
cgi.fix_pathinfo = 1

; Dynamic Extensions
extension=curl
extension=fileinfo
extension=gd
extension=mbstring
extension=mysqli
extension=openssl
extension=pdo_mysql
extension=pdo_sqlite
extension=sqlite3
extension=zip

[Date]
date.timezone = "UTC"

[Session]
session.save_handler = files
session.save_path = "${normTmp}"
session.use_strict_mode = 0
session.use_cookies = 1
session.use_only_cookies = 1
session.name = LADOSESSID
session.auto_start = 0
session.cookie_lifetime = 0
session.cookie_path = /
session.serialize_handler = php
session.gc_probability = 1
session.gc_divisor = 1000
session.gc_maxlifetime = 1440

[opcache]
opcache.enable = 1
opcache.enable_cli = 0
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 8
opcache.max_accelerated_files = 10000
opcache.revalidate_freq = 2
`;
}

/**
 * Builds standard MariaDB my.ini configuration with absolute forward-slash paths.
 */
export function buildMariaDbIni(dirs: WorkspaceDirectories): string {
  const normRoot = normalizePath(dirs.root);
  const normData = normalizePath(dirs.data);
  const normLogs = normalizePath(dirs.logs);
  const normTmp = normalizePath(dirs.tmp);

  return `# ====================================================================
# LADOS Portable MariaDB Configuration
# Automatically generated with absolute forward-slash paths
# ====================================================================

[client]
port = 3306
socket = "${normTmp}/mysql.sock"
default-character-set = utf8mb4

[mysql]
default-character-set = utf8mb4

[mysqld]
port = 3306
bind-address = 127.0.0.1
socket = "${normTmp}/mysql.sock"
pid-file = "${normTmp}/mysqld.pid"

# Paths (Normalized forward-slashes)
basedir = "${normRoot}/bin/mariadb"
datadir = "${normData}"
tmpdir = "${normTmp}"

# Logging
log_error = "${normLogs}/mariadb_error.log"

# Engine & Character Settings
default_storage_engine = InnoDB
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Connection & Performance
max_connections = 100
max_allowed_packet = 64M
thread_cache_size = 8
table_open_cache = 400

# InnoDB Settings
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 2
innodb_file_per_table = 1
`;
}

/**
 * Builds mime.types for Nginx.
 */
export function buildMimeTypes(): string {
  return `types {
    text/html                             html htm shtml;
    text/css                              css;
    text/xml                              xml;
    image/gif                             gif;
    image/jpeg                            jpeg jpg;
    application/javascript                js;
    application/atom+xml                  atom;
    application/rss+xml                   rss;
    text/plain                            txt;
    image/png                             png;
    image/svg+xml                         svg svgz;
    image/webp                            webp;
    image/x-icon                          ico;
    application/json                      json;
    application/pdf                       pdf;
    application/zip                       zip;
    font/woff                             woff;
    font/woff2                            woff2;
    font/ttf                              ttf;
    video/mp4                             mp4;
    video/webm                            webm;
}
`;
}

/**
 * Builds fastcgi_params for Nginx.
 */
export function buildFastCgiParams(): string {
  return `fastcgi_param  QUERY_STRING       $query_string;
fastcgi_param  REQUEST_METHOD     $request_method;
fastcgi_param  CONTENT_TYPE       $content_type;
fastcgi_param  CONTENT_LENGTH     $content_length;

fastcgi_param  SCRIPT_FILENAME    $document_root$fastcgi_script_name;
fastcgi_param  SCRIPT_NAME        $fastcgi_script_name;
fastcgi_param  REQUEST_URI        $request_uri;
fastcgi_param  DOCUMENT_URI       $document_uri;
fastcgi_param  DOCUMENT_ROOT      $document_root;
fastcgi_param  SERVER_PROTOCOL    $server_protocol;
fastcgi_param  REQUEST_SCHEME     $scheme;
fastcgi_param  HTTPS              $https if_not_empty;

fastcgi_param  GATEWAY_INTERFACE  CGI/1.1;
fastcgi_param  SERVER_SOFTWARE    nginx/$nginx_version;

fastcgi_param  REMOTE_ADDR        $remote_addr;
fastcgi_param  REMOTE_PORT        $remote_port;
fastcgi_param  SERVER_ADDR        $server_addr;
fastcgi_param  SERVER_PORT        $server_port;
fastcgi_param  SERVER_NAME        $server_name;

fastcgi_param  REDIRECT_STATUS    200;
`;
}

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
