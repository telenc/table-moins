import mysql from 'mysql2/promise';
import { BaseDatabaseDriver } from './base-driver';
import { DatabaseConnection, QueryResult, TableInfo, ColumnInfo, DatabaseInfo } from '../../shared/types/database';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('MySQLDriver');

export class MySQLDriver extends BaseDatabaseDriver {
  private pool: mysql.Pool | null = null;
  private activeConnection: mysql.Connection | null = null;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  /**
   * Teste la connexion à MySQL
   */
  async testConnection(): Promise<boolean> {
    try {
      const connection = await this.createConnection();
      await connection.ping();
      await connection.end();
      return true;
    } catch (error) {
      logger.error('Test de connexion MySQL échoué:', error as Error);
      return false;
    }
  }

  /**
   * Se connecte à MySQL avec pool de connexions
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected && this.pool) {
        return;
      }

      // Configuration du pool de connexions
      const config: mysql.PoolOptions = {
        host: this.connection.host,
        port: this.connection.port,
        user: this.connection.username,
        password: this.connection.password,
        database: typeof this.connection.database === 'string' ? this.connection.database : undefined,
        connectionLimit: 10,
        multipleStatements: false, // Sécurité
      };

      // Configuration SSL si activée
      if (this.connection.ssl) {
        config.ssl = {
          cert: this.connection.sslCert,
          key: this.connection.sslKey,
          ca: this.connection.sslCa,
          rejectUnauthorized: true,
        };
      }

      this.pool = mysql.createPool(config);
      
      // Test de la connexion
      const testConn = await this.pool.getConnection();
      await testConn.ping();
      testConn.release();

      this.isConnected = true;
      logger.info(`Connecté à MySQL: ${this.connection.host}:${this.connection.port}`);
    } catch (error) {
      logger.error('Erreur de connexion MySQL:', error as Error);
      this.isConnected = false;
      throw new Error(`Connexion MySQL échouée: ${(error as Error).message}`);
    }
  }

  /**
   * Se déconnecte de MySQL
   */
  async disconnect(): Promise<void> {
    try {
      if (this.activeConnection) {
        await this.activeConnection.end();
        this.activeConnection = null;
      }
      
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      
      this.isConnected = false;
      logger.info('Déconnecté de MySQL');
    } catch (error) {
      logger.error('Erreur lors de la déconnexion MySQL:', error as Error);
      throw error;
    }
  }

