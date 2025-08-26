// Types pour les connexions de base de données
export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string; // Sera chiffré
  database?: string;
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