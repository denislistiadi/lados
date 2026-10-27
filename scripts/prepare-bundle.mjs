import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin");
const TMP_CACHE = path.join(ROOT, "tmp", "bundle_cache");

const BUNDLE_ITEMS = [
  {
    name: "Nginx 1.26.3 (Stable)",
    url: "https://nginx.org/download/nginx-1.26.3.zip",
    targetDir: path.join(BIN, "nginx"),
    checkFile: path.join(BIN, "nginx", "nginx.exe"),
    isZip: true,
  },
  {
    name: "PHP 8.3.17 (NTS x64)",
    url: "https://downloads.php.net/~windows/releases/archives/php-8.3.17-nts-Win32-vs16-x64.zip",
    targetDir: path.join(BIN, "php", "8.3"),
    checkFile: path.join(BIN, "php", "8.3", "php-cgi.exe"),
    isZip: true,
    postAction: () => {
      const activeLink = path.join(BIN, "php", "active");
      const targetDir = path.join(BIN, "php", "8.3");
      try {
        if (process.platform === "win32") {
          execSync(`rmdir "${activeLink}" 2>nul & mklink /J "${activeLink}" "${targetDir}"`, { stdio: "ignore" });
        }
      } catch (err) {
        console.warn("Junction creation notice:", err.message);
      }
    },
  },
  {
    name: "MariaDB 11.4.5 (LTS)",
    url: "https://downloads.mariadb.org/rest-api/mariadb/11.4.5/mariadb-11.4.5-winx64.zip",
    targetDir: path.join(BIN, "mariadb"),
    checkFile: path.join(BIN, "mariadb", "bin", "mysqld.exe"),
    isZip: true,
    postAction: () => {
      const dbDataDir = path.join(BIN, "mariadb", "data");
      const installDbExe = path.join(BIN, "mariadb", "bin", "mariadb-install-db.exe");
      if (!fs.existsSync(path.join(dbDataDir, "mysql")) && fs.existsSync(installDbExe)) {
        console.log("  Initializing MariaDB default system database template...");
        try {
          execSync(`"${installDbExe}" --datadir="${dbDataDir}"`, { stdio: "inherit" });
        } catch (err) {
          console.warn("  Notice: MariaDB install-db skipped:", err.message);
        }
      }
    },
  },
  {
    name: "Composer 2.8.5",
    url: "https://getcomposer.org/composer-stable.phar",
    targetDir: path.join(BIN, "composer"),
    checkFile: path.join(BIN, "composer", "composer.phar"),
    isZip: false,
    saveAs: "composer.phar",
    postAction: () => {
      const batPath = path.join(BIN, "composer", "composer.bat");
      fs.writeFileSync(batPath, '@php "%~dp0composer.phar" %*\r\n');
    },
  },
  {
    name: "mkcert 1.4.4",
    url: "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe",
    targetDir: path.join(BIN, "mkcert"),
    checkFile: path.join(BIN, "mkcert", "mkcert.exe"),
    isZip: false,
    saveAs: "mkcert.exe",
  },
];

async function downloadFile(url, destPath) {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }
  const fileStream = fs.createWriteStream(destPath);
  const reader = response.body.getReader();
  let downloadedBytes = 0;
  const totalBytes = Number(response.headers.get("content-length") || 0);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
    downloadedBytes += value.length;
    if (totalBytes > 0 && downloadedBytes % (5 * 1024 * 1024) < value.length) {
      const pct = Math.round((downloadedBytes / totalBytes) * 100);
      process.stdout.write(`\r  Progress: ${pct}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
    }
  }

  await new Promise((resolve, reject) => {
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
    fileStream.end();
  });

  if (totalBytes > 0 && downloadedBytes !== totalBytes) {
    throw new Error(`Incomplete download: received ${downloadedBytes} of ${totalBytes} bytes`);
  }

  console.log("\n  Download complete.");
}

function extractZip(zipPath, destDir) {
  console.log(`  Extracting ${path.basename(zipPath)} to ${destDir}...`);
  fs.mkdirSync(destDir, { recursive: true });

  const tempExtractDir = path.join(TMP_CACHE, `ext_${Date.now()}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  try {
    execSync(`tar -xf "${zipPath}" -C "${tempExtractDir}"`, { stdio: "inherit" });
  } catch (err) {
    console.log("  tar extraction error, falling back to powershell Expand-Archive...");
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force"`, { stdio: "inherit" });
  }

  // Check if extracted files are nested inside a single folder (e.g. nginx-1.26.3/ or mariadb-11.4.5-winx64/)
  const entries = fs.readdirSync(tempExtractDir);
  if (entries.length === 1 && fs.statSync(path.join(tempExtractDir, entries[0])).isDirectory()) {
    const nestedDir = path.join(tempExtractDir, entries[0]);
    const nestedFiles = fs.readdirSync(nestedDir);
    for (const file of nestedFiles) {
      const src = path.join(nestedDir, file);
      const dest = path.join(destDir, file);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      fs.renameSync(src, dest);
    }
  } else {
    for (const file of entries) {
      const src = path.join(tempExtractDir, file);
      const dest = path.join(destDir, file);
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true });
      }
      fs.renameSync(src, dest);
    }
  }

  // Clean up temporary extract folder
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
}

