import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { X, Plus, Table as TableIcon, FileText } from 'lucide-react';
import { DataViewer } from './DataViewer';
import { SqlEditor } from './SqlEditor';
import { TabConnection } from '../../../database/connection-service';
import { useSqlEditorStore } from '../../stores/sqlEditorStore';

interface TableTab {
  id: string;
  tableName?: string;
  databaseName?: string;
  type: 'table' | 'sql-editor';
  title: string;
}

interface TableTabsProps {
  activeTab: TabConnection | null;
  onTableOpen?: (tableName: string) => void;
}

export interface TableTabsRef {
  loadQueryFile: (fileName: string, filePath: string) => void;
}

export const TableTabs = forwardRef<TableTabsRef, TableTabsProps>(({ activeTab, onTableOpen }, ref) => {
  const [tableTabs, setTableTabs] = useState<TableTab[]>([]);
  const [activeTableTabId, setActiveTableTabId] = useState<string | null>(null);
  const [hasLoadedFirstTable, setHasLoadedFirstTable] = useState(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    loadQueryFile: async (fileName: string, filePath: string) => {
      try {
        // Check if a tab for this file is already open
        const { editors } = useSqlEditorStore.getState();
        const existingTabId = tableTabs.find(tab => {
          if (tab.type === 'sql-editor') {
            const editorData = editors[tab.id];
            return editorData && editorData.fileName === fileName;
          }
          return false;
        })?.id;

        // If tab already exists, just activate it
        if (existingTabId) {
          setActiveTableTabId(existingTabId);
          return;
        }

        // Read file content
        const result = await window.electron.invoke('sql-editor:read-file', filePath);
        
        if (result.success) {
          const newTab: TableTab = {
            id: `${activeTab?.id}-sql-editor-${Date.now()}`,
            type: 'sql-editor',
            title: fileName.replace('.sql', '')
          };

          // Add the tab first
          setTableTabs(prev => [...prev, newTab]);
          setActiveTableTabId(newTab.id);
          
          // Then set the content in the store using a timeout to ensure the tab is created
          setTimeout(() => {
            const { setEditorContent, setEditorData } = useSqlEditorStore.getState();
            setEditorContent(newTab.id, result.content);
            setEditorData(newTab.id, {
              fileName: fileName,
              filePath: filePath,
              hasUnsavedChanges: false
            });
          }, 100);
          
        } else {
          console.error('Error reading SQL file:', result.error);
          // Still create an empty tab if file reading fails
          const newTab: TableTab = {
            id: `${activeTab?.id}-sql-editor-${Date.now()}`,
            type: 'sql-editor',
            title: 'SQL Editor'
          };
          setTableTabs(prev => [...prev, newTab]);
          setActiveTableTabId(newTab.id);
        }
      } catch (error) {
        console.error('Error loading SQL file:', error);
        // Still create an empty tab if there's an error
        const newTab: TableTab = {
          id: `${activeTab?.id}-sql-editor-${Date.now()}`,
          type: 'sql-editor',
          title: 'SQL Editor'
        };
        setTableTabs(prev => [...prev, newTab]);
        setActiveTableTabId(newTab.id);
      }
    }
  }), [activeTab, tableTabs]);

  // Reset tabs when connection changes
  useEffect(() => {
    if (activeTab) {
      // Clear existing tabs when switching connections
      setTableTabs([]);
      setActiveTableTabId(null);
      setHasLoadedFirstTable(false);
    }
  }, [activeTab?.id]);

  // Auto-load first table when connected
  useEffect(() => {
    const loadFirstTable = async () => {
      if (activeTab?.isConnected && !hasLoadedFirstTable) {
        try {
          // Get databases
          const databases = await window.electron.invoke('database:get-databases', activeTab.id);
          if (databases && databases.length > 0) {
            // Get tables from first database
            const tables = await window.electron.invoke('database:get-tables', activeTab.id, databases[0]);
            if (tables && tables.length > 0) {
              // Open the first table
              const firstTable = tables[0];
              const tableName = firstTable.name || firstTable.tablename || firstTable;
              addTableTab(tableName, databases[0]);
              setHasLoadedFirstTable(true);
            }
          }
        } catch (error) {
          console.error('Error loading first table:', error);
        }
      }
    };

    loadFirstTable();
  }, [activeTab?.isConnected, activeTab?.id, hasLoadedFirstTable]);

  // Add a new table tab
  const addTableTab = (tableName: string, databaseName?: string) => {
    // Check if tab already exists
    const existingTab = tableTabs.find(tab => tab.tableName === tableName && tab.type === 'table');
    if (existingTab) {
      setActiveTableTabId(existingTab.id);
      return;
    }

    const newTab: TableTab = {
      id: `${activeTab?.id}-${tableName}-${Date.now()}`,
      tableName,
      databaseName,
      type: 'table',
      title: tableName
    };

    setTableTabs(prev => [...prev, newTab]);
    setActiveTableTabId(newTab.id);
  };

  // Add a new SQL editor tab
  const addSqlEditorTab = () => {
    const newTab: TableTab = {
      id: `${activeTab?.id}-sql-editor-${Date.now()}`,
      type: 'sql-editor',
      title: 'SQL Editor'
    };

    setTableTabs(prev => [...prev, newTab]);
    setActiveTableTabId(newTab.id);
    
    // Initialize the editor with default content and unique filename
    setTimeout(() => {
      const { setEditorContent, setEditorData } = useSqlEditorStore.getState();
      const uniqueFileName = `Untitled-${Date.now()}.sql`;
      const defaultContent = '-- Write your SQL query here\nSELECT * FROM your_table LIMIT 10;';
      
      setEditorContent(newTab.id, defaultContent);
      setEditorData(newTab.id, {
        fileName: uniqueFileName,
        hasUnsavedChanges: false
      });
    }, 100);
  };


  // Access the SQL editor store
  const { removeEditor, editors } = useSqlEditorStore();
  
  // Update tab titles when fileName changes in SQL editor store
  useEffect(() => {
    setTableTabs(prevTabs => 
      prevTabs.map(tab => {
        if (tab.type === 'sql-editor') {
          const editorData = editors[tab.id];
          if (editorData && editorData.fileName) {
            const newTitle = editorData.fileName.replace('.sql', '');
            if (newTitle !== tab.title) {
              return { ...tab, title: newTitle };
            }
          }
        }
        return tab;
      })
    );
  }, [editors]);
  
  // Close a table tab
  const closeTableTab = (tabId: string) => {
    // Find the tab to close
    const tabToClose = tableTabs.find(tab => tab.id === tabId);
    
    // If it's a SQL editor, remove it from the store
    if (tabToClose?.type === 'sql-editor') {
      removeEditor(tabId);
    }
    
    setTableTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== tabId);
      
      // If closing the active tab, switch to another tab
      if (activeTableTabId === tabId) {
        if (newTabs.length > 0) {
          setActiveTableTabId(newTabs[newTabs.length - 1].id);
        } else {
          setActiveTableTabId(null);
        }
      }
      
      return newTabs;
    });
  };

  // Get the active table tab
  const activeTableTab = tableTabs.find(tab => tab.id === activeTableTabId);

  // Listen for table selection from DatabaseExplorer
  useEffect(() => {
    const handleTableSelect = (event: CustomEvent<{ tableName: string; databaseName?: string }>) => {
      addTableTab(event.detail.tableName, event.detail.databaseName);
    };

    window.addEventListener('table-selected' as any, handleTableSelect);
    return () => {
      window.removeEventListener('table-selected' as any, handleTableSelect);
    };
  }, [activeTab, tableTabs]);

  if (!activeTab) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <TableIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No active connection</p>
        </div>
      </div>
    );
  }

  if (!activeTab.isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <TableIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>Not connected</p>
          <p className="text-sm mt-2">Connect to view tables</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ 
      height: '100%'
    }}>
      {/* Table tabs bar */}
      {tableTabs.length > 0 && (
        <div 
          className="border-b bg-gray-50 overflow-x-auto"
          style={{ 
            maxWidth: '100%',
            width: '100%'
          }}
        >
          <div 
            className="flex items-center"
            style={{ 
              width: 'max-content'
            }}
          >
            {tableTabs.map(tab => (
              <div
                key={tab.id}
                className={`flex items-center gap-1 px-3 py-2 border-r cursor-pointer transition-colors flex-shrink-0 min-w-0 ${
                  activeTableTabId === tab.id 
                    ? 'bg-white text-blue-600 border-b-2 border-b-blue-500' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={{ minWidth: '140px' }}
                onClick={() => setActiveTableTabId(tab.id)}
              >
                {tab.type === 'sql-editor' ? (
                  <FileText className="h-3 w-3" />
                ) : (
                  <TableIcon className="h-3 w-3" />
                )}
                <span 
                  className="text-sm truncate block"
                  style={{ maxWidth: '120px' }}
                  title={tab.type === 'sql-editor' ? tab.title : `${tab.databaseName ? tab.databaseName + '.' : ''}${tab.tableName}`}
                >
                  {tab.title}
                </span>
                <button
                  className="ml-2 p-0.5 hover:bg-gray-200 rounded opacity-0 hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTableTab(tab.id);
                  }}
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* Add new SQL editor tab button */}
            <button
              className="px-3 py-2 text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
              onClick={addSqlEditorTab}
              title="Add SQL Editor tab"
            >
              <FileText className="h-4 w-4" />
            </button>
            {/* Add new table tab button */}
            <button
              className="px-3 py-2 text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0"
              onClick={() => {
                // This will be handled by the DatabaseExplorer double-click
                console.log('Open table selector');
              }}
              title="Open a table (click on tables in explorer)"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-0">
        {activeTableTab ? (
          activeTableTab.type === 'sql-editor' ? (
            <div className="h-full flex flex-col">
              <SqlEditor
                activeTab={activeTab}
                tabId={activeTableTab.id}
              />
            </div>
          ) : (
            <DataViewer
              activeTab={activeTab}
              tableName={activeTableTab.tableName!}
              onBack={() => closeTableTab(activeTableTab.id)}
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 h-full">
            <div className="text-center">
              <TableIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No tab selected</p>
              <p className="text-sm mt-2">Double-click on a table in the explorer to open it or click the SQL Editor button</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

TableTabs.displayName = 'TableTabs';