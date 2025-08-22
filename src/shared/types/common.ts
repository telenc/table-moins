// Types communs utilisés dans toute l'application
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'sql' | 'excel';
  includeHeaders?: boolean;
  delimiter?: string;
  encoding?: string;
  limit?: number;
}

export interface ImportOptions {
  format: 'csv' | 'json' | 'sql';
  hasHeaders?: boolean;
  delimiter?: string;
  encoding?: string;
  skipRows?: number;
  mapping?: Record<string, string>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'cmd' | 'alt' | 'shift')[];
  action: string;
  description: string;
}

export interface UserPreferences {
  theme: Theme;
  language: string;
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  confirmDangerousOperations: boolean;
  maxQueryHistory: number;
  defaultPageSize: number;
  keyboardShortcuts: KeyboardShortcut[];
}

export type Theme = 'light' | 'dark' | 'auto';

export interface ConnectionGroup {
  id: string;
  name: string;
  color: string;
  icon?: string;
  expanded: boolean;
}