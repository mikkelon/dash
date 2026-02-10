import { ipcMain } from 'electron';
import {
  startDirectPty,
  startPty,
  writePty,
  resizePty,
  killPty,
  killByOwner,
} from '../services/ptyManager';
import { terminalSnapshotService } from '../services/TerminalSnapshotService';

export function registerPtyIpc(): void {
  ipcMain.handle(
    'pty:startDirect',
    async (
      event,
      args: {
        id: string;
        cwd: string;
        cols: number;
        rows: number;
        autoApprove?: boolean;
        resume?: boolean;
      },
    ) => {
      try {
        await startDirectPty({
          ...args,
          sender: event.sender,
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );

  ipcMain.handle(
    'pty:start',
    async (event, args: { id: string; cwd: string; cols: number; rows: number }) => {
      try {
        await startPty({
          ...args,
          sender: event.sender,
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );

  // Fire-and-forget channels (ipcMain.on instead of handle)
  ipcMain.on('pty:input', (_event, args: { id: string; data: string }) => {
    writePty(args.id, args.data);
  });

  ipcMain.on('pty:resize', (_event, args: { id: string; cols: number; rows: number }) => {
    resizePty(args.id, args.cols, args.rows);
  });

  ipcMain.on('pty:kill', (_event, id: string) => {
    killPty(id);
  });

  // Snapshot handlers
  ipcMain.handle('pty:snapshot:get', async (_event, id: string) => {
    try {
      const data = await terminalSnapshotService.getSnapshot(id);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('pty:snapshot:save', async (_event, id: string, payload: unknown) => {
    try {
      await terminalSnapshotService.saveSnapshot(id, payload as any);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('pty:snapshot:clear', async (_event, id: string) => {
    try {
      await terminalSnapshotService.deleteSnapshot(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
