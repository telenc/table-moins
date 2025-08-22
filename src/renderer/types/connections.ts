export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  sslCa?: string;
  group?: string;
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastConnected?: Date;
}

export interface ConnectionFormData {
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  sslCa?: string;
  group?: string;
  color?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: string;
}

export const DEFAULT_PORTS = {
  mysql: 3306,
  postgresql: 5432,
  sqlite: 0,
} as const;

export const DATABASE_TYPES = [
  { value: 'mysql', label: 'MySQL', icon: '🐬' },
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { value: 'sqlite', label: 'SQLite', icon: '📦' },
] as const;

export const CONNECTION_COLORS = [
  '#1890ff', // Blue
  '#52c41a', // Green  
  '#faad14', // Gold
  '#f5222d', // Red
  '#722ed1', // Purple
  '#13c2c2', // Cyan
  '#eb2f96', // Magenta
  '#fa8c16', // Orange
] as const;