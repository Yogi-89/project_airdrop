const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const AccountManager = require('./src/core/account-manager');
const BrowserManager = require('./src/core/browser-manager');
const ProxyManager = require('./src/core/proxy-manager');
const TaskScheduler = require('./src/core/task-scheduler');
const Analytics = require('./src/core/analytics');
const DbManager = require('./src/database/db-manager');

// Inisialisasi komponen utama
let accountManager, browserManager, proxyManager, taskScheduler, analytics, dbManager;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // Buka DevTools hanya dalam development mode
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Inisialisasi semua module
  dbManager = new DbManager();
  proxyManager = new ProxyManager(dbManager);
  accountManager = new AccountManager(dbManager);
  browserManager = new BrowserManager(proxyManager);
  analytics = new Analytics(dbManager);
  taskScheduler = new TaskScheduler(browserManager, accountManager, analytics);
  
  // Setup IPC handlers untuk komunikasi antara main process dan renderer
  setupIpcHandlers();
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

function setupIpcHandlers() {
  // Handler untuk project submission dari UI
  ipcMain.handle('submit-project', async (event, projectData) => {
    try {
      const { url, accounts, referralCode } = projectData;
      const taskId = await taskScheduler.scheduleTask(url, accounts, referralCode);
      return { success: true, taskId };
    } catch (error) {
      console.error('Error submitting project:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler untuk mendapatkan status dari semua akun
  ipcMain.handle('get-accounts-status', async () => {
    try {
      const accounts = await accountManager.getAllAccounts();
      return { success: true, accounts };
    } catch (error) {
      console.error('Error getting accounts status:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler untuk mendapatkan points dari akun
  ipcMain.handle('get-project-points', async (event, projectUrl) => {
    try {
      const points = await analytics.getPointsByProject(projectUrl);
      return { success: true, points };
    } catch (error) {
      console.error('Error getting project points:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler untuk menambahkan atau mengedit akun
  ipcMain.handle('manage-account', async (event, accountData) => {
    try {
      const result = await accountManager.saveAccount(accountData);
      return { success: true, result };
    } catch (error) {
      console.error('Error managing account:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler untuk menambahkan proxy
  ipcMain.handle('add-proxy', async (event, proxyData) => {
    try {
      await proxyManager.addProxy(proxyData);
      return { success: true };
    } catch (error) {
      console.error('Error adding proxy:', error);
      return { success: false, error: error.message };
    }
  });
}