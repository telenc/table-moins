import { BaseDatabaseDriver } from './drivers/base-driver';
import { DriverFactory } from './drivers/driver-factory';
import { DatabaseConnection } from '../shared/types/database';
import { Logger } from '../shared/utils/logger';
import { encryptionService } from '../shared/utils/encryption';
import { storageService } from './storage-service';

export interface TabConnection {
  id: string;
  connectionId: string;
  connection: DatabaseConnection;
  driver?: BaseDatabaseDriver;
  isConnected: boolean;
  connectedAt?: Date;
}

const logger = new Logger('ConnectionService');

export class ConnectionService {
  private static instance: ConnectionService;
  private connections = new Map<string, BaseDatabaseDriver>();
  private activeConnections = new Set<string>();
  private connectionTabs = new Map<string, TabConnection>(); // tabId -> connection info

  private constructor() {}

  static getInstance(): ConnectionService {
    if (!ConnectionService.instance) {
      ConnectionService.instance = new ConnectionService();
    }
    return ConnectionService.instance;
  }

  /**
   * Initialise le service de connexions
   */
  async initialize(testPath?: string): Promise<void> {
    try {
      logger.info('Initialisation du service de connexions...');
      
      // Initialiser le service de stockage (uniquement s'il n'est pas déjà initialisé)
      if (testPath) {
        await storageService.initialize(testPath);
      } else {
        try {
          await storageService.initialize();
        } catch (error) {
          // Si le service de stockage est déjà initialisé, ignorer l'erreur
          if (!(error as Error).message.includes('déjà initialisé')) {
            throw error;
          }
        }
      }
      
      // Charger les connexions existantes
      await this.loadSavedConnections();
      
      logger.info('Service de connexions initialisé');
    } catch (error) {
      logger.error('Erreur lors de l\'initialisation du service de connexions:', error as Error);
      throw error;
    }
  }

