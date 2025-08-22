import { ConnectionFormData, ConnectionTestResult, DatabaseConnection } from './connections';

export interface ElectronAPI {
  // System
  platform: string;
  version: string;
  
  // Connections API
  connections: {
    getAll: () => Promise<DatabaseConnection[]>;
    getById: (id: string) => Promise<DatabaseConnection | null>;
    create: (data: ConnectionFormData) => Promise<string>;
    update: (id: string, data: Partial<ConnectionFormData>) => Promise<void>;
    delete: (id: string) => Promise<void>;
    test: (data: ConnectionFormData) => Promise<ConnectionTestResult>;
    connect: (id: string) => Promise<void>;
    disconnect: (id: string) => Promise<void>;
  };
  
  // Database Operations (future)
  database: {
    getDatabases: (connectionId: string) => Promise<string[]>;
    getTables: (connectionId: string, database?: string) => Promise<any[]>;
    getColumns: (connectionId: string, tableName: string, database?: string) => Promise<any[]>;
    executeQuery: (connectionId: string, query: string) => Promise<any>;
    getTableData: (connectionId: string, tableName: string, options?: any) => Promise<any>;
  };
  
  // App lifecycle
  app: {
    quit: () => void;
    minimize: () => void;
    maximize: () => void;
    unmaximize: () => void;
    isMaximized: () => Promise<boolean>;
    close: () => void;
  };
  
  // File operations (future)
  files: {
    showSaveDialog: (options: any) => Promise<string | null>;
    showOpenDialog: (options: any) => Promise<string[] | null>;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string) => Promise<string>;
  };
}

// Window interface declaration is in preload.ts