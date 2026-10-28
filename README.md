# Lados

Portable Local Web Server Stack for Windows.

A lightweight, self-contained local development environment built with Tauri v2, Vue 3, and TypeScript. Designed as a clean alternative to Laragon and XAMPP that runs out of the box without polluting the Windows system PATH.

[![Version](https://img.shields.io/badge/version-v0.0.1-blue.svg)](package.json)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6.svg?logo=windows)](https://microsoft.com)
[![Framework](https://img.shields.io/badge/framework-Tauri%20v2-FFC131.svg?logo=tauri)](https://v2.tauri.app)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Features

- **Master Process Control**: Start or stop Nginx, PHP FastCGI, and MariaDB simultaneously with a single toggle, or control each service individually.
- **Automatic Virtual Hosts**: Projects placed in `www/` are automatically resolved to `*.test` domains with framework detection (Laravel, WordPress, native PHP, and static HTML).
- **PHP Version Switcher**: Switch active PHP versions (8.4, 8.3, 8.2) on the fly with automatic `php.ini` extension rewriting and FastCGI reloading.
- **Custom PHP Installation**: Install custom PHP builds directly from `.zip` archives (e.g. from windows.php.net) or by extracting folders into `bin/php/`.
- **Local SSL (HTTPS)**: Built-in `mkcert` integration to generate trusted local SSL certificates without browser security warnings.
- **Isolated Development Terminal**: Dedicated shell that prioritizes Lados binaries (PHP, Composer, MySQL, Nginx) in `PATH` without modifying global environment variables.
- **Offline Minimal Bundle**: The installer includes PHP 8.3, Nginx, MariaDB, Composer, and mkcert, allowing immediate use after installation without external downloads.
- **Real-Time Logs**: Live console monitoring stdout and stderr from all running services.

---

## Stack Components

| Component | Default Version | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Nginx** | 1.26.3 (Stable) | `80` (HTTP), `443` (SSL) | HTTP server and reverse proxy |
| **PHP** | 8.3.17 (NTS x64) | `9000` (FastCGI) | FastCGI runtime with core extensions enabled |
| **MariaDB** | 11.4.5 (LTS) | `3306` (MySQL protocol) | Relational SQL database server |
| **Composer** | 2.8.5 | CLI | PHP dependency manager |
| **mkcert** | 1.4.4 | CLI | Zero-config local certificate authority tool |

---

## User Guide

### 1. Starting and Stopping Services

1. Launch **Lados**.
2. Click the center power button:
   - **Green (Running)**: Nginx, PHP FastCGI, and MariaDB are active.
   - **Slate/Red (Stopped)**: All services are terminated cleanly.
3. Individual services can also be started or stopped via the power buttons inside the **Running Details** card.

### 2. Adding Web Projects

#### Method A: Using the In-App Creator
1. Click **+ New Project** in the bottom dock.
2. Enter the project name (e.g. `shop`).
3. Select the template (Laravel, WordPress, Native PHP, or Static HTML).
4. Click **Create Project**. The folder is created at `www/shop` and mapped to `http://shop.test`.

#### Method B: Direct Folder Placement
1. Navigate to the `www/` folder inside the Lados directory.
2. Copy or clone your project into `www/` (e.g. `www/my-api`).
3. Lados automatically detects the directory and configures `http://my-api.test`.

### 3. Database Access (MariaDB / MySQL)

MariaDB runs on standard MySQL port `3306`. Connect using any database client (TablePlus, HeidiSQL, DBeaver, VS Code extensions) with the following parameters:

- **Host**: `127.0.0.1` or `localhost`
- **Port**: `3306`
- **Username**: `root`
- **Password**: *(empty by default)*

Example Laravel `.env` configuration:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_database_name
DB_USERNAME=root
DB_PASSWORD=
```

### 4. Switching PHP Versions

1. Click the PHP version badge in the top header (e.g. `v8.3`) or open **Settings** > **PHP**.
2. Select the desired runtime (e.g. `8.4`).
3. Lados will:
   - Update the active binary path.
   - Re-generate `etc/php/php.ini` with the corresponding `extension_dir`.
   - Restart the FastCGI process on port `9000` without downtime on Nginx.

### 5. Installing Custom PHP Versions

To install a custom PHP version (e.g. PHP 7.4, 8.0, 8.1, or custom builds from [windows.php.net/downloads/releases/archives/](https://windows.php.net/downloads/releases/archives/)):

#### Option A: From a Local ZIP File
1. Open **Settings** > **PHP**.
2. Under **Install Custom PHP from ZIP**:
   - Click the file picker and select your downloaded `.zip` file.
   - The version label is auto-detected from the filename (e.g. `8.1.31`), which you can edit.
   - Click **Extract & Install**.
3. Lados extracts the archive into `bin/php/<version>/` and adds it to the installed list.

#### Option B: Manual Folder Extraction
1. In **Settings** > **PHP**, click **Open bin/php**.
2. Extract your PHP folder directly into `bin/php/` (e.g. `bin/php/custom-8.1/`).
3. Click **Scan Folder**. Lados detects any directory containing `php-cgi.exe` or `php.exe`.
4. Click **Use** on the detected version to activate it.

### 6. Using the Isolated Terminal

Lados includes a terminal launcher that prepends all local binaries to the Windows session `PATH`:
1. Click **Terminal** in the bottom dock or Package Hub.
2. An isolated command prompt opens with the active environment:
   ```cmd
   php -v
   composer --version
   mysql -u root
   ```
3. System-wide variables remain untouched, preventing version conflicts with other installed tools.

### 7. Enabling Local SSL (HTTPS)

1. Click **SSL / Hosts** in the bottom dock.
2. Click **Install Local CA** (one-time operation). Confirm the Windows security prompt.
3. Once the Root CA is registered, all `*.test` domains automatically resolve over trusted HTTPS (`https://project.test`).

### 8. Monitoring Logs

1. Click **Console Log** in the bottom panel.
2. Filter logs by service:
   - **Nginx**: Access logs and HTTP request routing.
   - **PHP**: FastCGI execution logs, warnings, and error output.
   - **MariaDB**: Server startup, connection, and SQL errors.
3. Use the **Clear** button to reset the view.

---

## Directory Structure

```text
lados/
├── bin/                   # Portable binaries
│   ├── nginx/             # Nginx executable and base configuration
│   ├── php/               # Installed PHP versions (8.3/, 8.4/, custom/)
│   │   └── active/        # Junction link to active PHP version
│   ├── mariadb/           # MariaDB server and client tools (bin/mysqld.exe)
│   ├── composer/          # composer.phar and composer.bat wrapper
│   └── mkcert/            # mkcert binary for local SSL
├── etc/                   # Active configurations
│   ├── nginx/             # nginx.conf, fastcgi_params, mime.types
│   │   ├── sites-enabled/ # Auto-generated virtual host configs (*.test)
│   │   └── ssl/           # Local SSL certificates and keys
│   ├── php/               # Active php.ini
│   └── mariadb/           # Active my.ini
├── www/                   # Web project document roots (*.test)
├── logs/                  # Service log files
├── data/                  # MariaDB database data directory
├── tmp/                   # Session files, socket paths, and process PIDs
└── state.json             # Runtime state and user preferences
```

---

## Developer Guide

### Prerequisites
- Node.js (version 20 or newer)
- Rust and Cargo (latest stable toolchain)
- Windows 10 or 11 (64-bit)

### Development Setup
```bash
# 1. Clone repository
git clone git@github.com:denislistiadi/lados.git
cd lados

# 2. Install dependencies
npm install

# 3. Start development server with hot reload
npm run tauri dev
```

### Preparing Bundle Binaries
To populate the `bin/` directory with official upstream binaries before packaging:
```bash
npm run prepare:bundle
```
This script downloads official archives for Nginx, PHP 8.3, MariaDB, Composer, and mkcert, caches them in `tmp/bundle_cache/`, and unpacks them into `bin/`. Subsequent runs check existing files and skip downloads.

### Building Production Installer
```bash
npm run tauri build
```
The output installer is generated at:
```text
src-tauri/target/release/bundle/nsis/Lados_0.0.1_x64-setup.exe
```

### Automated CI/CD Release

The repository includes a GitHub Actions workflow in `.github/workflows/release.yml`.

When you publish a new release in GitHub Releases:
1. GitHub Actions spins up a clean `windows-latest` runner.
2. Dependencies are restored and `npm run prepare:bundle` executes (leveraging GitHub Actions caching).
3. Tauri builds the standalone setup installer (`.exe`).
4. The installer executable is uploaded directly to the GitHub Release.

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
