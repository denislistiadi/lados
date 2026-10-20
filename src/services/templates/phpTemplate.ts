import { type WorkspaceDirectories, normalizePath } from "../workspace";

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
