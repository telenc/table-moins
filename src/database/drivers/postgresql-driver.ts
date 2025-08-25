import { Pool, Client, PoolConfig } from 'pg';
import { BaseDatabaseDriver } from './base-driver';
import { DatabaseConnection, QueryResult, TableInfo, ColumnInfo, DatabaseInfo } from '../../shared/types/database';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('PostgreSQLDriver');

export class PostgreSQLDriver extends BaseDatabaseDriver {
  private pool: Pool | null = null;
  private client: Client | null = null;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  /**
   * Teste la connexion à PostgreSQL
   */
  async testConnection(): Promise<boolean> {
    try {
      const config = this.getConnectionConfig();
      console.log('=== Configuration de connexion PostgreSQL ===');
      console.log('Host:', config.host);
      console.log('Port:', config.port);
      console.log('User:', config.user);
      console.log('Database:', config.database);
      console.log('SSL activé:', config.ssl ? 'OUI' : 'NON');
      console.log('SSL config:', config.ssl);
      console.log('===============================================');
      
      logger.info('Configuration de connexion PostgreSQL:', {
        host: config.host,
        port: config.port,
        user: config.user,
        database: config.database,
        ssl: config.ssl ? 'activé' : 'désactivé',
        sslConfig: config.ssl || 'aucun'
      });
      
      const client = new Client(config);
      logger.info('Tentative de connexion à PostgreSQL...');
      await client.connect();
      logger.info('Connexion établie, test de requête...');
      await client.query('SELECT 1');
      logger.info('Test de requête réussi, fermeture de la connexion...');
      await client.end();
      logger.info('Test de connexion PostgreSQL réussi');
      return true;
    } catch (error) {
      logger.error('Test de connexion PostgreSQL échoué:', error as Error);
      return false;
    }
  }

  /**
   * Se connecte à PostgreSQL avec pool de connexions
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected && this.pool) {
        return;
      }

      const config = this.getConnectionConfig();
      
      // Configuration du pool
      const poolConfig: PoolConfig = {
        ...config,
        max: 10, // Nombre maximum de connexions dans le pool
        idleTimeoutMillis: 30000, // Temps d'inactivité avant fermeture
        connectionTimeoutMillis: 30000, // Timeout de connexion
        allowExitOnIdle: true,
      };

      this.pool = new Pool(poolConfig);
      
      // Gestion des erreurs du pool
      this.pool.on('error', (err) => {
        logger.error('Erreur du pool PostgreSQL:', err);
      });

      // Test de la connexion
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
      logger.info(`Connecté à PostgreSQL: ${this.connection.host}:${this.connection.port}`);
    } catch (error) {
      logger.error('Erreur de connexion PostgreSQL:', error as Error);
      this.isConnected = false;
      throw new Error(`Connexion PostgreSQL échouée: ${(error as Error).message}`);
    }
  }

  /**
   * Se déconnecte de PostgreSQL
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.end();
        this.client = null;
      }
      
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      
      this.isConnected = false;
      logger.info('Déconnecté de PostgreSQL');
    } catch (error) {
      logger.error('Erreur lors de la déconnexion PostgreSQL:', error as Error);
      throw error;
    }
  }

  /**
   * Exécute une requête SQL
   */
  async executeQuery(query: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Connexion PostgreSQL non établie');
    }

