import { ipcMain, BrowserWindow, dialog, app } from 'electron';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Logger } from '../shared/utils/logger';
import { connectionService } from '../database/connection-service';
import { encryptionService } from '../shared/utils/encryption';

const logger = new Logger('IPC');

// Auto-save directory for SQL files
const getSqlAutoSaveDirectory = () => {
  return join(app.getPath('userData'), 'sql-files');
};

// Create auto-save directory if it doesn't exist
const ensureSqlAutoSaveDirectory = async () => {
  const sqlDir = getSqlAutoSaveDirectory();
  try {
    await fs.access(sqlDir);
  } catch {
    await fs.mkdir(sqlDir, { recursive: true });
    logger.info(`SQL auto-save directory created: ${sqlDir}`);
  }
  return sqlDir;
};

export function setupIpcHandlers(mainWindow: BrowserWindow | null): void {
  // Handler for file dialogs
  ipcMain.handle('dialog:open-file', async (_, options) => {
    try {
      if (!mainWindow) return { canceled: true };
      
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        ...options,
      });
      
      return result;
    } catch (error) {
      logger.error('Error opening file dialog:', error as Error);
      return { canceled: true };
    }
  });

  ipcMain.handle('dialog:save-file', async (_, options) => {
    try {
      if (!mainWindow) return { canceled: true };
      
      const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'JSON Files', extensions: ['json'] },
        ],
        ...options,
      });
      
      return result;
    } catch (error) {
      logger.error('Error saving file dialog:', error as Error);
      return { canceled: true };
    }
  });

  // Handler for system information
  ipcMain.handle('system:get-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.versions,
    };
  });

  // Handler for logs
  ipcMain.on('log:info', (_, message) => {
    logger.info(`[Renderer] ${message}`);
  });

  ipcMain.on('log:warn', (_, message) => {
    logger.warn(`[Renderer] ${message}`);
  });

  ipcMain.on('log:error', (_, message, error) => {
    logger.error(`[Renderer] ${message}`, error);
  });

  // Gestionnaire pour la configuration de la fenêtre
  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return mainWindow.isMaximized();
    }
    return false;
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // === Gestionnaires pour les connexions ===
  
  // Récupérer toutes les connexions
  ipcMain.handle('connections:get-all', async () => {
    try {
      return await connectionService.getAllConnections();
    } catch (error) {
      logger.error('Erreur lors de la récupération des connexions:', error as Error);
      throw error;
    }
  });

  // Récupérer une connexion par ID
  ipcMain.handle('connections:get-by-id', async (_, id: string) => {
    try {
      return await connectionService.getConnection(id);
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la connexion ${id}:`, error as Error);
      throw error;
    }
  });

  // Récupérer une connexion par ID avec mot de passe déchiffré (pour édition)
  ipcMain.handle('connections:get-for-edit', async (_, id: string) => {
    try {
      const connection = await connectionService.getConnection(id);
      if (!connection) {
        return null;
      }
      
      // Déchiffrer le mot de passe pour l'édition
      if (!encryptionService.isInitialized()) {
        await encryptionService.initialize('master-password-temp');
      }
      
      const decryptedPassword = await encryptionService.decrypt(connection.password);
      
      return {
        ...connection,
        password: decryptedPassword
      };
    } catch (error) {
      logger.error(`Erreur lors de la récupération de la connexion pour édition ${id}:`, error as Error);
      throw error;
    }
  });

  // Créer une nouvelle connexion
  ipcMain.handle('connections:create', async (_, data: any) => {
    try {
      // S'assurer que le service de chiffrement est initialisé
      if (!encryptionService.isInitialized()) {
        await encryptionService.initialize('master-password-temp'); // TODO: gérer le master password
      }
      
      const id = await connectionService.createConnection(data);
      logger.info(`Connexion créée avec succès: ${data.name} (${id})`);
      return id;
    } catch (error) {
      logger.error('Erreur lors de la création de la connexion:', error as Error);
      throw error;
    }
  });

  // Mettre à jour une connexion
  ipcMain.handle('connections:update', async (_, id: string, data: any) => {
    try {
      await connectionService.updateConnection(id, data);
      logger.info(`Connexion mise à jour: ${id}`);
    } catch (error) {
      logger.error(`Erreur lors de la mise à jour de la connexion ${id}:`, error as Error);
      throw error;
    }
  });

  // Supprimer une connexion
  ipcMain.handle('connections:delete', async (_, id: string) => {
    try {
      await connectionService.deleteConnection(id);
      logger.info(`Connexion supprimée: ${id}`);
    } catch (error) {
      logger.error(`Erreur lors de la suppression de la connexion ${id}:`, error as Error);
      throw error;
    }
  });

  // Tester une connexion
  ipcMain.handle('connections:test', async (_, data: any) => {
    try {
      const result = await connectionService.testConnection(data);
      return {
        success: result,
        message: result ? 'Connexion réussie' : 'Échec de la connexion',
      };
    } catch (error) {
      logger.error('Erreur lors du test de connexion:', error as Error);
      return {
        success: false,
        message: 'Erreur lors du test de connexion',
        details: (error as Error).message,
      };
    }
  });

  // Se connecter à une base de données (crée un nouvel onglet)
  ipcMain.handle('connections:connect', async (_, id: string) => {
    try {
      const tabId = await connectionService.connect(id);
      logger.info(`Nouvel onglet créé pour la base de données: ${id} -> ${tabId}`);
      return tabId;
    } catch (error) {
      logger.error(`Erreur lors de la création d'onglet pour ${id}:`, error as Error);
      throw error;
    }
  });

  // Connecter effectivement un onglet
  ipcMain.handle('tabs:connect', async (_, tabId: string) => {
    try {
      await connectionService.connectTab(tabId);
      logger.info(`Onglet connecté: ${tabId}`);
    } catch (error) {
      logger.error(`Erreur lors de la connexion de l'onglet ${tabId}:`, error as Error);
      throw error;
    }
  });

  // Se déconnecter d'un onglet
  ipcMain.handle('tabs:disconnect', async (_, tabId: string) => {
    try {
      await connectionService.disconnect(tabId);
      logger.info(`Onglet déconnecté: ${tabId}`);
    } catch (error) {
      logger.error(`Erreur lors de la déconnexion de l'onglet ${tabId}:`, error as Error);
      throw error;
    }
  });

  // Fermer un onglet
  ipcMain.handle('tabs:close', async (_, tabId: string) => {
    try {
      await connectionService.closeTab(tabId);
      logger.info(`Onglet fermé: ${tabId}`);
    } catch (error) {
      logger.error(`Erreur lors de la fermeture de l'onglet ${tabId}:`, error as Error);
      throw error;
    }
  });

  // Récupérer tous les onglets
  ipcMain.handle('tabs:get-all', async () => {
    try {
      return connectionService.getAllTabs();
    } catch (error) {
      logger.error('Erreur lors de la récupération des onglets:', error as Error);
      throw error;
    }
  });

  // Récupérer un onglet par ID
  ipcMain.handle('tabs:get-by-id', async (_, tabId: string) => {
    try {
      return connectionService.getTab(tabId);
    } catch (error) {
      logger.error(`Erreur lors de la récupération de l'onglet ${tabId}:`, error as Error);
      throw error;
    }
  });

  // === Gestionnaires pour les opérations de base de données ===
  
  // Récupérer les bases de données d'une connexion
  ipcMain.handle('database:get-databases', async (_, connectionId: string) => {
    try {
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        throw new Error('Connexion non trouvée ou non active');
      }
      return await driver.getDatabases();
    } catch (error) {
      logger.error(`Erreur lors de la récupération des bases pour ${connectionId}:`, error as Error);
      throw error;
    }
  });

  // Récupérer les schémas d'une connexion PostgreSQL
  ipcMain.handle('database:get-schemas', async (_, connectionId: string) => {
    try {
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        throw new Error('Connexion non trouvée ou non active');
      }
      
      // Vérifier si le driver supporte les schémas (PostgreSQL)
      if ('getSchemas' in driver && typeof driver.getSchemas === 'function') {
        return await (driver as any).getSchemas();
      } else {
        // Fallback pour les autres types de bases
        return await driver.getDatabases();
      }
    } catch (error) {
      logger.error(`Erreur lors de la récupération des schémas pour ${connectionId}:`, error as Error);
      throw error;
    }
  });

  // Changer de base de données pour une connexion existante
  ipcMain.handle('database:change-database', async (_, connectionId: string, newDatabase: string) => {
    try {
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        throw new Error('Connexion non trouvée ou non active');
      }
      
      // Pour PostgreSQL, on peut utiliser la commande USE ou reconnecter
      if ('changeDatabase' in driver && typeof driver.changeDatabase === 'function') {
        return await (driver as any).changeDatabase(newDatabase);
      } else {
        // Fallback: reconnecter avec la nouvelle base
        throw new Error('Change database not supported for this driver type');
      }
    } catch (error) {
      logger.error(`Erreur lors du changement de base pour ${connectionId}:`, error as Error);
      throw error;
    }
  });

  // Récupérer les tables d'une base de données
  ipcMain.handle('database:get-tables', async (_, connectionId: string, database?: string) => {
    try {
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        throw new Error('Connexion non trouvée ou non active');
      }
      return await driver.getTables(database);
    } catch (error) {
      logger.error(`Erreur lors de la récupération des tables pour ${connectionId}:`, error as Error);
      throw error;
    }
  });

  // Récupérer les colonnes d'une table
  ipcMain.handle('database:get-columns', async (_, connectionId: string, tableName: string, database?: string) => {
    try {
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        throw new Error('Connexion non trouvée ou non active');
      }
      return await driver.getColumns(tableName, database);
    } catch (error) {
      logger.error(`Erreur lors de la récupération des colonnes pour ${connectionId}.${tableName}:`, error as Error);
      throw error;
    }
  });

  // Exécuter une requête SQL
  ipcMain.handle('database:execute-query', async (_, connectionId: string, query: string) => {
    try {
      logger.info(`🔍 DEBUG IPC - Execute query for connection: ${connectionId}`);
      logger.info(`🔍 DEBUG IPC - Query: ${query}`);
      
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        logger.error(`🔍 DEBUG IPC - No driver found for connection: ${connectionId}`);
        throw new Error('Connexion non trouvée ou non active');
      }
      
      logger.info(`🔍 DEBUG IPC - Driver found, executing query...`);
      const result = await driver.executeQuery(query);
      logger.info(`🔍 DEBUG IPC - Query executed successfully`);
      return result;
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la requête pour ${connectionId}:`, error as Error);
      logger.error(`🔍 DEBUG IPC - Error details:`, error as Error);
      
      // Return error as an object instead of throwing
      return {
        error: error instanceof Error ? error.message : String(error),
        rows: [],
        columns: []
      };
    }
  });

  // Récupérer les données d'une table
  ipcMain.handle('database:get-table-data', async (_, connectionId: string, tableName: string, options?: any) => {
    try {
      const driver = connectionService.getDriver(connectionId);
      if (!driver) {
        throw new Error('Connexion non trouvée ou non active');
      }
      return await driver.getTableData(tableName, options);
    } catch (error) {
      logger.error(`Erreur lors de la récupération des données pour ${connectionId}.${tableName}:`, error as Error);
      throw error;
    }
  });

  // === Gestionnaires pour les fichiers SQL ===
  
  // Ouvrir un fichier SQL
  ipcMain.handle('sql-file:open', async () => {
    try {
      if (!mainWindow) return { canceled: true };
      
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Open SQL File',
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled) {
        return { canceled: true };
      }
      
      const filePath = result.filePaths[0];
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = filePath.split('/').pop() || 'Untitled.sql';
      
      return {
        canceled: false,
        filePath,
        fileName,
        content
      };
    } catch (error) {
      logger.error('Erreur lors de l\'ouverture du fichier SQL:', error as Error);
      throw error;
    }
  });
  
  // Sauvegarder un fichier SQL
  ipcMain.handle('sql-file:save', async (_, filePath: string | null, content: string, fileName?: string) => {
    try {
      if (!mainWindow) return { canceled: true };
      
      let targetPath = filePath;
      
      // Si aucun chemin n'est fourni, ouvrir la boîte de dialogue "Save As"
      if (!targetPath) {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Save SQL File',
          defaultPath: fileName || 'Untitled.sql',
          filters: [
            { name: 'SQL Files', extensions: ['sql'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        });
        
        if (result.canceled) {
          return { canceled: true };
        }
        
        targetPath = result.filePath;
      }
      
      if (!targetPath) {
        return { canceled: true };
      }
      
      // Créer le dossier parent si nécessaire
      await fs.mkdir(dirname(targetPath), { recursive: true });
      
      // Écrire le fichier
      await fs.writeFile(targetPath, content, 'utf-8');
      
      const savedFileName = targetPath.split('/').pop() || 'Untitled.sql';
      
      return {
        canceled: false,
        filePath: targetPath,
        fileName: savedFileName
      };
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde du fichier SQL:', error as Error);
      throw error;
    }
  });
  
  // Sauvegarder sous (Save As)
  ipcMain.handle('sql-file:save-as', async (_, content: string, fileName?: string) => {
    try {
      if (!mainWindow) return { canceled: true };
      
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save SQL File As',
        defaultPath: fileName || 'Untitled.sql',
        filters: [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      
      if (result.canceled) {
        return { canceled: true };
      }
      
      const targetPath = result.filePath;
      if (!targetPath) {
        return { canceled: true };
      }
      
      // Créer le dossier parent si nécessaire
      await fs.mkdir(dirname(targetPath), { recursive: true });
      
      // Écrire le fichier
      await fs.writeFile(targetPath, content, 'utf-8');
      
      const savedFileName = targetPath.split('/').pop() || 'Untitled.sql';
      
      return {
        canceled: false,
        filePath: targetPath,
        fileName: savedFileName
      };
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde du fichier SQL:', error as Error);
      throw error;
    }
  });

  // === Gestionnaires pour la sauvegarde automatique SQL ===
  
  // Sauvegarde automatique d'un fichier SQL
  ipcMain.handle('sql-editor:auto-save', async (_, tabId: string, content: string, fileName?: string) => {
    try {
      const sqlDir = await ensureSqlAutoSaveDirectory();
      
      // Générer un nom de fichier basé sur l'ID du tab si aucun nom n'est fourni
      const safeFileName = fileName || `editor-${tabId}.sql`;
      const filePath = join(sqlDir, safeFileName);
      
      // Sauvegarder le contenu
      await fs.writeFile(filePath, content, 'utf-8');
      
      logger.info(`Fichier SQL auto-sauvegardé: ${filePath}`);
      
      return {
        success: true,
        filePath,
        fileName: safeFileName
      };
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde automatique SQL:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  
  // Chargement d'un fichier SQL sauvegardé automatiquement
  ipcMain.handle('sql-editor:auto-load', async (_, tabId: string, fileName?: string) => {
    try {
      const sqlDir = getSqlAutoSaveDirectory();
      
      // Générer le nom de fichier basé sur l'ID du tab si aucun nom n'est fourni
      const safeFileName = fileName || `editor-${tabId}.sql`;
      const filePath = join(sqlDir, safeFileName);
      
      try {
        // Vérifier si le fichier existe
        await fs.access(filePath);
        
        // Lire le contenu
        const content = await fs.readFile(filePath, 'utf-8');
        
        logger.info(`Fichier SQL auto-chargé: ${filePath}`);
        
        return {
          success: true,
          content,
          filePath,
          fileName: safeFileName
        };
      } catch (accessError) {
        // Le fichier n'existe pas, ce n'est pas une erreur
        return {
          success: true,
          content: '',
          filePath: null,
          fileName: safeFileName
        };
      }
    } catch (error) {
      logger.error('Erreur lors du chargement automatique SQL:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
  
  // Lister tous les fichiers SQL sauvegardés automatiquement
  ipcMain.handle('sql-editor:list-auto-saved', async () => {
    try {
      const sqlDir = getSqlAutoSaveDirectory();
      
      try {
        // Lire le contenu du dossier
        const files = await fs.readdir(sqlDir);
        
        // Filtrer uniquement les fichiers .sql
        const sqlFiles = files.filter(file => file.endsWith('.sql'));
        
        // Récupérer les informations détaillées
        const fileInfos = await Promise.all(
          sqlFiles.map(async (fileName) => {
            const filePath = join(sqlDir, fileName);
            const stats = await fs.stat(filePath);
            return {
              fileName,
              filePath,
              size: stats.size,
              modifiedAt: stats.mtime,
              createdAt: stats.birthtime
            };
          })
        );
        
        return {
          success: true,
          files: fileInfos
        };
      } catch (accessError) {
        // Le dossier n'existe pas encore
        return {
          success: true,
          files: []
        };
      }
    } catch (error) {
      logger.error('Erreur lors de la liste des fichiers SQL auto-sauvegardés:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Lire le contenu d'un fichier SQL spécifique
  ipcMain.handle('sql-editor:read-file', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        success: true,
        content
      };
    } catch (error) {
      logger.error('Erreur lors de la lecture du fichier SQL:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Renommer un fichier SQL
  ipcMain.handle('sql-editor:rename-file', async (_, oldFilePath: string, newFileName: string) => {
    try {
      const sqlDir = getSqlAutoSaveDirectory();
      const newFilePath = join(sqlDir, newFileName);
      
      // Vérifier que l'ancien fichier existe
      await fs.access(oldFilePath);
      
      // Renommer le fichier
      await fs.rename(oldFilePath, newFilePath);
      
      logger.info(`Fichier SQL renommé: ${oldFilePath} -> ${newFilePath}`);
      
      return {
        success: true,
        newFilePath,
        newFileName
      };
    } catch (error) {
      logger.error('Erreur lors du renommage du fichier SQL:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  // Supprimer un fichier SQL
  ipcMain.handle('sql-editor:delete-file', async (_, filePath: string) => {
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      logger.info('Fichier SQL supprimé', { filePath });
      return { 
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      logger.error('Erreur lors de la suppression du fichier SQL:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  logger.info('Gestionnaires IPC configurés');
}