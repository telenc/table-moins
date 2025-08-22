// Types pour l'interface utilisateur

export type SidebarTab = 'connections' | 'database' | 'favorites' | 'history';

export type ViewMode = 'table' | 'json' | 'form';

export interface AppState {
  theme: 'light' | 'dark' | 'auto';
  sidebarCollapsed: boolean;
  activeTab: SidebarTab;
  viewMode: ViewMode;
  currentConnection?: string;
  currentDatabase?: string;
  currentTable?: string;
}

export interface TabData {
  id: string;
  title: string;
  type: 'query' | 'table' | 'connection';
  content: string;
  saved: boolean;
  connectionId?: string;
  database?: string;
  table?: string;
}

export interface FilterState {
  column: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'is_null' | 'is_not_null';
  value: string;
  active: boolean;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface NotificationData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    text: string;
    handler: () => void;
  };
}