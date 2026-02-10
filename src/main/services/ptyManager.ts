import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { WebContents } from 'electron';

const execFileAsync = promisify(execFile);

interface PtyRecord {
  proc: any; // IPty from node-pty
  cwd: string;
  isDirectSpawn: boolean;
  owner: WebContents | null;
}

const ptys = new Map<string, PtyRecord>();

// Lazy-load node-pty to avoid native binding issues at startup
let ptyModule: typeof import('node-pty') | null = null;
function getPty() {
  if (!ptyModule) {
    ptyModule = require('node-pty');
  }
  return ptyModule!;
}

// Cached Claude CLI path
let cachedClaudePath: string | null = null;

async function findClaudePath(): Promise<string | null> {
  if (cachedClaudePath) return cachedClaudePath;
  try {
    const { stdout } = await execFileAsync('which', ['claude']);
    cachedClaudePath = stdout.trim();
    return cachedClaudePath;
  } catch {
    return null;
  }
}

/**
 * Build minimal environment for direct CLI spawn (no shell config overhead).
 */
function buildDirectEnv(): Record<string, string> {
  const env: Record<string, string> = {
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'dash',
    HOME: os.homedir(),
    USER: os.userInfo().username,
    PATH: process.env.PATH || '',
  };

  // Auth passthrough
  const authVars = [
    'ANTHROPIC_API_KEY',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'NO_PROXY',
    'http_proxy',
    'https_proxy',
    'no_proxy',
  ];

  for (const key of authVars) {
    if (process.env[key]) {
      env[key] = process.env[key]!;
    }
  }

  return env;
}

/**
 * Spawn Claude CLI directly (fast path, bypasses shell config).
 */
export async function startDirectPty(options: {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
  autoApprove?: boolean;
  resume?: boolean;
  sender?: WebContents;
}): Promise<void> {
  const pty = getPty();
  const claudePath = await findClaudePath();

  if (!claudePath) {
    throw new Error('Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code');
  }

  const args: string[] = [];
  if (options.resume) {
    args.push('-c', '-r');
  }
  if (options.autoApprove) {
    args.push('--dangerously-skip-permissions');
  }

  const env = buildDirectEnv();

  const proc = pty.spawn(claudePath, args, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env,
  });

  const record: PtyRecord = {
    proc,
    cwd: options.cwd,
    isDirectSpawn: true,
    owner: options.sender || null,
  };

  ptys.set(options.id, record);

  // Forward output to renderer
  proc.onData((data: string) => {
    if (record.owner && !record.owner.isDestroyed()) {
      record.owner.send(`pty:data:${options.id}`, data);
    }
  });

  proc.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    if (record.owner && !record.owner.isDestroyed()) {
      record.owner.send(`pty:exit:${options.id}`, { exitCode, signal });
    }
    ptys.delete(options.id);
  });
}

/**
 * Spawn interactive shell (fallback path).
 */
export async function startPty(options: {
  id: string;
  cwd: string;
  cols: number;
  rows: number;
  sender?: WebContents;
}): Promise<void> {
  const pty = getPty();

  const shell = process.env.SHELL || '/bin/bash';
  const args = ['-il']; // Login + interactive

  // Clean environment for shell
  const env = { ...process.env };
  // Remove Electron packaging artifacts
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ATTACH_CONSOLE;

  const proc = pty.spawn(shell, args, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: env as Record<string, string>,
  });

  const existing = ptys.get(options.id);
  const owner = options.sender || existing?.owner || null;

  const record: PtyRecord = {
    proc,
    cwd: options.cwd,
    isDirectSpawn: false,
    owner,
  };

  ptys.set(options.id, record);

  proc.onData((data: string) => {
    if (record.owner && !record.owner.isDestroyed()) {
      record.owner.send(`pty:data:${options.id}`, data);
    }
  });

  proc.onExit(({ exitCode, signal }: { exitCode: number; signal?: number }) => {
    if (record.owner && !record.owner.isDestroyed()) {
      record.owner.send(`pty:exit:${options.id}`, { exitCode, signal });
    }
    ptys.delete(options.id);
  });
}

/**
 * Send data to a PTY.
 */
export function writePty(id: string, data: string): void {
  const record = ptys.get(id);
  if (record) {
    record.proc.write(data);
  }
}

/**
 * Resize a PTY.
 */
export function resizePty(id: string, cols: number, rows: number): void {
  const record = ptys.get(id);
  if (record) {
    try {
      record.proc.resize(cols, rows);
    } catch {
      // EBADF can happen during transitions
    }
  }
}

/**
 * Kill a specific PTY.
 */
export function killPty(id: string): void {
  const record = ptys.get(id);
  if (record) {
    try {
      record.proc.kill();
    } catch {
      // Already dead
    }
    ptys.delete(id);
  }
}

/**
 * Kill all PTYs (on app quit).
 */
export function killAll(): void {
  for (const [id, record] of ptys) {
    try {
      record.proc.kill();
    } catch {
      // Already dead
    }
  }
  ptys.clear();
}

/**
 * Kill all PTYs owned by a specific WebContents (on window close).
 */
export function killByOwner(owner: WebContents): void {
  for (const [id, record] of ptys) {
    if (record.owner === owner) {
      try {
        record.proc.kill();
      } catch {
        // Already dead
      }
      ptys.delete(id);
    }
  }
}
