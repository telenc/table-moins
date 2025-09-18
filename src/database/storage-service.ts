import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import { DatabaseConnection } from '../shared/types/database';
import { Logger } from '../shared/utils/logger';

const logger = new Logger('StorageService');

export class StorageService {
  private static instance: StorageService;
  private db: Database.Database | null = null;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Initialise la base de données locale
   */
  async initialize(testPath?: string): Promise<void> {
    if (this.db) {
      logger.debug('Base de données déjà initialisée');
      return;
    }

    try {
      let dbPath: string;
      
      if (testPath) {
        // Mode test avec chemin personnalisé
        dbPath = testPath;
      } else {
        // Mode production avec Electron
        const userDataPath = app.getPath('userData');
        dbPath = join(userDataPath, 'tablemoins.db');
      }
      
      logger.info(`Initialisation de la base de données: ${dbPath}`);
      
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging pour de meilleures performances
      this.db.pragma('foreign_keys = ON'); // Activer les contraintes de clés étrangères
      
      await this.createTables();
      logger.info('Base de données locale initialisée avec succès');
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation de la base de données:', error as Error);
      throw error;
    }
  }

  /**
   * Crée les tables nécessaires
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      // Table des groupes de connexions
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS connection_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL DEFAULT '#1890ff',
          icon TEXT,
          expanded BOOLEAN NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Table des connexions
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('mysql', 'postgresql', 'sqlite', 'redis')),
          host TEXT NOT NULL,
          port INTEGER NOT NULL,
          username TEXT NOT NULL,
          password TEXT NOT NULL, -- Chiffré
          database_name TEXT,
          ssl BOOLEAN NOT NULL DEFAULT 0,
          ssl_cert TEXT,
          ssl_key TEXT,
          ssl_ca TEXT,
          group_id TEXT,
          color TEXT,
          is_active BOOLEAN NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_connected DATETIME,
          FOREIGN KEY (group_id) REFERENCES connection_groups (id) ON DELETE SET NULL
        )
      `);

      // Table de l'historique des requêtes
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS query_history (
          id TEXT PRIMARY KEY,
          connection_id TEXT NOT NULL,
          query TEXT NOT NULL,
          execution_time INTEGER, -- en millisecondes
          rows_affected INTEGER,
          status TEXT NOT NULL CHECK (status IN ('success', 'error')),
          error_message TEXT,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (connection_id) REFERENCES connections (id) ON DELETE CASCADE
        )
      `);

      // Table des favoris
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS favorites (
          id TEXT PRIMARY KEY,
          connection_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('query', 'table', 'database')),
          name TEXT NOT NULL,
          content TEXT NOT NULL, -- Requête SQL ou nom de table/base
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (connection_id) REFERENCES connections (id) ON DELETE CASCADE
        )
      `);

      // Index pour améliorer les performances
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_connections_group ON connections (group_id);
        CREATE INDEX IF NOT EXISTS idx_query_history_connection ON query_history (connection_id);
        CREATE INDEX IF NOT EXISTS idx_query_history_executed ON query_history (executed_at);
        CREATE INDEX IF NOT EXISTS idx_favorites_connection ON favorites (connection_id);
      `);

      // Migration pour ajouter Redis au type CHECK constraint (si la table existe déjà)
      await this.migrateRedisSupport();
      
      logger.info("Tables créées avec succès");
    } catch (error) {
      logger.error('Erreur lors de la création des tables:', error as Error);
      throw error;
    }
  }

  /**
   * Sauvegarde une connexion
   */
  async saveConnection(connection: DatabaseConnection): Promise<void> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO connections (
          id, name, type, host, port, username, password, database_name,
          ssl, ssl_cert, ssl_key, ssl_ca, group_id, color, is_active,
          created_at, updated_at, last_connected
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        connection.id,
        connection.name,
        connection.type,
        connection.host,
        connection.port,
        connection.username,
        connection.password, // Déjà chiffré
        connection.database,
        connection.ssl ? 1 : 0,
        connection.sslCert,
        connection.sslKey,
        connection.sslCa,
        connection.group,
        connection.color,
        connection.isActive ? 1 : 0,
        connection.createdAt.toISOString(),
        connection.updatedAt.toISOString(),
        connection.lastConnected?.toISOString()
      );

