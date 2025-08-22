import React, { useState, useEffect } from 'react';
import { Database, Table, Eye, Search, FileText, Calendar, Trash2 } from 'lucide-react';
import { TabConnection } from '../../../database/connection-service';

interface DatabaseExplorerProps {
  activeTab: TabConnection | null;
  onTableSelect?: (tableName: string) => void;
  onQuerySelect?: (fileName: string, filePath: string) => void;
}

interface DatabaseInfo {
  name: string;
  tables: TableInfo[];
  expanded?: boolean;
}

interface TableInfo {
  name: string;
  type: 'table' | 'view';
}

interface SavedQueryInfo {
  fileName: string;
  filePath: string;
  size: number;
  modifiedAt: Date;
  createdAt: Date;
}

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({ 
  activeTab, 
  onTableSelect,
  onQuerySelect 
}) => {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]); // Les tables (pas schémas maintenant)
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]); // Vraies bases de données
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]); // Schémas disponibles
  const [selectedDatabase, setSelectedDatabase] = useState<string>(''); // Base sélectionnée
  const [selectedSchema, setSelectedSchema] = useState<string>(''); // Schéma sélectionné
  const [searchFilter, setSearchFilter] = useState<string>(''); // Filtre de recherche
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tables' | 'queries'>('tables'); // Mode d'affichage
  const [savedQueries, setSavedQueries] = useState<SavedQueryInfo[]>([]); // Requêtes sauvegardées
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    query: SavedQueryInfo | null;
  }>({ visible: false, x: 0, y: 0, query: null });

  // Charger les bases de données quand l'onglet actif change ou quand la connexion s'établit
  useEffect(() => {
    if (activeTab && activeTab.isConnected) {
      loadAvailableDatabases();
      loadAvailableSchemas();
    } else {
      setDatabases([]);
      setAvailableDatabases([]);
      setAvailableSchemas([]);
      setSelectedDatabase('');
      setSelectedSchema('');
    }
  }, [activeTab?.id, activeTab?.isConnected]);

  // Recharger les schémas quand la base sélectionnée change
  useEffect(() => {
    if (activeTab && activeTab.isConnected && selectedDatabase) {
      loadAvailableSchemas();
    }
  }, [selectedDatabase]);

  // Recharger les tables quand le schéma sélectionné change
  useEffect(() => {
    if (activeTab && activeTab.isConnected && selectedSchema) {
      loadTables();
    }
  }, [selectedSchema]);

  // Charger les requêtes sauvegardées quand on bascule en mode queries
  useEffect(() => {
    if (viewMode === 'queries') {
      loadSavedQueries();
    }
  }, [viewMode]);
  
  // Auto-expand et charger les tables de la première base de données après connexion
  useEffect(() => {
    if (activeTab?.isConnected && databases.length > 0 && !databases[0].expanded) {
      // Auto-expand la première base de données (généralement celle par défaut)
      toggleDatabase(0);
    }
  }, [activeTab?.isConnected, databases.length]);

  const loadAvailableDatabases = async () => {
    if (!activeTab) return;
    
    try {
      const databaseList = await window.electron.invoke('database:get-databases', activeTab.id);
      setAvailableDatabases(databaseList);
      
      // Sélectionner la première base par défaut ou celle de la connexion
      if (databaseList.length > 0 && !selectedDatabase) {
        const defaultDb = activeTab.connection.database || databaseList[0];
        setSelectedDatabase(defaultDb);
      }
    } catch (err) {
      console.error('Error loading available databases:', err);
    }
  };

  const loadAvailableSchemas = async () => {
    if (!activeTab) return;
    
    try {
      // Pour PostgreSQL, récupérer les schémas
      if (activeTab.connection.type === 'postgresql') {
        const schemaList = await window.electron.invoke('database:get-schemas', activeTab.id);
        setAvailableSchemas(schemaList);
        
        // Sélectionner le schéma 'public' par défaut
        if (schemaList.length > 0 && !selectedSchema) {
          const defaultSchema = schemaList.find(s => s === 'public') || schemaList[0];
          setSelectedSchema(defaultSchema);
        }
      } else {
        // Pour MySQL/SQLite, pas de schémas
        setAvailableSchemas([]);
        setSelectedSchema('');
      }
    } catch (err) {
      console.error('Error loading available schemas:', err);
    }
  };

  const loadTables = async () => {
    if (!activeTab) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Utiliser le schéma sélectionné pour PostgreSQL, ou la base pour les autres
      const schemaOrDatabase = activeTab.connection.type === 'postgresql' 
        ? selectedSchema 
        : selectedDatabase;
      
      if (!schemaOrDatabase) {
        setDatabases([]);
        return;
      }
      
      console.log('🔍 DatabaseExplorer - Using database:', schemaOrDatabase, 'activeTab.id:', activeTab.id);
      const tableList = await window.electron.invoke('database:get-tables', activeTab.id, schemaOrDatabase);
      console.log('🔍 DatabaseExplorer - Tables retrieved:', tableList?.length || 0, 'tables');
      
      // Créer une "base de données virtuelle" contenant toutes les tables
      const tablesInfo: DatabaseInfo = {
        name: schemaOrDatabase,
        tables: tableList.map((table: any) => ({
          name: table.name || table.tablename || table,
          type: table.type === 'view' ? 'view' : 'table'
        })),
        expanded: true // Toujours expanded car c'est le niveau principal maintenant
      };
      
      setDatabases([tablesInfo]);
    } catch (err) {
      console.error('Error loading tables:', err);
      setError(`Failed to load tables for ${selectedSchema || selectedDatabase}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleDatabase = (dbIndex: number) => {
    setDatabases(prev => prev.map((db, idx) => 
      idx === dbIndex ? { ...db, expanded: !db.expanded } : db
    ));
  };

  const loadSavedQueries = async () => {
    try {
      setLoading(true);
      const result = await window.electron.invoke('sql-editor:list-auto-saved');
      
      if (result.success) {
        setSavedQueries(result.files.map((file: any) => ({
          fileName: file.fileName,
          filePath: file.filePath,
          size: file.size,
          modifiedAt: new Date(file.modifiedAt),
          createdAt: new Date(file.createdAt)
        })));
      } else {
        console.error('Error loading saved queries:', result.error);
        setError('Failed to load saved queries');
      }
    } catch (error) {
      console.error('Error loading saved queries:', error);
      setError('Failed to load saved queries');
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (tableName: string, databaseName?: string) => {
    // Emit a custom event for table selection
    const event = new CustomEvent('table-selected', { 
      detail: { tableName, databaseName } 
    });
    window.dispatchEvent(event);
    
    // Also call the callback if provided
    onTableSelect?.(tableName);
  };

  const handleQueryClick = (fileName: string, filePath: string) => {
    // Call the callback if provided
    onQuerySelect?.(fileName, filePath);
  };

  const handleQueryRightClick = (event: React.MouseEvent, query: SavedQueryInfo) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      query
    });
  };

  const handleDeleteFile = async (query: SavedQueryInfo) => {
    try {
      const result = await window.electron.invoke('sql-editor:delete-file', query.filePath);
      if (result.success) {
        // Recharger la liste des requêtes
        loadSavedQueries();
        setContextMenu({ visible: false, x: 0, y: 0, query: null });
      } else {
        console.error('Error deleting file:', result.error);
        alert('Failed to delete file: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  // Fermer le menu contextuel quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, query: null });
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  // Écouter les événements de mise à jour des queries
  useEffect(() => {
    const handleQueriesUpdated = () => {
      if (viewMode === 'queries') {
        loadSavedQueries();
      }
    };

    window.addEventListener('queries-updated', handleQueriesUpdated);
    return () => window.removeEventListener('queries-updated', handleQueriesUpdated);
  }, [viewMode]);

  // Filtrer les tables selon le terme de recherche
  const filteredDatabases = databases.map(database => ({
    ...database,
    tables: database.tables.filter(table => 
      table.name.toLowerCase().includes(searchFilter.toLowerCase())
    )
  }));

  // Filtrer les requêtes sauvegardées selon le terme de recherche
  const filteredQueries = savedQueries.filter(query =>
    query.fileName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  if (!activeTab) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Database className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No active connection</p>
      </div>
    );
  }

  if (!activeTab.isConnected) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <h3 className="font-medium text-gray-900 mb-1">Database Explorer</h3>
          <p className="text-xs text-gray-500">{activeTab.connection.name}</p>
        </div>
        
        <div className="text-center text-gray-500 bg-gray-50 rounded-lg p-6">
          <Database className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium mb-1">{activeTab.connection.name}</p>
          <p className="text-xs text-gray-500 mb-3">
            {activeTab.connection.host}:{activeTab.connection.port}
          </p>
          <p className="text-xs text-red-500 mb-4">Not connected</p>
          <button 
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            onClick={async () => {
              try {
                await window.electron.invoke('tabs:connect', activeTab.id);
                // The useEffect will trigger a reload when the connection status changes
              } catch (error) {
                console.error('Connection failed:', error);
              }
            }}
          >
            Connect to Database
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex-shrink-0 p-4 pb-0">
        
        {/* Sélecteur de base de données */}
        {availableDatabases.length > 1 && (
          <div className="mt-3">
            <div className="relative border border-gray-300 rounded bg-white">
              <span className="absolute left-2 top-1.5 text-xs text-gray-500 pointer-events-none">Database:</span>
              <select 
                className="w-full text-xs bg-transparent border-0 pl-18 pr-6 py-1.5 appearance-none cursor-pointer focus:outline-none"
                value={selectedDatabase}
              onChange={async (e) => {
                const newDatabase = e.target.value;
                try {
                  setLoading(true);
                  // Changer de base de données côté serveur
                  await window.electron.invoke('database:change-database', activeTab.id, newDatabase);
                  setSelectedDatabase(newDatabase);
                  // Les schémas seront rechargés automatiquement par l'useEffect
                } catch (error) {
                  console.error('Error changing database:', error);
                  setError(`Failed to change to database: ${newDatabase}`);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {availableDatabases.map(db => (
                <option key={db} value={db}>{db}</option>
              ))}
            </select>
            <div className="absolute right-2 top-1.5 pointer-events-none">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            </div>
          </div>
        )}

        {/* Sélecteur de schéma */}
        {availableSchemas.length > 0 && activeTab?.connection.type === 'postgresql' && (
          <div className="mt-3">
            <div className="relative border border-gray-300 rounded bg-white">
              <span className="absolute left-2 top-1.5 text-xs text-gray-500 pointer-events-none">Schema:</span>
              <select 
                className="w-full text-xs bg-transparent border-0 pl-16 pr-6 py-1.5 appearance-none cursor-pointer focus:outline-none"
                value={selectedSchema}
              onChange={(e) => {
                const newSchema = e.target.value;
                setSelectedSchema(newSchema);
                // Les tables seront rechargées automatiquement par l'useEffect
              }}
            >
              {availableSchemas.map(schema => (
                <option key={schema} value={schema}>
                  {schema}
                  {schema === 'public' && ' (default)'}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1.5 pointer-events-none">
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            </div>
          </div>
        )}

        {/* Champ de recherche */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
            <input
              type="text"
              placeholder={viewMode === 'tables' ? "Filter tables..." : "Filter queries..."}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1 pl-7 bg-white"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Sélecteur Tables / Queries */}
        <div className="mt-3">
          <div className="flex bg-gray-100 rounded p-1">
            <button
              onClick={() => setViewMode('tables')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'tables'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Table className="h-3 w-3" />
              Tables
            </button>
            <button
              onClick={() => setViewMode('queries')}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'queries'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="h-3 w-3" />
              Queries
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-700 text-xs rounded flex-shrink-0">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-500 text-sm flex-shrink-0">
          Loading {activeTab?.connection.type === 'postgresql' ? 'schemas' : 'databases'}...
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4 pt-0 pb-6">
          {viewMode === 'tables' ? (
            <>
              {filteredDatabases.map((database, dbIndex) => (
                <div key={database.name}>
                  {/* Tables List - Direct display */}
                  <div>
                    {database.tables.map((table, tableIndex) => (
                      <div key={table.name}>
                        {/* Table Header */}
                        <div 
                          className="flex items-center px-1 py-0.5 hover:bg-gray-100 cursor-pointer rounded text-sm min-w-0"
                          onClick={() => handleTableClick(table.name, database.name)}
                        >
                          {table.type === 'view' ? (
                            <Eye className="h-3 w-3 text-blue-600 mx-2 flex-shrink-0" />
                          ) : (
                            <Table className="h-3 w-3 text-green-600 mx-2 flex-shrink-0" />
                          )}
                          <span 
                            className="text-gray-700 truncate flex-1 min-w-0 font-mono"
                            style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
                            title={table.name}
                          >
                            {table.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Message quand aucune table ne correspond */}
              {searchFilter && filteredDatabases.every(db => db.tables.length === 0) && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No tables found matching "{searchFilter}"</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Queries List */}
              {filteredQueries.map((query) => (
                <div key={query.fileName}>
                  <div 
                    className="flex items-center px-1 py-0.5 hover:bg-gray-100 cursor-pointer rounded text-sm min-w-0"
                    onClick={() => handleQueryClick(query.fileName, query.filePath)}
                    onContextMenu={(e) => handleQueryRightClick(e, query)}
                  >
                    <FileText className="h-3 w-3 text-purple-600 mx-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div 
                        className="text-gray-700 truncate font-mono"
                        style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
                        title={query.fileName}
                      >
                        {query.fileName}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <Calendar className="h-2 w-2" />
                        {query.modifiedAt.toLocaleDateString()}
                        <span>•</span>
                        {Math.round(query.size / 1024)}KB
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Message quand aucune requête ne correspond */}
              {searchFilter && filteredQueries.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No queries found matching "{searchFilter}"</p>
                </div>
              )}
              
              {/* Message quand aucune requête n'est sauvegardée */}
              {!searchFilter && filteredQueries.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No saved queries</p>
                  <p className="text-xs mt-1">Save queries from the SQL editor to see them here</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.query && (
        <div
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            onClick={() => handleDeleteFile(contextMenu.query!)}
          >
            <Trash2 className="h-4 w-4" />
            Delete file
          </button>
        </div>
      )}
    </div>
  );
};