  /**
   * Crée et sauvegarde une nouvelle connexion
   */
  async createConnection(connectionData: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Vérifier que le service de chiffrement est initialisé
      if (!encryptionService.isInitialized()) {
        throw new Error('Service de chiffrement non initialisé');
      }

      // Générer un ID unique
      const id = encryptionService.generateId();
      
      // Chiffrer le mot de passe
      const encryptedPassword = await encryptionService.encrypt(connectionData.password);
      
      // Créer l'objet connexion complet
      const connection: DatabaseConnection = {
        ...connectionData,
        id,
        password: encryptedPassword,
        isActive: true, // Ajouter isActive par défaut
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Sauvegarder dans la base locale
      await storageService.saveConnection(connection);
      
      logger.info(`Connexion créée: ${connection.name} (${connection.type})`);
      return id;
    } catch (error) {
      logger.error('Erreur lors de la création de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Met à jour une connexion existante
   */
  async updateConnection(id: string, connectionData: Partial<Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    try {
      // Récupérer la connexion existante (incluant les connexions inactives)
      const existingConnection = await storageService.getConnectionById(id, true);
      if (!existingConnection) {
        throw new Error(`Connexion non trouvée: ${id}`);
      }

      // Préparer les données de mise à jour
      const updateData: Partial<DatabaseConnection> = {
        ...connectionData,
        isActive: true, // Réactiver la connexion lors de la mise à jour
        updatedAt: new Date(),
      };

      // Chiffrer le nouveau mot de passe si fourni
      if (connectionData.password) {
        if (!encryptionService.isInitialized()) {
          throw new Error('Service de chiffrement non initialisé');
        }
        console.log('🔐 DEBUG - Mot de passe avant chiffrement:', connectionData.password);
        updateData.password = await encryptionService.encrypt(connectionData.password);
        console.log('🔐 DEBUG - Mot de passe chiffré:', updateData.password.substring(0, 50) + '...');
      }

      // Créer la connexion mise à jour
      const updatedConnection: DatabaseConnection = {
        ...existingConnection,
        ...updateData,
        id, // S'assurer que l'ID reste le même
      };

      // Sauvegarder dans la base locale
      await storageService.saveConnection(updatedConnection);
      
      logger.info(`Connexion mise à jour: ${updatedConnection.name} (${id})`);
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Teste une connexion sans la sauvegarder
   */
  async testConnection(connectionData: Omit<DatabaseConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      console.log('🧪 DEBUG - Test connexion avec mot de passe:', connectionData.password);
      
      // Créer une connexion temporaire pour le test
      const tempConnection: DatabaseConnection = {
        ...connectionData,
        id: 'temp-test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const driver = DriverFactory.createDriver(tempConnection);
      const result = await driver.testConnection();
      
      logger.info(`Test de connexion ${result ? 'réussi' : 'échoué'}: ${connectionData.name}`);
      return result;
    } catch (error) {
      logger.error('Erreur lors du test de connexion:', error as Error);
      return false;
    }
  }

  /**
   * Se connecte à une base de données et crée un nouvel onglet
   */
  async connect(connectionId: string): Promise<string> {
    try {
      // Récupérer la connexion depuis la base (inclure les inactives)
      const connection = await storageService.getConnectionById(connectionId, true);
      if (!connection) {
        throw new Error(`Connexion non trouvée: ${connectionId}`);
      }

      // Générer un ID unique pour l'onglet
      const tabId = encryptionService.generateId();

      // Créer l'objet TabConnection
      const tabConnection: TabConnection = {
        id: tabId,
        connectionId,
        connection,
        isConnected: false
      };

      // Stocker la tab connection
      this.connectionTabs.set(tabId, tabConnection);

      logger.info(`Nouvel onglet créé pour: ${connection.name} (${tabId})`);
      return tabId;
    } catch (error) {
      logger.error('Erreur lors de la création de l\'onglet:', error as Error);
      throw error;
    }
  }

  /**
   * Connecte effectivement un onglet à sa base de données
   */
  async connectTab(tabId: string): Promise<void> {
    try {
      const tabConnection = this.connectionTabs.get(tabId);
      if (!tabConnection) {
        throw new Error(`Onglet non trouvé: ${tabId}`);
      }

      if (tabConnection.isConnected && tabConnection.driver) {
        logger.debug(`Onglet déjà connecté: ${tabId}`);
        return;
      }

      // Déchiffrer le mot de passe
      console.log('🔓 DEBUG - Mot de passe chiffré récupéré:', tabConnection.connection.password.substring(0, 50) + '...');
      const decryptedPassword = await encryptionService.decrypt(tabConnection.connection.password);
      console.log('🔓 DEBUG - Mot de passe après déchiffrement:', decryptedPassword);
      const connectionWithDecryptedPassword = {
        ...tabConnection.connection,
        password: decryptedPassword,
      };

      // Créer et connecter le driver
      const driver = DriverFactory.createDriver(connectionWithDecryptedPassword);
      await driver.connect();

      // Mettre à jour la tab connection
      tabConnection.driver = driver;
      tabConnection.isConnected = true;
      tabConnection.connectedAt = new Date();

      // Ajouter aux connexions actives pour compatibilité
      this.connections.set(tabId, driver);
      this.activeConnections.add(tabId);

      // Mettre à jour la dernière connexion
      await storageService.updateLastConnected(tabConnection.connectionId);

      logger.info(`Onglet connecté: ${tabConnection.connection.name} (${tabId})`);
    } catch (error) {
      logger.error('Erreur lors de la connexion de l\'onglet:', error as Error);
      throw error;
    }
  }

  /**
   * Se déconnecte d'une base de données (onglet)
   */
  async disconnect(tabId: string): Promise<void> {
    try {
      const tabConnection = this.connectionTabs.get(tabId);
      const driver = this.connections.get(tabId);
      
      if (driver) {
        await driver.disconnect();
        this.connections.delete(tabId);
        this.activeConnections.delete(tabId);
      }

      if (tabConnection) {
        tabConnection.isConnected = false;
        tabConnection.driver = undefined;
        tabConnection.connectedAt = undefined;
      }

      logger.info(`Onglet déconnecté: ${tabId}`);
    } catch (error) {
      logger.error('Erreur lors de la déconnexion:', error as Error);
      throw error;
    }
  }

  /**
   * Déconnecte toutes les connexions actives
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.activeConnections).map(
      tabId => this.disconnect(tabId)
    );
    
    await Promise.all(disconnectPromises);
    logger.info('Toutes les connexions ont été fermées');
  }

  /**
   * Récupère un driver de connexion active
   */
  getDriver(tabId: string): BaseDatabaseDriver | null {
    return this.connections.get(tabId) || null;
  }

  /**
   * Vérifie si une connexion est active
   */
  isConnected(tabId: string): boolean {
    const tabConnection = this.connectionTabs.get(tabId);
    return tabConnection?.isConnected || false;
  }

  /**
   * Récupère toutes les connexions sauvegardées
   */
  async getAllConnections(): Promise<DatabaseConnection[]> {
    try {
      logger.info('🔍 Début de getAllConnections()');
      const connections = await storageService.getAllConnections();
      logger.info(`📊 ${connections.length} connexions trouvées dans la base`);
      console.log('🗃️ Connexions dans la base:', connections.map(c => ({ id: c.id, name: c.name, host: c.host })));
      return connections;
    } catch (error) {
      logger.error('Erreur lors de la récupération des connexions:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère une connexion par ID
   */
  async getConnection(connectionId: string): Promise<DatabaseConnection | null> {
    try {
      return await storageService.getConnectionById(connectionId);
    } catch (error) {
      logger.error('Erreur lors de la récupération de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Supprime une connexion
   */
  async deleteConnection(connectionId: string): Promise<void> {
    try {
      // Fermer tous les onglets utilisant cette connexion
      const tabsToClose = Array.from(this.connectionTabs.values())
        .filter(tab => tab.connectionId === connectionId)
        .map(tab => tab.id);
      
      for (const tabId of tabsToClose) {
        await this.closeTab(tabId);
      }

      // Supprimer de la base
      await storageService.deleteConnection(connectionId);

      logger.info(`Connexion supprimée: ${connectionId}`);
    } catch (error) {
      logger.error('Erreur lors de la suppression de la connexion:', error as Error);
      throw error;
    }
  }

  /**
   * Récupère la liste des connexions actives
   */
  getActiveConnections(): string[] {
    return Array.from(this.activeConnections);
  }

  /**
   * Récupère tous les onglets
   */
  getAllTabs(): TabConnection[] {
    return Array.from(this.connectionTabs.values()).map(tab => ({
      id: tab.id,
      connectionId: tab.connectionId,
      connection: tab.connection,
      isConnected: tab.isConnected,
      connectedAt: tab.connectedAt
      // Exclure le driver pour éviter les problèmes de sérialisation
    }));
  }

  /**
   * Récupère un onglet par ID
   */
  getTab(tabId: string): TabConnection | null {
    return this.connectionTabs.get(tabId) || null;
  }

  /**
   * Ferme un onglet
   */
  async closeTab(tabId: string): Promise<void> {
    try {
      // Déconnecter d'abord si connecté
      if (this.isConnected(tabId)) {
        await this.disconnect(tabId);
      }

      // Supprimer l'onglet
      this.connectionTabs.delete(tabId);
      
      logger.info(`Onglet fermé: ${tabId}`);
    } catch (error) {
      logger.error('Erreur lors de la fermeture de l\'onglet:', error as Error);
      throw error;
    }
  }

  /**
   * Ferme tous les onglets
   */
  async closeAllTabs(): Promise<void> {
    const tabIds = Array.from(this.connectionTabs.keys());
    const closePromises = tabIds.map(tabId => this.closeTab(tabId));
    
    await Promise.all(closePromises);
    logger.info('Tous les onglets ont été fermés');
  }

  /**
   * Charge les connexions sauvegardées (sans mot de passe)
   */
  private async loadSavedConnections(): Promise<void> {
    try {
      const connections = await storageService.getAllConnections();
      logger.info(`${connections.length} connexion(s) chargée(s)`);
    } catch (error) {
      logger.error('Erreur lors du chargement des connexions:', error as Error);
      // Ne pas faire échouer l'initialisation
    }
  }

  /**
   * Nettoie les ressources
   */
  async cleanup(): Promise<void> {
    await this.closeAllTabs();
    await storageService.close();
    logger.info('Service de connexions nettoyé');
  }
}

// Instance singleton
export const connectionService = ConnectionService.getInstance();