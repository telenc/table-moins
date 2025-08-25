// Charger dotenv en premier
import { config } from 'dotenv';
import { join } from 'path';

// Charger le fichier .env depuis la racine du projet (remonte de dist/main vers la racine)
config({ path: join(__dirname, '../../.env') });


import { app, BrowserWindow, Menu } from 'electron';
import { isDev } from '../shared/utils/environment';
import { createMenu } from './menu';
import { setupIpcHandlers } from './ipc-handlers';
import { Logger } from '../shared/utils/logger';
import { connectionService } from '../database/connection-service';
import { encryptionService } from '../shared/utils/encryption';

const logger = new Logger('Main');

class TableMoinsApp {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupAppEvents();
    this.setupSecurityPolicies();
  }

  private setupAppEvents(): void {
    app.whenReady().then(async () => {
      await this.initializeServices();
      this.createMainWindow();
      this.setupMenu();
      this.setupIpcHandlers();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      logger.info('Application shutting down');
      // Nettoyage des services lors de la fermeture
      connectionService.cleanup().catch((error) => {
        logger.error('Error during services cleanup:', error);
      });
    });
  }

  /**
   * Initialise les services backend
   */
  private async initializeServices(): Promise<void> {
    try {
      logger.info('Initializing backend services...');
      
      // Initialiser le service de chiffrement avec un mot de passe principal
      // TODO: Implémenter la gestion sécurisée du master password
      await encryptionService.initialize('tablemoins-master-key-v1');
      
      // Initialiser le service de connexions
      await connectionService.initialize();
      
      logger.info('Backend services initialized successfully');
    } catch (error) {
      logger.error('Error during services initialization:', error as Error);
      throw error;
    }
  }

  private setupSecurityPolicies(): void {
    // Désactiver la navigation vers des sites externes
    app.on('web-contents-created', (_, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        const devPort = process.env.VITE_DEV_SERVER_PORT || '5174';
        if (parsedUrl.origin !== `http://localhost:${devPort}` && !isDev) {
          event.preventDefault();
          logger.warn(`Navigation bloquée vers: ${navigationUrl}`);
        }
      });

      // Désactiver l'ouverture de nouvelles fenêtres
      contents.setWindowOpenHandler(({ url }) => {
        logger.warn(`Tentative d'ouverture de fenêtre bloquée: ${url}`);
        return { action: 'deny' };
      });
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, './preload.js'),
        webSecurity: !isDev,
      },
      titleBarStyle: 'default',
      icon: this.getAppIcon(),
    });

    // Charger l'application
    if (isDev) {
      const devPort = process.env.VITE_DEV_SERVER_PORT || '5174';
      this.mainWindow.loadURL(`http://localhost:${devPort}`);
      // Ouvrir DevTools seulement en mode développement
      this.mainWindow.webContents.openDevTools();
    } else {
      // Dans l'app buildée, chercher le fichier index.html
      const possiblePaths = [
        join(__dirname, '../renderer/index.html'),
        join(__dirname, '../../dist/renderer/index.html'),
        join(__dirname, '../dist/renderer/index.html'),
        join(process.resourcesPath, 'app.asar/dist/renderer/index.html')
      ];
      
      let htmlPath = '';
      for (const path of possiblePaths) {
        try {
          if (require('fs').existsSync(path)) {
            htmlPath = path;
            break;
          }
        } catch (e) {
          // Continue to next path
        }
      }
      
      if (!htmlPath) {
        logger.error('Could not find index.html file');
        htmlPath = possiblePaths[0]; // fallback
      }
      
      logger.info(`Loading HTML from: ${htmlPath}`);
      this.mainWindow.loadFile(htmlPath);
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      logger.info('Main window ready');
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupMenu(): void {
    const menu = createMenu(this.mainWindow);
    Menu.setApplicationMenu(menu);
  }

  private setupIpcHandlers(): void {
    setupIpcHandlers(this.mainWindow);
  }

  private getAppIcon(): string | undefined {
    const iconPath = join(__dirname, '../../assets/icons');
    
    switch (process.platform) {
      case 'darwin':
        return join(iconPath, 'icon.png'); // macOS utilise PNG aussi
      case 'win32':
        return join(iconPath, 'icon.png'); // Windows peut utiliser PNG
      default:
        return join(iconPath, 'icon.png');
    }
  }
}

// Initialiser l'application
new TableMoinsApp();