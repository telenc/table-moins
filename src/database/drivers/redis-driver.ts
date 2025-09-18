import { createClient, RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts } from 'redis';
import { BaseDatabaseDriver } from './base-driver';
import { 
  DatabaseConnection, 
  DatabaseInfo, 
  RedisKeyInfo, 
  RedisValueInfo, 
  RedisCommandResult, 
  RedisDatabaseInfo,
  RedisDataType 
} from '../../shared/types/database';
import { Logger } from '../../shared/utils/logger';

const logger = new Logger('RedisDriver');

export class RedisDriver extends BaseDatabaseDriver {
  private client: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> | null = null;

  constructor(connection: DatabaseConnection) {
    super(connection);
  }

  /**
   * Teste la connexion à Redis
   */
  async testConnection(): Promise<boolean> {
    try {
      const config = this.getRedisConnectionConfig();
      logger.info('Configuration de connexion Redis:', {
        host: config.socket?.host,
        port: config.socket?.port,
        database: config.database
      });
      
      const testClient = createClient(config);
      logger.info('Tentative de connexion à Redis...');
      await testClient.connect();
      logger.info('Connexion établie, test de commande...');
      await testClient.ping();
      logger.info('Test de commande réussi, fermeture de la connexion...');
      await testClient.disconnect();
      logger.info('Test de connexion Redis réussi');
      return true;
    } catch (error) {
      logger.error('Test de connexion Redis échoué:', error as Error);
      return false;
    }
  }

  /**
   * Se connecte à Redis
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected && this.client) {
        return;
      }

      const config = this.getRedisConnectionConfig();
      this.client = createClient(config);
      
      // Gestion des erreurs du client
      this.client.on('error', (err) => {
        logger.error('Erreur du client Redis:', err);
      });

      this.client.on('connect', () => {
        logger.info('Connexion Redis établie');
      });

      this.client.on('disconnect', () => {
        logger.info('Connexion Redis fermée');
      });

      await this.client.connect();
      
      // Test de la connexion
      await this.client.ping();

      this.isConnected = true;
      logger.info(`Connecté à Redis: ${this.connection.host}:${this.connection.port}`);
    } catch (error) {
      logger.error('Erreur de connexion Redis:', error as Error);
      this.isConnected = false;
      throw new Error(`Connexion Redis échouée: ${(error as Error).message}`);
    }
  }

  /**
   * Se déconnecte de Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      this.isConnected = false;
      logger.info('Déconnecté de Redis');
    } catch (error) {
      logger.error('Erreur lors de la déconnexion Redis:', error as Error);
      throw error;
    }
  }

  /**
   * Exécute une commande Redis
   */
  async executeCommand(command: string[]): Promise<RedisCommandResult> {
    if (!this.client || !this.isConnected) {
      throw new Error('Non connecté à Redis');
    }

    const startTime = Date.now();
    
    try {
      // Execute the command using the client
      const [cmd, ...args] = command;
      let result: any;
      
      // Handle common Redis commands
      switch (cmd.toUpperCase()) {
        case 'GET':
          result = await this.client.get(args[0]);
          break;
        case 'SET':
          result = await this.client.set(args[0], args[1]);
          break;
        case 'KEYS':
          result = await this.client.keys(args[0] || '*');
          break;
        case 'PING':
          result = await this.client.ping();
          break;
        case 'INFO':
          result = await this.client.info(args[0]);
          break;
        default:
          // For other commands, use sendCommand
          result = await this.client.sendCommand(command);
      }

      const executionTime = Date.now() - startTime;
      
      return {
        command,
        result,
        type: 'success',
        executionTime,
        affectedKeys: this.extractAffectedKeys(command, result)
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        command,
        result: (error as Error).message,
        type: 'error',
        executionTime
      };
    }
  }

  /**
   * Récupère les informations sur la base de données Redis
   */
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    if (!this.client || !this.isConnected) {
      throw new Error('Non connecté à Redis');
    }