      logger.info(`Connexion sauvegardée: ${connection.name}`);
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère toutes les connexions
   */
  async getAllConnections(): Promise<DatabaseConnection[]> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM connections 
        WHERE is_active = 1
        ORDER BY name ASC
      `);
      
      const rows = stmt.all() as any[];
      
      return rows.map(this.mapRowToConnection);
    } catch (error) {
      logger.error('Erreur lors de la récupération des connexions:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère une connexion par ID
   */
  async getConnectionById(id: string, includeInactive: boolean = false): Promise<DatabaseConnection | null> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      const condition = includeInactive ? 'id = ?' : 'id = ? AND is_active = 1';
      const stmt = this.db.prepare(`SELECT * FROM connections WHERE ${condition}`);
      const row = stmt.get(id) as any;
      
      return row ? this.mapRowToConnection(row) : null;
    } catch (error) {
      logger.error('Erreur lors de la récupération de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Supprime une connexion
   */
  async deleteConnection(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      const stmt = this.db.prepare('UPDATE connections SET is_active = 0, updated_at = ? WHERE id = ?');
      stmt.run(new Date().toISOString(), id);
      
      logger.info(`Connexion supprimée: ${id}`);
    } catch (error) {
      logger.error('Erreur lors de la suppression de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Met à jour la dernière connexion
   */
  async updateLastConnected(id: string): Promise<void> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      const stmt = this.db.prepare(`
        UPDATE connections 
        SET last_connected = ?, updated_at = ? 
        WHERE id = ?
      `);
      
      const now = new Date().toISOString();
      stmt.run(now, now, id);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de last_connected:', error as Error);
      throw error;
    }
  }

  /**
   * Convertit une ligne de base de données en objet DatabaseConnection
   */
  private mapRowToConnection(row: any): DatabaseConnection {
    return {
      id: row.id,
      name: row.name,
      type: row.type as 'mysql' | 'postgresql' | 'sqlite' | 'redis',
      host: row.host,
      port: row.port,
      username: row.username,
      password: row.password, // Reste chiffré jusqu'au déchiffrement
      database: row.database_name,
      ssl: Boolean(row.ssl),
      sslCert: row.ssl_cert,
      sslKey: row.ssl_key,
      sslCa: row.ssl_ca,
      group: row.group_id,
      color: row.color,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastConnected: row.last_connected ? new Date(row.last_connected) : undefined
    };
  }

  /**
   * Migration pour ajouter le support Redis aux bases de données existantes
   */
  private async migrateRedisSupport(): Promise<void> {
    if (!this.db) {
      throw new Error('Base de données non initialisée');
    }

    try {
      // Vérifier si la table existe et si la contrainte a déjà été mise à jour
      const tableInfo = this.db.pragma('table_info(connections)') as any[];
      const typeColumn = tableInfo.find((col: any) => col.name === 'type');
      
      if (typeColumn) {
        // Tenter de créer une table temporaire avec la nouvelle contrainte
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS connections_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('mysql', 'postgresql', 'sqlite', 'redis')),
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            database_name TEXT,
            ssl BOOLEAN NOT NULL DEFAULT 0,
            ssl_cert TEXT,
            ssl_key TEXT,
            ssl_ca TEXT,
            group_id TEXT,
            color TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_connected DATETIME,
            FOREIGN KEY (group_id) REFERENCES connection_groups (id) ON DELETE SET NULL
          )
        `);
        
        // Copier les données existantes
        this.db.exec(`
          INSERT OR IGNORE INTO connections_new 
          SELECT * FROM connections
        `);
        
        // Remplacer l'ancienne table
        this.db.exec(`DROP TABLE IF EXISTS connections`);
        this.db.exec(`ALTER TABLE connections_new RENAME TO connections`);
        
        // Recréer les index
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_connections_group ON connections (group_id)`);
        
        logger.info('Migration Redis complétée avec succès');
      }
    } catch (error) {
      // Si la migration échoue, c'est probablement que la contrainte est déjà à jour
      logger.warn('Migration Redis ignorée (probablement déjà appliquée):', error as Error);
    }
  }

  /**
   * Ferme la connexion à la base de données
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Base de données fermée');
    }
  }
}

// Instance singleton
export const storageService = StorageService.getInstance();