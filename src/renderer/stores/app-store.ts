import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppState, Theme } from '@shared/types';
import { Logger } from '@shared/utils/logger';

const logger = new Logger('AppStore');

interface AppStoreState extends AppState {
  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setActiveConnection: (connectionId: string | undefined) => void;
  setCurrentDatabase: (database: string | undefined) => void;
  setCurrentTable: (table: string | undefined) => void;
  initializeApp: () => Promise<void>;
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      // État initial
      theme: 'light',
      sidebarCollapsed: false,
      activeTab: 'connections',
      viewMode: 'table',
      currentConnection: undefined,
      currentDatabase: undefined,
      currentTable: undefined,

      // Actions
      setTheme: (theme: Theme) => {
        logger.debug(`Changement de thème: ${theme}`);
        set({ theme });
        
        // Appliquer le thème au body
        document.body.className = `theme-${theme}`;
      },

      toggleSidebar: () => {
        const { sidebarCollapsed } = get();
        logger.debug(`Basculement sidebar: ${!sidebarCollapsed}`);
        set({ sidebarCollapsed: !sidebarCollapsed });
      },

      setActiveConnection: (connectionId: string | undefined) => {
        logger.debug(`Connexion active: ${connectionId}`);
        set({ 
          currentConnection: connectionId,
          currentDatabase: undefined,
          currentTable: undefined,
        });
      },

      setCurrentDatabase: (database: string | undefined) => {
        logger.debug(`Base de données active: ${database}`);
        set({ 
          currentDatabase: database,
          currentTable: undefined,
        });
      },

      setCurrentTable: (table: string | undefined) => {
        logger.debug(`Table active: ${table}`);
        set({ currentTable: table });
      },

      initializeApp: async () => {
        try {
          logger.info('Initialisation du store de l\'application...');
          
          // Charger les préférences utilisateur
          const { theme } = get();
          
          // Appliquer le thème initial
          document.body.className = `theme-${theme}`;
          
          // Ici on pourrait charger d'autres données nécessaires
          // comme les connexions sauvegardées, l'historique, etc.
          
          logger.info('Store de l\'application initialisé');
        } catch (error) {
          logger.error('Erreur lors de l\'initialisation du store:', error as Error);
          throw error;
        }
      },
    }),
    {
      name: 'tablemoins-app-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        activeTab: state.activeTab,
        viewMode: state.viewMode,
      }),
    }
  )
);