    try {
      const info = await this.client.info();
      const lines = info.split('\r\n');
      const serverInfo: any = {};
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          serverInfo[key] = value;
        }
      }

      return {
        name: 'Redis',
        version: serverInfo.redis_version || 'Unknown',
        charset: 'UTF-8',
        collation: 'N/A',
        tableCount: 0, // Redis doesn't have tables
        connectionCount: parseInt(serverInfo.connected_clients) || 0
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des informations Redis:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère la liste des bases de données (Redis databases 0-15)
   */
  async getDatabases(): Promise<string[]> {
    // Redis has databases 0-15 by default
    return Array.from({ length: 16 }, (_, i) => i.toString());
  }

  /**
   * Récupère les clés Redis avec pagination (utilise SCAN au lieu de KEYS)
   */
  async getKeys(pattern: string = '*', database?: string, cursor: string = '0', count: number = 100): Promise<{ keys: RedisKeyInfo[], cursor: string, hasMore: boolean }> {
    if (!this.client || !this.isConnected) {
      throw new Error('Non connecté à Redis');
    }

    try {
      logger.info(`🚀 Starting SCAN - database: ${database}, cursor: ${cursor}, count: ${count}`);

      // Change database if specified
      if (database && database !== '0') {
        await this.client.select(parseInt(database));
        logger.info(`✅ Selected database ${database}`);
      }

      // Like Medis: No pattern filtering, just get all keys fast
      const scanResult = await this.client.scan(cursor, {
        COUNT: Math.max(count, 1000) // Au moins 1000 pour être plus rapide
      });

      logger.info(`📊 SCAN result - found ${scanResult.keys.length} keys, next cursor: ${scanResult.cursor}`);

      const keys = scanResult.keys;
      const nextCursor = scanResult.cursor;

      // Super fast: just return keys without any metadata (like Medis)
      const keyInfos: RedisKeyInfo[] = keys.map(key => ({
        key,
        type: 'string' as RedisDataType, // Default type, will be loaded on demand when needed
        ttl: -1
      }));

      return {
        keys: keyInfos,
        cursor: nextCursor,
        hasMore: nextCursor !== '0'
      };
    } catch (error) {
      logger.error('Erreur lors de la récupération des clés Redis:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère la valeur d'une clé Redis
   */
  async getKeyValue(key: string): Promise<RedisValueInfo> {
    if (!this.client || !this.isConnected) {
      throw new Error('Non connecté à Redis');
    }

    try {
      const type = await this.client.type(key) as RedisDataType;
      const ttl = await this.client.ttl(key);
      let value: any;
      let size = 0;

      switch (type) {
        case 'string':
          value = await this.client.get(key);
          size = value ? value.length : 0;
          break;
        case 'hash':
          value = await this.client.hGetAll(key);
          size = Object.keys(value).length;
          break;
        case 'list':
          value = await this.client.lRange(key, 0, -1);
          size = value.length;
          break;
        case 'set':
          value = await this.client.sMembers(key);
          size = value.length;
          break;
        case 'zset':
          value = await this.client.zRangeWithScores(key, 0, -1);
          size = value.length;
          break;
        default:
          value = null;
      }

      return {
        key,
        type,
        value,
        size,
        ttl,
        encoding: await this.client.objectEncoding(key).catch(() => undefined) || undefined
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la valeur pour la clé ${key}:`, error as Error);
      throw error;
    }
  }

  /**
   * Version simple pour compatibilité (récupère seulement les premières clés)
   */
  async getKeysSimple(pattern: string = '*', database?: string, limit: number = 100): Promise<RedisKeyInfo[]> {
    const result = await this.getKeys(pattern, database, '0', limit);
    return result.keys;
  }

  /**
   * Supprime toutes les clés commençant par un préfixe (pour les dossiers)
   */
  async deleteKeysByPattern(pattern: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      throw new Error('Non connecté à Redis');
    }

    try {
      logger.info(`🗑️ Deleting keys with pattern: ${pattern}`);

      // Utiliser SCAN pour trouver toutes les clés correspondantes
      const matchingKeys: string[] = [];
      let cursor = '0';

      do {
        const scanResult = await this.client.scan(cursor, {
          MATCH: pattern,
          COUNT: 1000
        });

        matchingKeys.push(...scanResult.keys);
        cursor = scanResult.cursor;
      } while (cursor !== '0');

      logger.info(`📊 Found ${matchingKeys.length} keys to delete`);

      if (matchingKeys.length === 0) {
        return 0;
      }

      // Supprimer les clés par batch pour éviter de surcharger Redis
      const batchSize = 100;
      let deletedCount = 0;

      for (let i = 0; i < matchingKeys.length; i += batchSize) {
        const batch = matchingKeys.slice(i, i + batchSize);
        const deleted = await this.client.del(batch);
        deletedCount += deleted;
      }

      logger.info(`✅ Successfully deleted ${deletedCount} keys`);
      return deletedCount;
    } catch (error) {
      logger.error('Erreur lors de la suppression des clés:', error as Error);
      throw error;
    }
  }

  /**
   * Méthodes requises par BaseDatabaseDriver mais non applicables pour Redis
   */
  async getTables(): Promise<any[]> {
    // Redis doesn't have tables, return keys instead
    return this.getKeysSimple();
  }

  async getColumns(): Promise<any[]> {
    // Redis doesn't have columns
    return [];
  }

  async getTableData(): Promise<any> {
    throw new Error('getTableData not applicable for Redis. Use getKeyValue instead.');
  }

  async executeQuery(): Promise<any> {
    throw new Error('executeQuery not applicable for Redis. Use executeCommand instead.');
  }

  /**
   * Configuration de connexion Redis
   */
  private getRedisConnectionConfig() {
    logger.info('🔍 DEBUG - Connection object:', {
      host: this.connection.host,
      port: this.connection.port,
      database: this.connection.database,
      username: this.connection.username,
      password: this.connection.password ? '***MASKED***' : 'undefined'
    });

    const config: any = {
      socket: {
        host: this.connection.host,
        port: this.connection.port,
      },
      database: parseInt(this.connection.database as string) || 0,
    };

    // Ajouter l'authentification si fournie
    if (this.connection.password) {
      config.password = this.connection.password;
      logger.info('🔑 DEBUG - Password added to config', {});
    } else {
      logger.info('❌ DEBUG - No password in connection object', {});
    }

    // Support ACL Redis v6+ (username + password)
    if (this.connection.username && this.connection.username !== 'default') {
      config.username = this.connection.username;
      logger.info('👤 DEBUG - Username added to config:', { username: this.connection.username });
    } else {
      logger.info('👤 DEBUG - No username or default username', {});
    }

    logger.info('🔧 DEBUG - Final config:', {
      ...config,
      password: config.password ? '***MASKED***' : 'undefined'
    });

    return config;
  }

  /**
   * Échappe les identifiants (non applicable pour Redis)
   */
  protected escapeIdentifier(identifier: string): string {
    return identifier;
  }

  /**
   * Échappe les valeurs (non applicable pour Redis)
   */
  protected escapeValue(value: any): string {
    return String(value);
  }

  /**
   * Extrait les clés affectées par une commande
   */
  private extractAffectedKeys(command: string[], result: any): string[] | undefined {
    const [cmd, ...args] = command;
    
    switch (cmd.toUpperCase()) {
      case 'SET':
      case 'GET':
      case 'DEL':
        return args.slice(0, 1);
      case 'MGET':
      case 'MSET':
        return args;
      default:
        return undefined;
    }
  }
}