async function main() {
  console.log("====================================================================");
  console.log("  LADOS - Minimal Bundle Setup (Option A: Full Stack)");
  console.log("====================================================================");

  fs.mkdirSync(TMP_CACHE, { recursive: true });
  fs.mkdirSync(BIN, { recursive: true });

  for (const item of BUNDLE_ITEMS) {
    console.log(`\nChecking [${item.name}]...`);
    if (fs.existsSync(item.checkFile)) {
      console.log(`  [OK] Already installed at ${item.checkFile}`);
      if (item.postAction) item.postAction();
      continue;
    }

    fs.mkdirSync(item.targetDir, { recursive: true });
    const fileName = path.basename(item.url);
    const cachedFile = path.join(TMP_CACHE, fileName);

    if (!fs.existsSync(cachedFile)) {
      await downloadFile(item.url, cachedFile);
    } else {
      console.log(`  [Cached] Using cached archive ${fileName}`);
    }

    if (item.isZip) {
      extractZip(cachedFile, item.targetDir);
    } else {
      const destFile = path.join(item.targetDir, item.saveAs || fileName);
      fs.copyFileSync(cachedFile, destFile);
      console.log(`  Copied to ${destFile}`);
    }

    if (item.postAction) {
      item.postAction();
    }
    console.log(`  [SUCCESS] ${item.name} ready!`);
  }

  // Ensure default www/index.php is created
  const wwwDir = path.join(ROOT, "www");
  fs.mkdirSync(wwwDir, { recursive: true });
  const indexPhpPath = path.join(wwwDir, "index.php");
  if (!fs.existsSync(indexPhpPath)) {
    fs.writeFileSync(
      indexPhpPath,
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lados Local Stack Ready</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #090d16; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(99, 102, 241, 0.2); padding: 2.5rem; border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; max-width: 500px; }
    .badge { display: inline-block; padding: 4px 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-weight: 700; font-size: 11px; border-radius: 999px; text-transform: uppercase; margin-bottom: 12px; }
    h1 { color: #fff; margin: 0 0 8px; font-size: 24px; }
    p { color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 16px; }
    .info { background: #020617; border-radius: 12px; padding: 12px; font-family: monospace; font-size: 12px; text-align: left; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Stack Online</div>
    <h1>LADOS Portable Server</h1>
    <p>Everything is running locally without any external dependencies.</p>
    <div class="info">
      <div>PHP Version: <?php echo phpversion(); ?></div>
      <div>Server: <?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'Nginx'; ?></div>
      <div>Document Root: <?php echo __DIR__; ?></div>
    </div>
  </div>
</body>
</html>\r\n`
    );
  }

  // Ensure src-tauri/bin junction exists so Tauri bundles into bin/ directly without _up_/
  const srcTauriBin = path.join(ROOT, "src-tauri", "bin");
  if (!fs.existsSync(srcTauriBin) && process.platform === "win32") {
    try {
      execSync(`mklink /J "${srcTauriBin}" "${BIN}"`, { stdio: "ignore" });
    } catch (e) {
      console.warn("Notice: src-tauri/bin link:", e.message);
    }
  }

  console.log("\n====================================================================");
  console.log("  Bundle Setup Complete!");
  console.log("  All binaries are placed in bin/ and ready to be bundled by Tauri.");
  console.log("====================================================================");
}

main().catch((err) => {
  console.error("\n[Error] Bundle preparation failed:", err);
  process.exit(1);
});
