import { DatabaseConnection, QueryResult, QueryError, TableInfo, ColumnInfo, DatabaseInfo } from '../../shared/types/database';

export abstract class BaseDatabaseDriver {
  protected connection: DatabaseConnection;
  protected isConnected = false;

  constructor(connection: DatabaseConnection) {
    this.connection = connection;
  }

  /**
   * Teste la connexion à la base de données
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Se connecte à la base de données
   */
  abstract connect(): Promise<void>;

  /**
   * Se déconnecte de la base de données
   */
  abstract disconnect(): Promise<void>;

  /**
   * Exécute une requête SQL
   */
  abstract executeQuery(query: string): Promise<QueryResult>;

  /**
   * Récupère les informations sur la base de données
   */
  abstract getDatabaseInfo(): Promise<DatabaseInfo>;

  /**
   * Récupère la liste des bases de données
   */
  abstract getDatabases(): Promise<string[]>;

  /**
   * Récupère la liste des tables d'une base
   */
  abstract getTables(database?: string): Promise<TableInfo[]>;

  /**
   * Récupère les colonnes d'une table
   */
  abstract getColumns(tableName: string, database?: string): Promise<ColumnInfo[]>;

  /**
   * Récupère les données d'une table avec pagination
   */
  abstract getTableData(
    tableName: string,
    options?: {
      database?: string;
      offset?: number;
      limit?: number;
      where?: string;
      orderBy?: string;
    }
  ): Promise<QueryResult>;

  /**
   * Vérifie si le driver est connecté
   */
  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Récupère les informations de connexion (sans mot de passe)
   */
  getConnectionInfo(): Omit<DatabaseConnection, 'password'> {
    const { password, ...connectionInfo } = this.connection;
    return connectionInfo;
  }

  /**
   * Échappe les identifiants SQL
   */
  protected abstract escapeIdentifier(identifier: string): string;

  /**
   * Échappe les valeurs SQL
   */
  protected abstract escapeValue(value: any): string;

  /**
   * Formate une erreur SQL
   */
  protected formatError(error: any, query: string): QueryError {
    return {
      message: error.message || 'Erreur SQL inconnue',
      code: error.code || error.sqlState || 'UNKNOWN',
      position: error.position,
      query,
      stack: error.stack
    };
  }

  /**
   * Mesure le temps d'exécution d'une opération
   */
  protected async measureExecutionTime<T>(operation: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;
    
    return { result, executionTime };
  }
}