  /**
   * Exécute une requête SQL
   */
  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Connexion MySQL non établie');
    }

    try {
      const { result, executionTime } = await this.measureExecutionTime(async () => {
        const connection = await this.pool!.getConnection();
        try {
          const [rows, fields] = await connection.execute(query);
          return { rows, fields };
        } finally {
          connection.release();
        }
      });

      // Convertir les champs MySQL en format ColumnInfo (simplifié)
      const columns: ColumnInfo[] = (result.fields as mysql.FieldPacket[]).map(field => ({
        name: field.name,
        type: this.mapMySQLType(field.type || 0, field.columnLength),
        length: field.columnLength,
        nullable: true, // Sera déterminé par information_schema si nécessaire
        defaultValue: undefined,
        isPrimaryKey: false, // Sera déterminé par information_schema
        isForeignKey: false,
        isUnique: false,
        isAutoIncrement: false,
        comment: '',
      }));

      return {
        rows: Array.isArray(result.rows) ? result.rows : [],
        fields: columns,
        rowCount: Array.isArray(result.rows) ? result.rows.length : 0,
        affectedRows: (result.rows as any)?.affectedRows,
        executionTime,
        query,
      };
    } catch (error) {
      logger.error('Erreur d\'exécution de requête MySQL:', error as Error);
      throw this.formatError(error, query);
    }
  }

  /**
   * Récupère les informations sur la base MySQL
   */
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const query = `
      SELECT 
        VERSION() as version,
        DATABASE() as database_name,
        @@character_set_database as charset,
        @@collation_database as collation
    `;
    
    const result = await this.executeQuery(query);
    const row = result.rows[0] as any;

    // Compter les tables
    const tableCountResult = await this.executeQuery(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    
    return {
      name: row.database_name || this.connection.database || '',
      version: row.version || 'Unknown',
      charset: row.charset || 'utf8',
      collation: row.collation || 'utf8_general_ci',
      tableCount: (tableCountResult.rows[0] as any).count || 0,
    };
  }

  /**
   * Récupère la liste des bases de données
   */
  async getDatabases(): Promise<string[]> {
    const query = `
      SELECT schema_name as database_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
      ORDER BY schema_name
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => row.database_name);
  }

  /**
   * Récupère la liste des tables
   */
  async getTables(database?: string): Promise<TableInfo[]> {
    const query = `
      SELECT 
        table_name as name,
        table_schema as schema,
        table_type as type,
        engine,
        table_rows as row_count,
        data_length as data_size,
        index_length as index_size,
        table_comment as comment,
        create_time as created_at,
        update_time as updated_at
      FROM information_schema.tables 
      WHERE table_schema = ${database ? `'${this.escapeValue(database)}'` : 'DATABASE()'}
      ORDER BY table_name
    `;

    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => ({
      name: row.name,
      schema: row.schema,
      type: row.type === 'BASE TABLE' ? 'table' : 'view',
      engine: row.engine,
      rowCount: row.row_count,
      dataSize: row.data_size,
      indexSize: row.index_size,
      comment: row.comment,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
    }));
  }

  /**
   * Récupère les colonnes d'une table
   */
  async getColumns(tableName: string, database?: string): Promise<ColumnInfo[]> {
    const dbName = database || this.connection.database;
    const query = `
      SELECT 
        column_name as name,
        data_type as type,
        character_maximum_length as length,
        numeric_precision as precision,
        numeric_scale as scale,
        is_nullable,
        column_default as default_value,
        column_key,
        extra,
        column_comment as comment
      FROM information_schema.columns 
      WHERE table_schema = ${dbName ? `'${this.escapeValue(dbName)}'` : 'DATABASE()'}
        AND table_name = '${this.escapeValue(tableName)}'
      ORDER BY ordinal_position
    `;

    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      length: row.length,
      precision: row.precision,
      scale: row.scale,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.default_value,
      isPrimaryKey: row.column_key === 'PRI',
      isForeignKey: row.column_key === 'MUL',
      isUnique: row.column_key === 'UNI',
      isAutoIncrement: row.extra.includes('auto_increment'),
      comment: row.comment,
    }));
  }

  /**
   * Récupère les données d'une table avec pagination
   */
  async getTableData(
    tableName: string,
    options: {
      database?: string;
      offset?: number;
      limit?: number;
      where?: string;
      orderBy?: string;
    } = {}
  ): Promise<QueryResult> {
    const { offset = 0, limit = 100, where, orderBy } = options;
    
    let query = `SELECT * FROM ${this.escapeIdentifier(tableName)}`;
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    return this.executeQuery(query);
  }

  /**
   * Crée une connexion temporaire pour les tests
   */
  private async createConnection(): Promise<mysql.Connection> {
    const config: mysql.ConnectionOptions = {
      host: this.connection.host,
      port: this.connection.port,
      user: this.connection.username,
      password: this.connection.password,
      database: typeof this.connection.database === 'string' ? this.connection.database : undefined,
    };

    if (this.connection.ssl) {
      config.ssl = {
        cert: this.connection.sslCert,
        key: this.connection.sslKey,
        ca: this.connection.sslCa,
        rejectUnauthorized: true,
      };
    }

    return mysql.createConnection(config);
  }

  /**
   * Mappe les types MySQL vers des types génériques
   */
  private mapMySQLType(type: number, length?: number): string {
    // Mapping basé sur les constantes MySQL
    switch (type) {
      case 1: return 'TINYINT';
      case 2: return 'SMALLINT';
      case 3: return 'INT';
      case 8: return 'BIGINT';
      case 4: return 'FLOAT';
      case 5: return 'DOUBLE';
      case 0: return 'DECIMAL';
      case 7: return 'TIMESTAMP';
      case 10: return 'DATE';
      case 11: return 'TIME';
      case 12: return 'DATETIME';
      case 13: return 'YEAR';
      case 252: return length && length > 255 ? 'TEXT' : 'VARCHAR';
      case 253: return 'VARCHAR';
      case 254: return 'CHAR';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Échappe les identifiants MySQL
   */
  protected escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
  }

  /**
   * Échappe les valeurs MySQL
   */
  protected escapeValue(value: any): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    
    return String(value);
  }
}