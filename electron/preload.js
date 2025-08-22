const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Dialog methods
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // File operations
  onFilesSelected: (callback) => ipcRenderer.on('files-selected', callback),
  removeFilesSelectedListener: (callback) => ipcRenderer.removeListener('files-selected', callback),
  
  // Audio operations
  onRunAudioSetup: (callback) => ipcRenderer.on('run-audio-setup', callback),
  onTestAudioEnvironment: (callback) => ipcRenderer.on('test-audio-environment', callback),
  onClearTempFiles: (callback) => ipcRenderer.on('clear-temp-files', callback),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  
  // Platform info
  platform: process.platform,
  isElectron: true
})

// Security: Remove Node.js globals in renderer process
delete window.require
delete window.exports
delete window.module