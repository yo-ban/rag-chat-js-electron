const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || app.getAppPath();
const settingsFilePath = path.join(baseDir, 'settings.json');
// const defaultSettingsFilePath = path.join(baseDir, 'defaultSettings.json');
const defaultSettingsFilePath = 'defaultSettings.json';

function loadSettings() {
  let defaultSettings = {};

  try {
    if (fs.existsSync(defaultSettingsFilePath)) {
      console.log('Loading default settings from:', defaultSettingsFilePath);
      defaultSettings = JSON.parse(fs.readFileSync(defaultSettingsFilePath, 'utf-8'));
    } else {
      console.error('Default settings file not found:', defaultSettingsFilePath);
    }
  } catch (error) {
    console.error('Error loading default settings:', error);
  }

  try {
    let settings = { ...defaultSettings };

    if (fs.existsSync(settingsFilePath)) {
      console.log('Loading user settings from:', settingsFilePath);
      const userSettings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf-8'));
      settings = { ...settings, ...userSettings };
    } else {
      console.log('User settings file not found, using default settings.');
    }

    settings.vectorDBSavePath = path.resolve(baseDir, settings.vectorDBSavePath);
    settings.chatDataSavePath = path.resolve(baseDir, settings.chatDataSavePath);

    console.log('Settings loaded successfully.');
    return settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    return defaultSettings;
  }
}

function saveSettings(settings) {
  try {
    const relativeSettings = { ...settings };
    relativeSettings.vectorDBSavePath = path.relative(baseDir, settings.vectorDBSavePath);
    relativeSettings.chatDataSavePath = path.relative(baseDir, settings.chatDataSavePath);

    fs.writeFileSync(settingsFilePath, JSON.stringify(relativeSettings, null, 2));
    console.log('Settings saved successfully to:', settingsFilePath);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

module.exports = {
  loadSettings,
  saveSettings
};
