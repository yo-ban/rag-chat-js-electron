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
    minWidth: 800,
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
  const settings = loadSettings();
  console.log('Initializing services with settings');

  chatService.initialize(settings.chatDataSavePath);

  const mainVenderSettings = settings.vendors[settings.vender];
  const embeddingsVenderSettings = settings.useSeparateVenders 
    ? settings.embeddingsVendors[settings.embeddingsVender] 
    : mainVenderSettings;

  vectorDBService.initialize(
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
  return loadSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  console.log('Saving settings via IPC');
  if (saveSettings(settings)) {
    const updatedSettings = loadSettings();
    console.log('Re-initializing services with updated settings:', updatedSettings);

    chatService.initialize(updatedSettings.chatDataSavePath);

    const mainVenderSettings = updatedSettings.vendors[updatedSettings.vender];
    const embeddingsVenderSettings = updatedSettings.useSeparateVenders 
      ? updatedSettings.embeddingsVendors[updatedSettings.embeddingsVender] 
      : mainVenderSettings;

    vectorDBService.initialize(
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

    return true;
  }
  return false;
});

ipcMain.handle('open-local-file', async (event, filePath) => shell.openPath(filePath));

require('./handlers/chatHandlers');
require('./handlers/dbHandlers');

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});
