import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function checkBackendReady() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3001/api/health', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

const childProcesses = [];

function cleanup() {
  for (const proc of childProcesses) {
    if (!proc.killed) {
      if (isWin) {
        try {
          spawn('taskkill', ['/pid', proc.pid.toString(), '/T', '/F'], { stdio: 'ignore' });
        } catch (_) {}
      } else {
        proc.kill('SIGINT');
      }
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

async function main() {
  console.log('\n🚀 Starting PhoneMail Development Environment...\n');

  const backendAlreadyRunning = await checkBackendReady();

  if (backendAlreadyRunning) {
    console.log('✅ Backend API is already running at http://localhost:3001 (SMTP on :2525)');
  } else {
    console.log('📦 Starting Backend API (http://localhost:3001)...');
    const backendProc = spawn(npmCmd, ['run', 'dev'], {
      cwd: path.join(rootDir, 'backend'),
      shell: isWin,
      stdio: 'inherit',
    });
    childProcesses.push(backendProc);
  }

  console.log('⚡ Starting Frontend Vite Server (http://localhost:5173)...');
  const frontendProc = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(rootDir, 'frontend'),
    shell: isWin,
    stdio: 'inherit',
  });
  childProcesses.push(frontendProc);

  frontendProc.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Frontend process exited with code ${code}`);
    }
    cleanup();
    process.exit(code || 0);
  });
}

main().catch((err) => {
  console.error('Failed to start development servers:', err);
  cleanup();
  process.exit(1);
});
