// Types pour les connexions de base de données
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'redis';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string; // Sera chiffré
  database?: string | number; // Redis uses numbers (0-15), SQL uses strings
  ssl?: boolean;
  sslCert?: string;
  sslKey?: string;
  sslCa?: string;
  createdAt: Date;
  updatedAt: Date;
  lastConnected?: Date;
  isActive: boolean;
  group?: string;
  color?: string;
  // Redis-specific fields
  redisDatabase?: number; // Redis database index (0-15)
  clusterNodes?: string[]; // For Redis clusters
  sentinelNodes?: string[]; // For Redis Sentinel
}

export interface DatabaseInfo {
  name: string;
  version: string;
  charset: string;
  collation: string;
  size?: number;
  tableCount: number;
  connectionCount?: number;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: 'table' | 'view' | 'materialized_view';
  engine?: string;
  rowCount?: number;
  dataSize?: number;
  indexSize?: number;
  comment?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  comment?: string;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
  // Reverse foreign keys (tables that reference this column)
  isReferencedByOtherTables?: boolean;
  referencedByTables?: { table: string, column: string }[];
}

export interface IndexInfo {
  name: string;
  type: 'primary' | 'unique' | 'index' | 'fulltext';
  columns: string[];
  isUnique: boolean;
}

export interface ForeignKeyInfo {
  constraintName: string;
  sourceSchema: string;
  sourceTable: string;
  sourceColumn: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface QueryResult {
  rows: Record<string, any>[];
  fields: ColumnInfo[];
  rowCount: number;
  total?: number; // Total number of rows in the table (for pagination)
  affectedRows?: number;
  executionTime: number;
  query: string;
}

export interface QueryError {
  message: string;
  code?: string;
  position?: number;
  query: string;
  stack?: string;
}

// ===== REDIS-SPECIFIC TYPES =====

// Redis data types
export type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'json';

// Redis connection (extends base connection with Redis-specific fields)
export interface RedisConnectionInfo {
  database?: number; // Redis database index (0-15)
  clusterNodes?: string[]; // For Redis clusters
  sentinelNodes?: string[]; // For Redis Sentinel
  redisPassword?: string; // Redis AUTH password (separate from username)
}

// Redis key information (equivalent to TableInfo for SQL)
export interface RedisKeyInfo {
  key: string;
  type: RedisDataType;
  ttl: number; // Time to live (-1 = no expiry, -2 = expired)
  memoryUsage?: number;
  encoding?: string;
  lastAccessed?: Date;
}

// Redis value information (flexible based on type)
export interface RedisValueInfo {
  key: string;
  type: RedisDataType;
  value: any; // Type-specific value structure
  size: number;
  encoding?: string;
  ttl: number;
}

// Redis command result (equivalent to QueryResult for SQL)
export interface RedisCommandResult {
  command: string[];
  result: any;
  type: 'success' | 'error';
  executionTime: number;
  affectedKeys?: string[];
}

// Redis database information
export interface RedisDatabaseInfo {
  version: string;
  mode: 'standalone' | 'cluster' | 'sentinel';
  databases: number; // Number of databases (usually 16)
  memory: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  keyspace: {
    [db: string]: {
      keys: number;
      expires: number;
    };
  };
  clients: number;
  uptime: number;
}