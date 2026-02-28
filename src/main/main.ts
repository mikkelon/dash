import { app, BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ── Stderr EPIPE Guard ───────────────────────────────────────
process.stderr.on('error', (err) => {
  if ((err as NodeJS.ErrnoException).code === 'EPIPE') return;
  throw err;
});

// ── PATH Fix ──────────────────────────────────────────────────
function fixPath(): void {
  const currentPath = process.env.PATH || '';
  const additions: string[] = [];

  if (process.platform === 'darwin') {
    const home = os.homedir();
    additions.push(
      path.join(home, '.local/bin'),
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    );
    // Try to get login shell PATH
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { execSync } = require('child_process');
      const shellPath = execSync('zsh -ilc "echo $PATH"', {
        encoding: 'utf-8',
        timeout: 3000,
      }).trim();
      if (shellPath) {
        additions.push(...shellPath.split(':'));
      }
    } catch {
      // Ignore — best effort
    }
  } else if (process.platform === 'win32') {
    // Windows: ensure Git for Windows is in PATH
    additions.push(
      'C:\\Program Files\\Git\\bin',
      'C:\\Program Files\\Git\\cmd',
      'C:\\Program Files (x86)\\Git\\bin',
      'C:\\Program Files (x86)\\Git\\cmd',
    );
  } else if (process.platform === 'linux') {
    const home = os.homedir();
    additions.push(
      path.join(home, '.nvm/versions/node/*/bin'),
      path.join(home, '.npm-global/bin'),
      path.join(home, '.local/bin'),
      '/usr/local/bin',
    );
  }

  const separator = process.platform === 'win32' ? ';' : ':';
  const pathSet = new Set(currentPath.split(separator));
  for (const p of additions) {
    pathSet.add(p);
  }
  process.env.PATH = [...pathSet].join(separator);
}

fixPath();

