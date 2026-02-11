import * as http from 'http';
import { activityMonitor } from './ActivityMonitor';

class HookServerImpl {
  private server: http.Server | null = null;
  private _port: number = 0;

  get port(): number {
    return this._port;
  }

  async start(): Promise<number> {
    if (this.server) return this._port;

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = new URL(req.url || '', `http://127.0.0.1:${this._port}`);
        const ptyId = url.searchParams.get('ptyId');

        if (req.method === 'GET' && ptyId) {
          if (url.pathname === '/hook/stop') {
            console.error(`[HookServer] Stop hook fired for ptyId=${ptyId}`);
            activityMonitor.setIdle(ptyId);
            res.writeHead(200);
            res.end('ok');
            return;
          }
          if (url.pathname === '/hook/busy') {
            console.error(`[HookServer] Busy hook fired for ptyId=${ptyId}`);
            activityMonitor.setBusy(ptyId);
            res.writeHead(200);
            res.end('ok');
            return;
          }
        }

        res.writeHead(404);
        res.end();
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address();
        if (addr && typeof addr === 'object') {
          this._port = addr.port;
          console.error(`[HookServer] Listening on 127.0.0.1:${this._port}`);
          resolve(this._port);
        } else {
          reject(new Error('Failed to get hook server address'));
        }
      });

      this.server.on('error', reject);
    });
  }

  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this._port = 0;
    }
  }
}

export const hookServer = new HookServerImpl();
