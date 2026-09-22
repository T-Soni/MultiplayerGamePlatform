const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { EmbeddedRedisServer } = require('./scripts/embedded-redis');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function checkPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const colors = [
  '\x1b[35m', // magenta (auth)
  '\x1b[36m', // cyan (registry)
  '\x1b[33m', // yellow (matchmaking)
  '\x1b[32m', // green (game engine)
  '\x1b[34m', // blue (analytics)
  '\x1b[31m', // red (gateway)
  '\x1b[37m'  // white (frontend)
];
const resetColor = '\x1b[0m';

function runService(name, dir, command, args, color) {
  const child = spawn(command, args, {
    cwd: path.join(__dirname, dir),
    env: { ...process.env, FORCE_COLOR: '1' },
    shell: true
  });

  children.push(child);

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.log(`${color}[${name}]${resetColor} ${line}`);
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        console.error(`${color}[${name}:ERR]${resetColor} ${line}`);
      }
    }
  });

  child.on('close', (code) => {
    console.log(`${color}[${name}] exited with code ${code}${resetColor}`);
  });

  return child;
}

async function main() {
  console.log('====================================================');
  console.log('🚀 Starting NexToe Microservices Multiplayer Platform');
  console.log('====================================================\n');

  // Step 1: Ensure Redis is available or start embedded RESP server
  const redisActive = await checkPortInUse(6379, '127.0.0.1');
  if (redisActive) {
    console.log('✅ Standalone Redis server detected on port 6379.\n');
  } else {
    console.log('ℹ️  No Redis server detected on port 6379.');
    console.log('⚡ Launching Embedded In-Memory Redis Server (RESP protocol)...');
    try {
      const embeddedRedis = new EmbeddedRedisServer(6379, '127.0.0.1');
      await embeddedRedis.start();
      console.log('✅ Embedded Redis ready on 127.0.0.1:6379\n');
    } catch (err) {
      console.warn('⚠️  Could not bind embedded Redis:', err.message);
    }
  }

  // Step 2: Start microservices sequentially with small delays to establish connections cleanly
  console.log('Starting Backend Microservices...');

  runService('AUTH-5001', 'services/auth-service', 'node', ['server.js'], colors[0]);
  await new Promise(r => setTimeout(r, 600));

  runService('REGISTRY-5002', 'services/registry-service', 'node', ['server.js'], colors[1]);
  await new Promise(r => setTimeout(r, 600));

  runService('MATCH-5003', 'services/matchmaking-service', 'node', ['server.js'], colors[2]);
  await new Promise(r => setTimeout(r, 600));

  runService('GAME-5004', 'services/game-engine', 'node', ['server.js'], colors[3]);
  await new Promise(r => setTimeout(r, 600));

  runService('ANALYTICS-5005', 'services/analytics-service', 'node', ['server.js'], colors[4]);
  await new Promise(r => setTimeout(r, 800));

  runService('GATEWAY-5000', 'services/api-gateway', 'node', ['server.js'], colors[5]);
  await new Promise(r => setTimeout(r, 800));

  console.log('\nStarting React Frontend (Vite)...');
  runService('FRONTEND-5173', 'frontend', npmCmd, ['run', 'dev'], colors[6]);

  console.log('\n====================================================');
  console.log('  All Microservices & Frontend are now running!     ');
  console.log('  🌐 Frontend UI:  http://localhost:5173           ');
  console.log('  🚪 API Gateway:  http://localhost:5000           ');
  console.log('  Press Ctrl+C to terminate all services safely.   ');
  console.log('====================================================\n');
}

function cleanup() {
  console.log('\nStopping all services...');
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

main().catch(err => {
  console.error('Failed to start dev environment:', err);
  cleanup();
});