    try {
      const { result, executionTime } = await this.measureExecutionTime(async () => {
        return await this.pool!.query(query);
      });

      // Convertir les champs PostgreSQL en format ColumnInfo
      const columns: ColumnInfo[] = result.fields.map(field => ({
        name: field.name,
        type: this.mapPostgreSQLType(field.dataTypeID),
        length: undefined, // PostgreSQL ne fournit pas cette info directement
        nullable: true, // Sera déterminé par une requête séparée si nécessaire
        defaultValue: undefined,
        isPrimaryKey: false, // Sera déterminé par une requête séparée
        isForeignKey: false,
        isUnique: false,
        isAutoIncrement: false,
        comment: '',
      }));

      return {
        rows: result.rows,
        fields: columns,
        rowCount: result.rowCount || 0,
        executionTime,
        query,
      };
    } catch (error) {
      logger.error('Erreur d\'exécution de requête PostgreSQL:', error as Error);
      throw this.formatError(error, query);
    }
  }

  /**
   * Récupère les informations sur la base PostgreSQL
   */
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const versionQuery = 'SELECT version()';
    const versionResult = await this.executeQuery(versionQuery);
    const versionRow = versionResult.rows[0] as any;

    const dbInfoQuery = `
      SELECT 
        current_database() as database_name,
        current_setting('server_encoding') as charset,
        current_setting('lc_collate') as collation
    `;
    
    const dbInfoResult = await this.executeQuery(dbInfoQuery);
    const dbInfoRow = dbInfoResult.rows[0] as any;

    // Compter les tables
    const tableCountResult = await this.executeQuery(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    `);
    
    return {
      name: dbInfoRow.database_name,
      version: versionRow.version,
      charset: dbInfoRow.charset,
      collation: dbInfoRow.collation,
      tableCount: parseInt(tableCountResult.rows[0]?.count || '0'),
    };
  }

  /**
   * Récupère la liste des bases de données
   */
  async getDatabases(): Promise<string[]> {
    const query = `
      SELECT datname as database_name 
      FROM pg_database 
      WHERE datistemplate = false
      ORDER BY datname
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => row.database_name);
  }

  /**
   * Récupère la liste des schémas
   */
  async getSchemas(): Promise<string[]> {
    const query = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY 
        CASE 
          WHEN schema_name = 'public' THEN 0 
          ELSE 1 
        END,
        schema_name
    `;
    
    const result = await this.executeQuery(query);
    return result.rows.map((row: any) => row.schema_name);
  }

  /**
   * Récupère la liste des tables
   */
  async getTables(schemaOrDatabase?: string): Promise<TableInfo[]> {
    // Par défaut, utiliser le schéma 'public' si rien n'est spécifié
    const schemaName = schemaOrDatabase || 'public';
    
    const query = `
      SELECT 
        t.table_name as name,
        t.table_schema as schema,
        t.table_type,
        CASE 
          WHEN t.table_type = 'BASE TABLE' THEN 'table'
          WHEN t.table_type = 'VIEW' THEN 'view'
          WHEN t.table_type = 'SYSTEM VIEW' THEN 'view'
          WHEN t.table_type = 'FOREIGN TABLE' THEN 'table'
          ELSE 'table'
        END as type,
        pg_size_pretty(pg_total_relation_size(c.oid)) as data_size,
        obj_description(c.oid, 'pg_class') as comment
      FROM information_schema.tables t
      LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = (
        SELECT oid FROM pg_namespace WHERE nspname = t.table_schema
      )
      WHERE t.table_schema = '${schemaName}'
        AND t.table_type IN ('BASE TABLE', 'VIEW', 'SYSTEM VIEW', 'FOREIGN TABLE')
      ORDER BY t.table_name
    `;

    const result = await this.executeQuery(query);
    console.log('🔍 DEBUG - Tables récupérées:', result.rows.map(r => ({ name: r.name, table_type: r.table_type, computed_type: r.type })));
    return result.rows.map((row: any) => ({
      name: row.name,
      schema: row.schema,
      type: row.type as 'table' | 'view',
      comment: row.comment,
      dataSize: row.data_size,
      // PostgreSQL ne fournit pas directement ces informations
      rowCount: undefined,
      indexSize: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    }));
  }

  /**
   * Change de base de données
   */
  async changeDatabase(newDatabase: string): Promise<void> {
    try {
      // Déconnecter de la base actuelle
      await this.disconnect();
      
      // Mettre à jour la configuration de connexion
      this.connection.database = newDatabase;
      
      // Reconnecter avec la nouvelle base
      await this.connect();
      
      logger.info(`Changé vers la base de données: ${newDatabase}`);
    } catch (error) {
      logger.error('Erreur lors du changement de base de données:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère les colonnes d'une table
   */
  async getColumns(tableName: string, _database?: string): Promise<ColumnInfo[]> {
    const query = `
      SELECT 
        c.column_name as name,
        c.data_type as type,
        c.character_maximum_length as length,
        c.numeric_precision as precision,
        c.numeric_scale as scale,
        c.is_nullable,
        c.column_default as default_value,
        CASE 
          WHEN pk.column_name IS NOT NULL THEN true 
          ELSE false 
        END as is_primary_key,
        CASE 
          WHEN fk.column_name IS NOT NULL THEN true 
          ELSE false 
        END as is_foreign_key,
        CASE 
          WHEN uk.column_name IS NOT NULL THEN true 
          ELSE false 
        END as is_unique,
        CASE 
          WHEN c.column_default LIKE 'nextval%' THEN true 
          ELSE false 
        END as is_auto_increment,
        col_description(pgc.oid, c.ordinal_position) as comment
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.column_name = c.column_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'FOREIGN KEY'
      ) fk ON fk.column_name = c.column_name
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
        WHERE tc.table_name = $1 AND tc.constraint_type = 'UNIQUE'
      ) uk ON uk.column_name = c.column_name
      WHERE c.table_name = $1 
        AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `;

    const result = await this.executeQuery(query.replace(/\$1/g, this.escapeValue(tableName)));
    return result.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      length: row.length,
      precision: row.precision,
      scale: row.scale,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.default_value,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      isUnique: row.is_unique,
      isAutoIncrement: row.is_auto_increment,
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
    
    console.log('🔍 DEBUG getTableData - tableName:', tableName, 'options:', { offset, limit });
    
    // First, get the total count
    let countQuery = `SELECT COUNT(*) as total FROM ${this.escapeIdentifier(tableName)}`;
    if (where) {
      countQuery += ` WHERE ${where}`;
    }
    
    const countResult = await this.executeQuery(countQuery);
    const total = parseInt(countResult.rows[0].total, 10);
    
    // Then get the paginated data
    let query = `SELECT * FROM ${this.escapeIdentifier(tableName)}`;
    
    if (where) {
      query += ` WHERE ${where}`;
    }
    
    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await this.executeQuery(query);
    
    // Add the total count to the result
    return {
      ...result,
      total: total
    };
  }

  /**
   * Configuration de connexion PostgreSQL
   */
  private getConnectionConfig() {
    const config: any = {
      host: this.connection.host,
      port: this.connection.port,
      user: this.connection.username,
      password: this.connection.password,
      database: this.connection.database,
      statement_timeout: 60000, // 60 secondes
      query_timeout: 60000,
      connectionTimeoutMillis: 30000,
    };

    // Configuration SSL - Force SSL pour Azure
    const isAzureDatabase = this.connection.host?.includes('azure.com') || this.connection.host?.includes('database.windows.net');
    if (this.connection.ssl || isAzureDatabase) {
      config.ssl = {
        cert: this.connection.sslCert,
        key: this.connection.sslKey,
        ca: this.connection.sslCa,
        rejectUnauthorized: false, // Azure nécessite souvent rejectUnauthorized: false
      };
      
      // Pour Azure, utiliser une configuration SSL simple si pas de certificats
      if (isAzureDatabase && !this.connection.sslCert) {
        config.ssl = { rejectUnauthorized: false };
      }
    }

    return config;
  }

  /**
   * Mappe les types PostgreSQL vers des types génériques
   */
  private mapPostgreSQLType(typeID: number): string {
    // Mapping basé sur les OID PostgreSQL courants
    switch (typeID) {
      case 16: return 'BOOLEAN';
      case 20: return 'BIGINT';
      case 21: return 'SMALLINT';
      case 23: return 'INTEGER';
      case 25: return 'TEXT';
      case 700: return 'REAL';
      case 701: return 'DOUBLE PRECISION';
      case 1043: return 'VARCHAR';
      case 1082: return 'DATE';
      case 1083: return 'TIME';
      case 1114: return 'TIMESTAMP';
      case 1184: return 'TIMESTAMPTZ';
      case 1700: return 'NUMERIC';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Échappe les identifiants PostgreSQL
   */
  protected escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Échappe les valeurs PostgreSQL
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