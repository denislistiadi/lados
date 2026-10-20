import { type WorkspaceDirectories, normalizePath } from "../workspace";

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
