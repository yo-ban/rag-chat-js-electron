const fs = require('fs').promises;
const path = require('path');
const { baseDir } = require('./constants/constants')

const settingsFilePath = path.join(baseDir, 'settings.json');
const defaultSettingsFilePath = 'defaultSettings.json';

async function loadSettings() {
  let defaultSettings = {};

  try {
    if (await fileExists(defaultSettingsFilePath)) {
      console.log('Loading default settings from:', defaultSettingsFilePath);
      const data = await fs.readFile(defaultSettingsFilePath, 'utf-8');
      defaultSettings = JSON.parse(data);
      // defaultSettingsの相対パスを絶対パスに変換
      defaultSettings.vectorDBSavePath = path.resolve(baseDir, defaultSettings.vectorDBSavePath);
      defaultSettings.chatDataSavePath = path.resolve(baseDir, defaultSettings.chatDataSavePath);
    } else {
      console.error('Default settings file not found:', defaultSettingsFilePath);
    }
  } catch (error) {
    console.error('Error loading default settings:', error);
  }

  try {
    let settings = { ...defaultSettings };

    if (await fileExists(settingsFilePath)) {
      console.log('Loading user settings from:', settingsFilePath);
      const data = await fs.readFile(settingsFilePath, 'utf-8');
      const userSettings = JSON.parse(data);
      settings = { ...settings, ...userSettings };
    } else {
      console.log('User settings file not found, using default settings.');
    }

    console.log('Settings loaded successfully.');
    return settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
}

async function saveSettings(settings) {
  try {
    await fs.writeFile(settingsFilePath, JSON.stringify(settings, null, 2));
    console.log('Settings saved successfully to:', settingsFilePath);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  loadSettings,
  saveSettings
};
