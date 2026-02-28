import { spawn, ChildProcess } from 'child_process';
import { dialog, app } from 'electron';

/**
 * Singleton service that manages a persistent WSL bash session.
 * This keeps WSL warm to avoid cold-start timeouts when detecting Claude CLI.
 *
 * Windows-only service. On macOS/Linux, this service is not used.
 */
export class WslSessionService {
  private static instance: WslSessionService | null = null;
  private process: ChildProcess | null = null;
  private distro: string = '';
  private ready: boolean = false;
  private pendingCommands: Map<
    string,
    {
      resolve: (result: { stdout: string; stderr: string; exitCode: number }) => void;
      reject: (error: Error) => void;
      stdout: string;
      stderr: string;
    }
  > = new Map();
  private outputBuffer: string = '';

  private constructor() {}

  static getInstance(): WslSessionService {
    if (!WslSessionService.instance) {
      WslSessionService.instance = new WslSessionService();
    }
    return WslSessionService.instance;
  }

  /**
   * Initialize the persistent WSL session.
   * @param distro - WSL distribution name
   * @param timeoutMs - Timeout in milliseconds (default 120000 = 2 minutes)
   * @throws Error if session fails to start within timeout
   */
  static async initialize(distro: string, timeoutMs: number = 120000): Promise<void> {
    const instance = WslSessionService.getInstance();
    await instance.start(distro, timeoutMs);
  }

  private async start(distro: string, timeoutMs: number): Promise<void> {
    this.distro = distro;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup();
        reject(new Error(`WSL session failed to start within ${timeoutMs / 1000} seconds`));
      }, timeoutMs);

      // Spawn wsl.exe with bash login shell via stdio
      this.process = spawn('wsl.exe', ['-d', distro, '--', 'bash', '-l'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        this.outputBuffer += text;

        // Check for ready signal
        if (!this.ready && this.outputBuffer.includes('__READY__')) {
          this.ready = true;
          clearTimeout(timeout);
          resolve();
        }

        // Process command responses
        this.processOutput();
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Route stderr to pending commands
        for (const [, cmd] of this.pendingCommands) {
          cmd.stderr += text;
        }
      });

      this.process.on('error', (err) => {
        clearTimeout(timeout);
        this.cleanup();
        reject(err);
      });

      this.process.on('close', (code) => {
        if (this.ready) {
          // Session died unexpectedly during use
          dialog.showErrorBox(
            'WSL Session Terminated',
            `The WSL session terminated unexpectedly (code: ${code}).\n\nPlease restart the application.`,
          );
          app.quit();
        } else {
          clearTimeout(timeout);
          reject(new Error(`WSL process exited with code ${code}`));
        }
      });

      // Send ready signal
      this.process.stdin?.write('echo __READY__\n');
    });
  }

  private processOutput(): void {
    // Look for command markers: __START_{id}__ ... __END_{id}_{exitCode}__
    for (const [id, cmd] of this.pendingCommands) {
      const startMarker = `__START_${id}__`;
      const endRegex = new RegExp(`__END_${id}_(\\d+)__`);

      const startIdx = this.outputBuffer.indexOf(startMarker);
      if (startIdx === -1) continue;

      const match = this.outputBuffer.match(endRegex);
      if (!match) continue;

      const endIdx = this.outputBuffer.indexOf(match[0]);
      if (endIdx === -1) continue;

      // Extract output between markers
      const output = this.outputBuffer.slice(startIdx + startMarker.length + 1, endIdx).trim();
      const exitCode = parseInt(match[1], 10);

      // Remove processed portion from buffer
      this.outputBuffer = this.outputBuffer.slice(endIdx + match[0].length);

      // Resolve the command
      cmd.stdout = output;
      cmd.resolve({ stdout: cmd.stdout, stderr: cmd.stderr, exitCode });
      this.pendingCommands.delete(id);
    }
  }

  /**
   * Execute a command in the persistent WSL session.
   */
  async exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.ready || !this.process) {
      throw new Error('WSL session not ready');
    }

    const id = Math.random().toString(36).substring(2, 10);

    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject, stdout: '', stderr: '' });

      // Wrap command with markers
      const wrappedCommand = `echo __START_${id}__; ${command}; echo __END_${id}_$?__\n`;
      this.process?.stdin?.write(wrappedCommand);
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  shutdown(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }
    this.ready = false;
    this.pendingCommands.clear();
    this.outputBuffer = '';
  }
}
