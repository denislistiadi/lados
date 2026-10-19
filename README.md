# LADOS

Portable Local Web Development Environment for Windows.

A lightweight desktop application built with Tauri v2, Vue 3, and TypeScript. Designed as a clean, portable alternative to Laragon and XAMPP.

## Features

- Master Control: Single toggle button to start and stop Nginx, PHP FastCGI, and MariaDB.
- Automatic Virtual Hosts: Drop any folder into www/ to automatically detect frameworks (Laravel, WordPress, or Native PHP) and provision *.test domains.
- Local SSL: Built-in mkcert integration for trusted local HTTPS certificates.
- PHP Version Switcher: Switch between PHP 8.4, 8.3, and 8.2 on the fly.
- Portable and Isolated: Binaries, configs, logs, and data directories stay self-contained inside the app folder without polluting system PATH.
- Real-time Logs: Integrated log viewer for monitoring stdout and stderr from running services.

## Tech Stack

- Desktop: Tauri v2 (Rust)
- Frontend: Vue 3, Pinia, TypeScript
- Styling: Tailwind CSS
- Bundler: Vite

## Getting Started

### Prerequisites

- Node.js (v18 or newer)
- Rust and Cargo
- Windows 10 or 11 (64-bit)

### Development

```bash
# Clone the repository
git clone git@github.com:denislistiadi/lados.git
cd lados

# Install dependencies
npm install

# Run development mode
npm run tauri dev
```

### Production Build

```bash
npm run tauri build
```

The installer will be generated in `src-tauri/target/release/bundle/nsis/`.

## Directory Structure

```text
lados/
├── bin/          # Portable binaries (Nginx, PHP, MariaDB, Composer, mkcert)
├── etc/          # Service configurations (nginx, php, mariadb, sites-enabled)
├── www/          # Local web projects (*.test)
├── logs/         # Service log files
├── data/         # MariaDB database data
├── tmp/          # Temporary runtime files and PIDs
└── state.json    # Local state and preferences
```

## License

MIT License.
