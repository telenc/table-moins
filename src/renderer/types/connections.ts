export interface DatabaseConnection {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite' | 'redis';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string | number; // Redis uses numbers (0-15), SQL uses strings
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
  // Redis-specific fields
  redisDatabase?: number; // Redis database index (0-15)
  clusterNodes?: string[]; // For Redis clusters
  sentinelNodes?: string[]; // For Redis Sentinel
}

export interface ConnectionFormData {
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite' | 'redis';
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string | number;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  sslCa?: string;
  group?: string;
  color?: string;
  // Redis-specific fields
  redisDatabase?: number;
  clusterNodes?: string[];
  sentinelNodes?: string[];
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
  redis: 6379,
} as const;

export const DATABASE_TYPES = [
  { value: 'mysql', label: 'MySQL', icon: '🐬' },
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { value: 'sqlite', label: 'SQLite', icon: '📦' },
  { value: 'redis', label: 'Redis', icon: '🔴' },
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