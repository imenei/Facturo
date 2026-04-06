const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const desktopDir = path.join(rootDir, 'desktop');
const runtimeDir = path.join(desktopDir, 'runtime');

function ensureExists(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
}

function resetDir(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyDir(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
  });
}

function copyIfExists(source, destination) {
  if (fs.existsSync(source)) {
    copyDir(source, destination);
  }
}

function main() {
  const frontendStandaloneDir = path.join(frontendDir, '.next', 'standalone');
  const frontendStaticDir = path.join(frontendDir, '.next', 'static');
  const backendDistDir = path.join(backendDir, 'dist');
  const backendModulesDir = path.join(backendDir, 'node_modules');

  ensureExists(
    path.join(frontendStandaloneDir, 'server.js'),
    "Build frontend manquant. Lance d'abord: npm run build:frontend",
  );
  ensureExists(
    path.join(backendDistDir, 'main.js'),
    "Build backend manquant. Lance d'abord: npm run build:backend",
  );
  ensureExists(
    backendModulesDir,
    "node_modules backend introuvable. Lance d'abord npm install dans backend",
  );

  resetDir(runtimeDir);

  const runtimeFrontendDir = path.join(runtimeDir, 'frontend');
  const runtimeBackendDir = path.join(runtimeDir, 'backend');

  copyDir(frontendStandaloneDir, runtimeFrontendDir);
  copyDir(frontendStaticDir, path.join(runtimeFrontendDir, '.next', 'static'));
  copyDir(path.join(frontendDir, 'public'), path.join(runtimeFrontendDir, 'public'));

  copyDir(backendDistDir, path.join(runtimeBackendDir, 'dist'));
  copyDir(backendModulesDir, path.join(runtimeBackendDir, 'node_modules'));
  copyIfExists(path.join(backendDir, 'uploads'), path.join(runtimeBackendDir, 'uploads'));

  for (const fileName of ['package.json', '.env', '.env.example']) {
    const source = path.join(backendDir, fileName);
    const destination = path.join(runtimeBackendDir, fileName);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destination);
    }
  }

  fs.mkdirSync(path.join(runtimeBackendDir, 'uploads', 'logos'), { recursive: true });

  console.log('Runtime desktop prepare dans desktop/runtime');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