// ── Single Instance Lock ──────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ── App Ready ─────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function createSplashWindow(initialStatus: string = 'Starting WSL...'): BrowserWindow {
  const splash = new BrowserWindow({
    width: 300,
    height: 150,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: '#1a1a1a',
    show: false,
  });

  // Inline HTML - no external file needed
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #1a1a1a;
          color: #e0e0e0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          -webkit-app-region: drag;
          user-select: none;
        }
        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #333;
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        #status { font-size: 14px; color: #888; }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <div id="status">${initialStatus}</div>
    </body>
    </html>
  `;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

function updateSplashStatus(message: string): void {
  splashWindow?.webContents
    .executeJavaScript(
      `document.getElementById('status').textContent = ${JSON.stringify(message)};`,
    )
    .catch(() => {});
}

app.whenReady().then(async () => {
  // Windows: Initialize WSL session before anything else
  if (process.platform === 'win32') {
    // Show splash screen
    splashWindow = createSplashWindow();

    try {
      const { WslService } = await import('./services/WslService');
      const { WslSessionService } = await import('./services/WslSessionService');

      // Get distro
      updateSplashStatus('Detecting WSL distributions...');
      let distro = WslService.getSelectedDistribution();
      if (!distro) {
        const distros = await WslService.listDistributions();
        const defaultDistro = distros.find((d) => d.isDefault);
        distro = defaultDistro?.name || distros[0]?.name;
      }

      if (!distro) {
        splashWindow?.close();
        dialog.showErrorBox(
          'No WSL Distribution Found',
          'Please install a WSL distribution.\n\nRun "wsl --install -d Ubuntu" in PowerShell.',
        );
        app.quit();
        return;
      }

      // Initialize persistent session
      updateSplashStatus('Starting WSL...');
      await WslSessionService.initialize(distro, 120000); // 2 minute timeout

      // Detect Claude CLI
      updateSplashStatus('Detecting Claude CLI...');
      await detectClaudeCli();

      // Close splash
      splashWindow?.close();
      splashWindow = null;
    } catch (err) {
      splashWindow?.close();
      dialog.showErrorBox(
        'WSL Failed to Start',
        `Could not start WSL within 2 minutes.\n\nPlease ensure WSL is installed and working.\nRun "wsl --status" in PowerShell to diagnose.\n\nError: ${err instanceof Error ? err.message : String(err)}`,
      );
      app.quit();
      return;
    }
  }

  // Initialize database
  const { DatabaseService } = await import('./services/DatabaseService');
  await DatabaseService.initialize();

  // Start hook server (must be ready before any PTY spawns)
  const { hookServer } = await import('./services/HookServer');
  await hookServer.start();

  // Register IPC handlers
  const { registerAllIpc } = await import('./ipc');
  registerAllIpc();

  // Create main window
  const { createWindow } = await import('./window');
  mainWindow = createWindow();

  // Kill PTYs owned by this window on close (CMD+W on macOS)
  mainWindow.on('close', () => {
    import('./services/ptyManager').then(({ killByOwner }) => {
      killByOwner(mainWindow!.webContents);
    });
  });

  // Start activity monitor — must happen after window creation
  const { activityMonitor } = await import('./services/ActivityMonitor');
  activityMonitor.start(mainWindow.webContents);

  // Remote control service needs a sender for state change events
  const { remoteControlService } = await import('./services/remoteControlService');
  remoteControlService.setSender(mainWindow.webContents);

  // Cleanup orphaned reserve worktrees (background, non-blocking)
  setTimeout(async () => {
    try {
      const { worktreePoolService } = await import('./services/WorktreePoolService');
      await worktreePoolService.cleanupOrphanedReserves();
    } catch {
      // Best effort
    }
  }, 2000);

  // Detect Claude CLI (cache for settings UI) - skip on Windows, already done in splash
  if (process.platform !== 'win32') {
    detectClaudeCli();
  }
});

// ── Claude CLI Detection ──────────────────────────────────────
export let claudeCliCache: { installed: boolean; version: string | null; path: string | null } = {
  installed: false,
  version: null,
  path: null,
};

async function detectClaudeCli(): Promise<void> {
  if (process.platform === 'win32') {
    // Windows: detect Claude CLI in WSL
    try {
      const { WslService } = await import('./services/WslService');
      let distro = WslService.getSelectedDistribution();
      if (!distro) {
        const distros = await WslService.listDistributions();
        const defaultDistro = distros.find((d) => d.isDefault);
        distro = defaultDistro?.name || distros[0]?.name;
      }
      if (distro) {
        const result = await WslService.detectClaudeCli(distro);
        claudeCliCache = result;
      } else {
        claudeCliCache = { installed: false, version: null, path: null };
      }
    } catch {
      claudeCliCache = { installed: false, version: null, path: null };
    }
  } else {
    // macOS/Linux: detect Claude CLI directly
    try {
      const { stdout } = await execFileAsync('which', ['claude']);
      const claudePath = stdout.trim();
      const { stdout: versionOut } = await execFileAsync(claudePath, ['--version']);
      claudeCliCache = {
        installed: true,
        version: versionOut.trim(),
        path: claudePath,
      };
    } catch {
      claudeCliCache = { installed: false, version: null, path: null };
    }
  }
}

// ── App Lifecycle ─────────────────────────────────────────────
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const { createWindow } = await import('./window');
    mainWindow = createWindow();
    const { activityMonitor } = await import('./services/ActivityMonitor');
    activityMonitor.start(mainWindow.webContents);
    const { remoteControlService } = await import('./services/remoteControlService');
    remoteControlService.setSender(mainWindow.webContents);
  }
});

app.on('before-quit', async () => {
  // Signal renderer to save all terminal snapshots before we kill PTYs
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('app:beforeQuit');
      }
    }
    // Give renderer a moment to save snapshots
    await new Promise((resolve) => setTimeout(resolve, 200));
  } catch {
    // Best effort
  }

  // Shutdown WSL session (Windows only)
  if (process.platform === 'win32') {
    try {
      const { WslSessionService } = await import('./services/WslSessionService');
      WslSessionService.getInstance().shutdown();
    } catch {
      // Best effort
    }
  }

  // Stop hook server
  try {
    const { hookServer } = await import('./services/HookServer');
    hookServer.stop();
  } catch {
    // Best effort
  }

  // Kill all PTYs (also stops activity monitor)
  try {
    const { killAll } = await import('./services/ptyManager');
    killAll();
  } catch {
    // Best effort
  }

  // Stop all file watchers
  try {
    const { stopAll } = await import('./services/FileWatcherService');
    stopAll();
  } catch {
    // Best effort
  }
});
