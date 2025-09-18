import { BaseDatabaseDriver } from './base-driver';
import { MySQLDriver } from './mysql-driver';
import { PostgreSQLDriver } from './postgresql-driver';
import { RedisDriver } from './redis-driver';
import { DatabaseConnection, DatabaseType } from '../../shared/types/database';

export class DriverFactory {
  /**
   * Crée un driver pour le type de base de données spécifié
   */
  static createDriver(connection: DatabaseConnection): BaseDatabaseDriver {
    switch (connection.type) {
      case 'mysql':
        return new MySQLDriver(connection);
      case 'postgresql':
        return new PostgreSQLDriver(connection);
      case 'redis':
        return new RedisDriver(connection);
      case 'sqlite':
        throw new Error('SQLite driver pas encore implémenté');
      default:
        throw new Error(`Type de base de données non supporté: ${connection.type}`);
    }
  }

  /**
   * Vérifie si un type de base de données est supporté
   */
  static isSupported(type: DatabaseType): boolean {
    return ['mysql', 'postgresql', 'redis'].includes(type);
  }

  /**
   * Récupère la liste des types supportés
   */
  static getSupportedTypes(): DatabaseType[] {
    return ['mysql', 'postgresql', 'redis'];
  }
}