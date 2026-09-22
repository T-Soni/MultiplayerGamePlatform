const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const packages = [
  'services/auth-service',
  'services/registry-service',
  'services/matchmaking-service',
  'services/game-engine',
  'services/analytics-service',
  'services/api-gateway',
  'frontend'
];

console.log('====================================================');
console.log('  Installing Dependencies for All Microservices     ');
console.log('====================================================\n');

for (const pkg of packages) {
  const pkgDir = path.join(rootDir, pkg);
  if (fs.existsSync(pkgDir)) {
    console.log(`\n📦 Installing dependencies for: ${pkg}`);
    try {
      execSync(`${npmCmd} install`, {
        cwd: pkgDir,
        stdio: 'inherit'
      });
      console.log(`✅ Finished: ${pkg}`);
    } catch (err) {
      console.error(`❌ Failed to install ${pkg}:`, err.message);
      process.exit(1);
    }
  }
}

console.log('\n🎉 All microservices dependencies installed successfully!\n');
