import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  platform: process.platform,
  version: process.env.npm_package_version || '0.1.0',
  
  // Dialog methods
  openFileDialog: (options?: any) => ipcRenderer.invoke('dialog:open-file', options),
  saveFileDialog: (options?: any) => ipcRenderer.invoke('dialog:save-file', options),
  
  // System methods
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  
  // Window methods
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  
  // Connection management
  connections: {
    getAll: () => ipcRenderer.invoke('connections:get-all'),
    getById: (id: string) => ipcRenderer.invoke('connections:get-by-id', id),
    getForEdit: (id: string) => ipcRenderer.invoke('connections:get-for-edit', id),
    create: (data: any) => ipcRenderer.invoke('connections:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('connections:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('connections:delete', id),
    test: (data: any) => ipcRenderer.invoke('connections:test', data),
    connect: (id: string) => ipcRenderer.invoke('connections:connect', id),
    disconnect: (id: string) => ipcRenderer.invoke('connections:disconnect', id),
  },
  
  // Tab management
  tabs: {
    getAll: () => ipcRenderer.invoke('tabs:get-all'),
    getById: (tabId: string) => ipcRenderer.invoke('tabs:get-by-id', tabId),
    connect: (tabId: string) => ipcRenderer.invoke('tabs:connect', tabId),
    disconnect: (tabId: string) => ipcRenderer.invoke('tabs:disconnect', tabId),
    close: (tabId: string) => ipcRenderer.invoke('tabs:close', tabId),
  },
  
  // Database operations
  database: {
    getDatabases: (connectionId: string) => ipcRenderer.invoke('database:get-databases', connectionId),
    getTables: (connectionId: string, database?: string) => ipcRenderer.invoke('database:get-tables', connectionId, database),
    getColumns: (connectionId: string, tableName: string, database?: string) => ipcRenderer.invoke('database:get-columns', connectionId, tableName, database),
    executeQuery: (connectionId: string, query: string) => ipcRenderer.invoke('database:execute-query', connectionId, query),
    getTableData: (connectionId: string, tableName: string, options?: any) => ipcRenderer.invoke('database:get-table-data', connectionId, tableName, options),
    updateTableData: (connectionId: string, tableName: string, updates: Array<{
      whereClause: { [columnName: string]: any };
      setClause: { [columnName: string]: any };
    }>) => ipcRenderer.invoke('database:update-table-data', connectionId, tableName, updates),
  },
  
  // SQL file operations
  sqlFile: {
    open: () => ipcRenderer.invoke('sql-file:open'),
    save: (filePath: string | null, content: string, fileName?: string) => ipcRenderer.invoke('sql-file:save', filePath, content, fileName),
    saveAs: (content: string, fileName?: string) => ipcRenderer.invoke('sql-file:save-as', content, fileName),
  },
  
  // App lifecycle
  app: {
    quit: () => ipcRenderer.send('app:quit'),
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    unmaximize: () => ipcRenderer.send('window:unmaximize'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    close: () => ipcRenderer.send('window:close'),
  },
  
  // File operations
  files: {
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:save-file', options),
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:open-file', options),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
    readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  },
  
  // Logging methods
  logInfo: (message: string) => ipcRenderer.send('log:info', message),
  logWarn: (message: string) => ipcRenderer.send('log:warn', message),
  logError: (message: string, error?: any) => ipcRenderer.send('log:error', message, error),
  
  // Menu actions listener
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_, action) => callback(action));
  },
  
  // Remove menu action listener
  removeMenuActionListener: () => {
    ipcRenderer.removeAllListeners('menu-action');
  },
  
  // Auto-updater methods
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadAndInstall: () => ipcRenderer.invoke('updater:download-and-install'),
    restartAndInstall: () => ipcRenderer.invoke('updater:restart-and-install'),
    getVersion: () => ipcRenderer.invoke('updater:get-version'),
    
    // Event listeners for update events
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update-available', (_, info) => callback(info));
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update-downloaded', (_, info) => callback(info));
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('update-progress', (_, progress) => callback(progress));
    },
    onUpdateError: (callback: (error: string) => void) => {
      ipcRenderer.on('update-error', (_, error) => callback(error));
    },
    
    // Remove update listeners
    removeUpdateListeners: () => {
      ipcRenderer.removeAllListeners('update-available');
      ipcRenderer.removeAllListeners('update-downloaded');
      ipcRenderer.removeAllListeners('update-progress');
      ipcRenderer.removeAllListeners('update-error');
    }
  }
});

// Expose a simple electron API for direct IPC calls
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      openFileDialog: (options?: any) => Promise<any>;
      saveFileDialog: (options?: any) => Promise<any>;
      getSystemInfo: () => Promise<any>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      isWindowMaximized: () => Promise<boolean>;
      logInfo: (message: string) => void;
      logWarn: (message: string) => void;
      logError: (message: string, error?: any) => void;
      onMenuAction: (callback: (action: string) => void) => void;
      removeMenuActionListener: () => void;
      connections: {
        getAll: () => Promise<any>;
        getById: (id: string) => Promise<any>;
        getForEdit: (id: string) => Promise<any>;
        create: (data: any) => Promise<string>;
        update: (id: string, data: any) => Promise<void>;
        delete: (id: string) => Promise<void>;
        test: (data: any) => Promise<any>;
        connect: (id: string) => Promise<string>;
        disconnect: (id: string) => Promise<void>;
      };
      tabs: {
        getAll: () => Promise<any>;
        getById: (tabId: string) => Promise<any>;
        connect: (tabId: string) => Promise<void>;
        disconnect: (tabId: string) => Promise<void>;
        close: (tabId: string) => Promise<void>;
      };
      database: {
        getDatabases: (connectionId: string) => Promise<any>;
        getTables: (connectionId: string, database?: string) => Promise<any>;
        getColumns: (connectionId: string, tableName: string, database?: string) => Promise<any>;
        executeQuery: (connectionId: string, query: string) => Promise<any>;
        getTableData: (connectionId: string, tableName: string, options?: any) => Promise<any>;
      };
      sqlFile: {
        open: () => Promise<{ canceled: boolean; filePath?: string; fileName?: string; content?: string; }>;
        save: (filePath: string | null, content: string, fileName?: string) => Promise<{ canceled: boolean; filePath?: string; fileName?: string; }>;
        saveAs: (content: string, fileName?: string) => Promise<{ canceled: boolean; filePath?: string; fileName?: string; }>;
      };
      updater: {
        checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string; }>;
        downloadAndInstall: () => Promise<{ success: boolean; error?: string; }>;
        restartAndInstall: () => Promise<{ success: boolean; error?: string; }>;
        getVersion: () => Promise<{ success: boolean; version?: string; error?: string; }>;
        onUpdateAvailable: (callback: (info: any) => void) => void;
        onUpdateDownloaded: (callback: (info: any) => void) => void;
        onUpdateProgress: (callback: (progress: any) => void) => void;
        onUpdateError: (callback: (error: string) => void) => void;
        removeUpdateListeners: () => void;
      };
    };
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}