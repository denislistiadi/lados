import { type WorkspaceDirectories, normalizePath } from "../workspace";

/**
 * Builds standard MariaDB my.ini configuration with absolute forward-slash paths.
 */
export function buildMariaDbIni(dirs: WorkspaceDirectories): string {
  const normBinMariadb = normalizePath(dirs.binMariadb);
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
basedir = "${normBinMariadb}"
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
