export type BinaryCategory = "php" | "nginx" | "mariadb" | "composer" | "mkcert";

export interface CatalogItem {
  id: string;
  name: string;
  category: BinaryCategory;
  version: string;
  description: string;
  sizeEstimateBytes?: number;
  downloadUrl: {
    windows: string;
    linux?: string;
  };
  targetSubdir: string;
  isZip: boolean;
  executableName: {
    windows: string;
    linux: string;
  };
}

export interface DownloadProgress {
  itemId: string;
  stage: "idle" | "downloading" | "extracting" | "verifying" | "completed" | "error";
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  message: string;
  error?: string;
}

export interface InstalledBinaryInfo {
  id: string;
  category: BinaryCategory;
  installed: boolean;
  version?: string;
  executablePath?: string;
}

/**
 * Official portable binary catalog for Lados stack.
 */
export const BINARY_CATALOG: CatalogItem[] = [
  {
    id: "php-8.4",
    name: "PHP 8.4 (NTS x64)",
    category: "php",
    version: "8.4.4",
    description: "Latest PHP release with property hooks, asymmetric visibility, and modern JIT.",
    sizeEstimateBytes: 31 * 1024 * 1024,
    downloadUrl: {
      windows: "https://windows.php.net/downloads/releases/php-8.4.4-nts-Win32-vs16-x64.zip",
    },
    targetSubdir: "php/8.4",
    isZip: true,
    executableName: {
      windows: "php-cgi.exe",
      linux: "php-fpm",
    },
  },
  {
    id: "php-8.3",
    name: "PHP 8.3 (NTS x64)",
    category: "php",
    version: "8.3.17",
    description: "Stable modern PHP release with typed class constants and json_validate().",
    sizeEstimateBytes: 30 * 1024 * 1024,
    downloadUrl: {
      windows: "https://windows.php.net/downloads/releases/php-8.3.17-nts-Win32-vs16-x64.zip",
    },
    targetSubdir: "php/8.3",
    isZip: true,
    executableName: {
      windows: "php-cgi.exe",
      linux: "php-fpm",
    },
  },
  {
    id: "php-8.2",
    name: "PHP 8.2 (NTS x64)",
    category: "php",
    version: "8.2.27",
    description: "LTS release with readonly classes and standalone null/false/true types.",
    sizeEstimateBytes: 30 * 1024 * 1024,
    downloadUrl: {
      windows: "https://windows.php.net/downloads/releases/php-8.2.27-nts-Win32-vs16-x64.zip",
    },
    targetSubdir: "php/8.2",
    isZip: true,
    executableName: {
      windows: "php-cgi.exe",
      linux: "php-fpm",
    },
  },
  {
    id: "nginx-1.26",
    name: "Nginx 1.26 (Stable)",
    category: "nginx",
    version: "1.26.3",
    description: "High-performance HTTP server and reverse proxy (Stable branch).",
    sizeEstimateBytes: 2 * 1024 * 1024,
    downloadUrl: {
      windows: "https://nginx.org/download/nginx-1.26.3.zip",
    },
    targetSubdir: "nginx",
    isZip: true,
    executableName: {
      windows: "nginx.exe",
      linux: "nginx",
    },
  },
  {
    id: "nginx-1.27",
    name: "Nginx 1.27 (Mainline)",
    category: "nginx",
    version: "1.27.4",
    description: "Mainline branch featuring HTTP/3 (QUIC) and latest features.",
    sizeEstimateBytes: 2 * 1024 * 1024,
    downloadUrl: {
      windows: "https://nginx.org/download/nginx-1.27.4.zip",
    },
    targetSubdir: "nginx",
    isZip: true,
    executableName: {
      windows: "nginx.exe",
      linux: "nginx",
    },
  },
  {
    id: "mariadb-11.4",
    name: "MariaDB 11.4 (LTS)",
    category: "mariadb",
    version: "11.4.5",
    description: "Long-Term Support relational database server with optimized InnoDB engine.",
    sizeEstimateBytes: 85 * 1024 * 1024,
    downloadUrl: {
      windows: "https://downloads.mariadb.org/rest-api/mariadb/11.4.5/mariadb-11.4.5-winx64.zip",
    },
    targetSubdir: "mariadb",
    isZip: true,
    executableName: {
      windows: "bin/mysqld.exe",
      linux: "bin/mariadbd",
    },
  },
  {
    id: "composer-v2",
    name: "Composer 2.8",
    category: "composer",
    version: "2.8.5",
    description: "Dependency Manager for PHP packages and modern framework ecosystems.",
    sizeEstimateBytes: 3 * 1024 * 1024,
    downloadUrl: {
      windows: "https://getcomposer.org/composer-stable.phar",
      linux: "https://getcomposer.org/composer-stable.phar",
    },
    targetSubdir: "composer",
    isZip: false,
    executableName: {
      windows: "composer.phar",
      linux: "composer.phar",
    },
  },
  {
    id: "mkcert-v1.4",
    name: "mkcert 1.4.4",
    category: "mkcert",
    version: "1.4.4",
    description: "Zero-config tool for generating locally-trusted SSL certificates.",
    sizeEstimateBytes: 4 * 1024 * 1024,
    downloadUrl: {
      windows: "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe",
      linux: "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64",
    },
    targetSubdir: "mkcert",
    isZip: false,
    executableName: {
      windows: "mkcert.exe",
      linux: "mkcert",
    },
  },
];

/**
 * Formats raw bytes into human readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
