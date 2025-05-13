const { contextBridge, ipcRenderer } = require('electron');

// Expose API aman untuk renderer process
contextBridge.exposeInMainWorld('airdropManager', {
  // Project management
  submitProject: (projectData) => ipcRenderer.invoke('submit-project', projectData),

  // Account management
  getAccountsStatus: () => ipcRenderer.invoke('get-accounts-status'),
  manageAccount: (accountData) => ipcRenderer.invoke('manage-account', accountData),
  
  // Project analytics
  getProjectPoints: (projectUrl) => ipcRenderer.invoke('get-project-points', projectUrl),

  // Proxy management
  addProxy: (proxyData) => ipcRenderer.invoke('add-proxy', proxyData),
  
  // Task management
  stopTask: (taskId) => ipcRenderer.invoke('stop-task', taskId),
  pauseTask: (taskId) => ipcRenderer.invoke('pause-task', taskId),
  resumeTask: (taskId) => ipcRenderer.invoke('resume-task', taskId),
  
  // App events
  onTaskStatusUpdate: (callback) => {
    ipcRenderer.on('task-status-update', (event, data) => callback(data));
  },
  
  onPointsUpdate: (callback) => {
    ipcRenderer.on('points-update', (event, data) => callback(data));
  },
  
  onError: (callback) => {
    ipcRenderer.on('error-occurred', (event, data) => callback(data));
  }
});