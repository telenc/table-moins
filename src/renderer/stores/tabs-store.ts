import { create } from 'zustand';
import { TabConnection } from '../../database/connection-service';

interface TabsState {
  tabs: TabConnection[];
  activeTabId: string | null;
  
  // Actions
  setTabs: (tabs: TabConnection[]) => void;
  addTab: (tab: TabConnection) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  updateTab: (tabId: string, updates: Partial<TabConnection>) => void;
  clearTabs: () => void;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  
  setTabs: (tabs) => set({ tabs }),
  
  addTab: (tab) => set((state) => ({
    tabs: [...state.tabs, tab],
    activeTabId: tab.id // Activer automatiquement le nouvel onglet
  })),
  
  removeTab: (tabId) => set((state) => {
    const newTabs = state.tabs.filter(tab => tab.id !== tabId);
    let newActiveTabId = state.activeTabId;
    
    // Si l'onglet fermé était l'onglet actif, sélectionner un autre onglet
    if (state.activeTabId === tabId) {
      newActiveTabId = newTabs.length > 0 ? newTabs[0].id : null;
    }
    
    return {
      tabs: newTabs,
      activeTabId: newActiveTabId
    };
  }),
  
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  
  updateTab: (tabId, updates) => set((state) => ({
    tabs: state.tabs.map(tab => 
      tab.id === tabId ? { ...tab, ...updates } : tab
    )
  })),
  
  clearTabs: () => set({ tabs: [], activeTabId: null })
}));