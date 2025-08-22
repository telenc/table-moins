import React, { useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { DatabaseTab } from './DatabaseTab';
import { TabConnection } from '../../../database/connection-service';
import { useTabsStore } from '../../stores/tabs-store';

interface TabSystemProps {
  onTabChange?: (tabId: string | null) => void;
  hideUI?: boolean; // Option pour cacher l'UI et ne garder que la logique
}

export interface TabSystemRef {
  reloadTabs: () => Promise<void>;
}

const TabSystemComponent = forwardRef<TabSystemRef, TabSystemProps>(({ onTabChange, hideUI = false }, ref) => {
  const { tabs, activeTabId, setTabs, setActiveTab } = useTabsStore();

  // Récupérer les onglets au chargement
  useEffect(() => {
    loadTabs();
  }, []);

  const loadTabs = useCallback(async () => {
    try {
      const allTabs = await window.electronAPI.tabs.getAll();
      setTabs(allTabs);
      
      // Si aucun onglet actif et qu'il y a des onglets, activer le premier
      if (!activeTabId && allTabs.length > 0) {
        setActiveTab(allTabs[0].id);
        onTabChange?.(allTabs[0].id);
      }
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }, [activeTabId, setTabs, setActiveTab, onTabChange]);

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  }, [setActiveTab, onTabChange]);

  const handleTabClose = useCallback(async (tabId: string) => {
    try {
      await window.electronAPI.tabs.close(tabId);
      await loadTabs();
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }, [loadTabs]);

  const handleTabConnect = useCallback(async (tabId: string) => {
    try {
      await window.electronAPI.tabs.connect(tabId);
      await loadTabs();
    } catch (error) {
      console.error('Error connecting tab:', error);
    }
  }, [loadTabs]);

  const handleTabDisconnect = useCallback(async (tabId: string) => {
    try {
      await window.electronAPI.tabs.disconnect(tabId);
      await loadTabs();
    } catch (error) {
      console.error('Error disconnecting tab:', error);
    }
  }, [loadTabs]);

  // Exposer la fonction pour recharger les onglets
  useImperativeHandle(ref, () => ({
    reloadTabs: loadTabs
  }), []);

  // Si hideUI est true, ne pas rendre d'interface utilisateur
  if (hideUI) {
    return null;
  }

  if (tabs.length === 0) {
    return null; // Pas d'onglets à afficher
  }

  return (
    <div className="flex flex-col">
      {/* Barre d'onglets */}
      <div className="flex items-center bg-gray-50 border-b border-gray-200 px-2">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => (
            <DatabaseTab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => handleTabSelect(tab.id)}
              onClose={() => handleTabClose(tab.id)}
              onConnect={() => handleTabConnect(tab.id)}
              onDisconnect={() => handleTabDisconnect(tab.id)}
            />
          ))}
        </div>
        
        {/* Bouton pour ajouter un nouvel onglet */}
        <button
          className="ml-2 p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
          title="New Tab"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
});

TabSystemComponent.displayName = 'TabSystem';

export { TabSystemComponent as TabSystem };