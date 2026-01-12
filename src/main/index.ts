/**
 * Main Process
 * Electron main entry point
 */

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initializeDatabase, registerIpcHandlers } from './ipc/handlers';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3
    },
    backgroundColor: '#0A0A0B', // "Void" theme background
    show: false, // Don't show until ready
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
  // Initialize database
  const db = initializeDatabase('default');

  // Run integrity check
  const isValid = db.checkIntegrity();
  if (!isValid) {
    console.error('Database integrity check failed!');
    // In production, should show error dialog and potentially restore from backup
  }

  // Register IPC handlers
  registerIpcHandlers();

  // Create main window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Database will auto-backup on close
  console.log('Application shutting down...');
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // In production, should log to file and show error dialog
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // In production, should log to file
});
