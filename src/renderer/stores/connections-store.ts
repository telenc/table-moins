import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { DatabaseConnection, ConnectionFormData, ConnectionTestResult } from '../types/connections';

interface ConnectionsState {
  // State
  connections: DatabaseConnection[];
  activeConnectionId: string | null;
  loading: boolean;
  error: string | null;
  
  // Modal states
  isConnectionFormOpen: boolean;
  editingConnection: DatabaseConnection | null;
  
  // Actions
  loadConnections: () => Promise<void>;
  createConnection: (data: ConnectionFormData) => Promise<string>;
  updateConnection: (id: string, data: Partial<ConnectionFormData>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (data: ConnectionFormData) => Promise<ConnectionTestResult>;
  connectToDatabase: (id: string) => Promise<void>;
  disconnectFromDatabase: (id: string) => Promise<void>;
  
  // Modal actions
  openConnectionForm: (connection?: DatabaseConnection) => void;
  closeConnectionForm: () => void;
  
  // Utils
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  connections: [],
  activeConnectionId: null,
  loading: false,
  error: null,
  isConnectionFormOpen: false,
  editingConnection: null,
};

export const useConnectionsStore = create<ConnectionsState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    
    loadConnections: async () => {
      set({ loading: true, error: null });
      
      try {
        // Utiliser l'IPC pour communiquer avec le main process
        const connections = await window.electronAPI.connections.getAll();
        
        set({ 
          connections: connections.map((conn: any) => ({
            ...conn,
            createdAt: new Date(conn.createdAt),
            updatedAt: new Date(conn.updatedAt),
            lastConnected: conn.lastConnected ? new Date(conn.lastConnected) : undefined,
          })),
          loading: false 
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors du chargement des connexions';
        set({ error: message, loading: false });
        throw error;
      }
    },
    
    createConnection: async (data: ConnectionFormData) => {
      set({ loading: true, error: null });
      
      try {
        const id = await window.electronAPI.connections.create(data);
        
        // Recharger la liste des connexions
        await get().loadConnections();
        
        set({ loading: false });
        return id;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la création de la connexion';
        set({ error: message, loading: false });
        throw error;
      }
    },
    
    updateConnection: async (id: string, data: Partial<ConnectionFormData>) => {
      set({ loading: true, error: null });
      
      try {
        await window.electronAPI.connections.update(id, data);
        
        // Recharger la liste des connexions
        await get().loadConnections();
        
        set({ loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour de la connexion';
        set({ error: message, loading: false });
        throw error;
      }
    },
    
    deleteConnection: async (id: string) => {
      set({ loading: true, error: null });
      
      try {
        await window.electronAPI.connections.delete(id);
        
        // Recharger la liste des connexions
        await get().loadConnections();
        
        // Si c'était la connexion active, la désactiver
        if (get().activeConnectionId === id) {
          set({ activeConnectionId: null });
        }
        
        set({ loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la suppression de la connexion';
        set({ error: message, loading: false });
        throw error;
      }
    },
    
    testConnection: async (data: ConnectionFormData): Promise<ConnectionTestResult> => {
      set({ loading: true, error: null });
      
      try {
        const result = await window.electronAPI.connections.test(data);
        set({ loading: false });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors du test de connexion';
        set({ error: message, loading: false });
        return {
          success: false,
          message,
          details: error instanceof Error ? error.stack : undefined
        };
      }
    },
    
    connectToDatabase: async (id: string) => {
      set({ loading: true, error: null });
      
      try {
        await window.electronAPI.connections.connect(id);
        set({ activeConnectionId: id, loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la connexion';
        set({ error: message, loading: false });
        throw error;
      }
    },
    
    disconnectFromDatabase: async (id: string) => {
      set({ loading: true, error: null });
      
      try {
        await window.electronAPI.connections.disconnect(id);
        
        if (get().activeConnectionId === id) {
          set({ activeConnectionId: null });
        }
        
        set({ loading: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur lors de la déconnexion';
        set({ error: message, loading: false });
        throw error;
      }
    },
    
    openConnectionForm: (connection?: DatabaseConnection) => {
      set({ 
        isConnectionFormOpen: true,
        editingConnection: connection || null,
        error: null
      });
    },
    
    closeConnectionForm: () => {
      set({ 
        isConnectionFormOpen: false,
        editingConnection: null,
        error: null
      });
    },
    
    setError: (error: string | null) => {
      set({ error });
    },
    
    clearError: () => {
      set({ error: null });
    },
    
    reset: () => {
      set(initialState);
    },
  }))
);