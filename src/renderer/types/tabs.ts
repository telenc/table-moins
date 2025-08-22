import { TabConnection } from '../../database/connection-service';

export type TabType = 'connection' | 'sql-editor';

export interface SqlEditorTab {
  id: string;
  type: 'sql-editor';
  title: string;
  fileName: string;
  content: string;
  connectionId: string; // ID de la connexion à utiliser
  hasUnsavedChanges: boolean;
  savedPath?: string; // Chemin du fichier sauvegardé sur disque
  createdAt: Date;
  modifiedAt: Date;
}

export interface DatabaseTab {
  id: string;
  type: 'connection';
  tabConnection: TabConnection;
}

export type AppTab = DatabaseTab | SqlEditorTab;

export interface TabsState {
  tabs: AppTab[];
  activeTabId: string | null;
  
  // Actions
  setTabs: (tabs: AppTab[]) => void;
  addTab: (tab: AppTab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTab: (tabId: string, updates: Partial<AppTab>) => void;
  clearTabs: () => void;
  
  // Helpers pour les types spécifiques
  addSqlEditorTab: (tab: Omit<SqlEditorTab, 'id' | 'createdAt' | 'modifiedAt'>) => string;
  updateSqlEditorTab: (tabId: string, updates: Partial<SqlEditorTab>) => void;
}