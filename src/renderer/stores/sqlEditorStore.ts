import { create } from 'zustand';

interface SqlEditorContent {
  [tabId: string]: {
    content: string;
    fileName: string;
    filePath?: string;
    hasUnsavedChanges: boolean;
  };
}

interface TableInfo {
  schema: string;
  name: string;
  columns?: string[];
}

interface DatabaseCache {
  [connectionId: string]: {
    schemas: string[];
    tables: TableInfo[];
    lastUpdated: Date;
  };
}

interface SqlEditorStore {
  editors: SqlEditorContent;
  databaseCache: DatabaseCache;
  getEditorContent: (tabId: string) => string;
  setEditorContent: (tabId: string, content: string) => void;
  getEditorData: (tabId: string) => SqlEditorContent[string] | undefined;
  setEditorData: (tabId: string, data: Partial<SqlEditorContent[string]>) => void;
  removeEditor: (tabId: string) => void;
  // Cache methods
  getCachedDatabase: (connectionId: string) => DatabaseCache[string] | undefined;
  setCachedDatabase: (connectionId: string, data: DatabaseCache[string]) => void;
  clearDatabaseCache: (connectionId: string) => void;
}

const DEFAULT_CONTENT = '-- Write your SQL query here\nSELECT * FROM your_table LIMIT 10;';

export const useSqlEditorStore = create<SqlEditorStore>((set, get) => ({
  editors: {},
  databaseCache: {},
  
  getEditorContent: (tabId: string) => {
    const editor = get().editors[tabId];
    return editor?.content || DEFAULT_CONTENT;
  },
  
  setEditorContent: (tabId: string, content: string) => {
    set((state) => ({
      editors: {
        ...state.editors,
        [tabId]: {
          ...state.editors[tabId],
          content,
          fileName: state.editors[tabId]?.fileName || 'Untitled.sql',
          hasUnsavedChanges: content !== DEFAULT_CONTENT
        }
      }
    }));
  },
  
  getEditorData: (tabId: string) => {
    return get().editors[tabId];
  },
  
  setEditorData: (tabId: string, data: Partial<SqlEditorContent[string]>) => {
    set((state) => ({
      editors: {
        ...state.editors,
        [tabId]: {
          ...state.editors[tabId],
          ...data
        }
      }
    }));
  },
  
  removeEditor: (tabId: string) => {
    set((state) => {
      const { [tabId]: removed, ...rest } = state.editors;
      return { editors: rest };
    });
  },
  
  // Cache methods
  getCachedDatabase: (connectionId: string) => {
    return get().databaseCache[connectionId];
  },
  
  setCachedDatabase: (connectionId: string, data: DatabaseCache[string]) => {
    set((state) => ({
      databaseCache: {
        ...state.databaseCache,
        [connectionId]: data
      }
    }));
  },
  
  clearDatabaseCache: (connectionId: string) => {
    set((state) => {
      const { [connectionId]: removed, ...rest } = state.databaseCache;
      return { databaseCache: rest };
    });
  }
}));