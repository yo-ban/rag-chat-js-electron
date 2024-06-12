require('events').EventEmitter.defaultMaxListeners = 30;
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const logger = require('./utils/logger');
const { loadSettings, saveSettings } = require('./settings');
const chatService = require('./services/chatService');
const vectorDBService = require('./services/vectorDBService');
const llmService = require('./services/llmService');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minHeight: 600,
    minWidth: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('build/index.html');
}

app.on('ready', async () => {
  createWindow();

  try {

    const settings = await loadSettings();
    console.log('Initializing services with settings');

    const mainVenderSettings = settings.vendors[settings.vender];
    const embeddingsVenderSettings = settings.useSeparateVenders 
      ? settings.embeddingsVendors[settings.embeddingsVender] 
      : mainVenderSettings;

    await chatService.initialize(settings.chatDataSavePath);

    await vectorDBService.initialize(
      settings.vectorDBSavePath, 
      embeddingsVenderSettings.apiKey,
      settings.useSeparateVenders ? settings.embeddingsVender : settings.vender,
      embeddingsVenderSettings.embeddingsModelName || "",
      embeddingsVenderSettings.baseUrl,
      embeddingsVenderSettings.embeddingsDeploymentName || ""
    );

    llmService.initialize(
      mainVenderSettings.apiKey,
      settings.vender,
      mainVenderSettings.modelName,
      mainVenderSettings.baseUrl,
      mainVenderSettings.deploymentName
    );

  } catch {
    console.error('Error initializing chat service:', error);
 
  }
  
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('load-settings', async () => {
  console.log('Loading settings via IPC');
  try {
    const settings = await loadSettings();
    return settings;

  } catch {
    console.error('Error loading settings:', error);
  }
});

ipcMain.handle('save-settings', async (event, settings) => {

  console.log('Saving settings via IPC');
  const success = await saveSettings(settings);

  if (success) {
    try {
      const updatedSettings = await loadSettings();
      console.log('Re-initializing services with updated settings:', updatedSettings);
      const mainVenderSettings = updatedSettings.vendors[updatedSettings.vender];
      const embeddingsVenderSettings = updatedSettings.useSeparateVenders 
        ? updatedSettings.embeddingsVendors[updatedSettings.embeddingsVender] 
        : mainVenderSettings;
  
      await chatService.initialize(updatedSettings.chatDataSavePath);

      await vectorDBService.initialize(
        updatedSettings.vectorDBSavePath, 
        embeddingsVenderSettings.apiKey,
        updatedSettings.useSeparateVenders ? updatedSettings.embeddingsVender : updatedSettings.vender,
        embeddingsVenderSettings.embeddingsModelName || "",
        embeddingsVenderSettings.baseUrl,
        embeddingsVenderSettings.embeddingsDeploymentName || ""
      );

      llmService.initialize(
        mainVenderSettings.apiKey,
        updatedSettings.vender,
        mainVenderSettings.modelName,
        mainVenderSettings.baseUrl,
        mainVenderSettings.deploymentName
      );

    } catch (error) {
      console.error('Error initializing chat service:', error);
    }

    return true;
  }
  return false;
});

ipcMain.handle('open-local-file', async (event, filePath) => shell.openPath(filePath));

ipcMain.handle('open-link', async (event, url) => shell.openExternal(url));

require('./handlers/chatHandlers');
require('./handlers/dbHandlers');

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});
