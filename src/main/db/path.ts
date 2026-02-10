import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');

  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  return path.join(userDataPath, 'app.db');
}
