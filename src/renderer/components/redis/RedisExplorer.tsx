import React, { useState, useEffect } from 'react';
import { Key, Search, Database, Loader2, RefreshCw, Hash, List, Eye, Layers, ChevronDown, Folder, FolderOpen, ChevronRight } from 'lucide-react';
import { TabConnection } from '../../../database/connection-service';

interface RedisExplorerProps {
  activeTab: TabConnection | null;
  onKeySelect?: (key: string) => void;
}

interface RedisKeyInfo {
  key: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'json';
  ttl: number;
  memoryUsage?: number;
  encoding?: string;
}

interface RedisKeysResult {
  keys: RedisKeyInfo[];
  cursor: string;
  hasMore: boolean;
}

interface TreeNode {
  name: string;
  fullPath: string;
  type: 'folder' | 'key';
  children?: TreeNode[];
  keyInfo?: RedisKeyInfo;
  level: number;
  keyCount?: number; // Number of keys in this folder (recursive)
}

const RedisTypeIcons: Record<RedisKeyInfo['type'], React.ComponentType<any>> = {
  string: Key,
  hash: Hash,
  list: List,
  set: Layers,
  zset: Layers,
  stream: Eye,
  json: Eye,
};

export const RedisExplorer: React.FC<RedisExplorerProps> = ({
  activeTab,
  onKeySelect,
}) => {
  const [keys, setKeys] = useState<RedisKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<number>(0);
  const [availableDatabases, setAvailableDatabases] = useState<number[]>([]);
  const [cursor, setCursor] = useState<string>('0');
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Charger les bases de données Redis (0-15) quand l'onglet actif change
  useEffect(() => {
    if (activeTab && activeTab.isConnected) {
      setAvailableDatabases(Array.from({ length: 16 }, (_, i) => i));
      loadKeys(true);
    } else {
      setKeys([]);
      setAvailableDatabases([]);
      setSelectedDatabase(0);
    }
  }, [activeTab?.id, activeTab?.isConnected]);

  // Recharger les clés quand la base sélectionnée change
  useEffect(() => {
    if (activeTab && activeTab.isConnected) {
      loadKeys(true);
    }
  }, [selectedDatabase]);

  const loadKeys = async (reset: boolean = true) => {
    if (!activeTab) return;

    if (reset) {
      setLoading(true);
      setKeys([]);
      setCursor('0');
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      console.log('🔍 RedisExplorer - Loading keys for database:', selectedDatabase, 'cursor:', reset ? '0' : cursor);

      // Appeler les méthodes Redis spécifiques avec pagination
      const result = await window.electron.invoke(
        'redis:get-keys',
        activeTab.id,
        '*',
        selectedDatabase.toString(),
        reset ? '0' : cursor,
        300
      );

      console.log('🔍 RedisExplorer - Keys retrieved:', result?.keys?.length || 0, 'keys, hasMore:', result?.hasMore);

      if (reset) {
        setKeys(result?.keys || []);
      } else {
        setKeys(prev => [...prev, ...(result?.keys || [])]);
      }

      setCursor(result?.cursor || '0');
      setHasMore(result?.hasMore || false);

      // Build tree structure
      if (reset) {
        setTreeNodes(buildTree(result?.keys || []));
      } else {
        const allKeys = [...keys, ...(result?.keys || [])];
        setTreeNodes(buildTree(allKeys));
      }
    } catch (err) {
      console.error('Error loading Redis keys:', err);
      setError(`Failed to load keys from database ${selectedDatabase}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleKeyClick = (key: string) => {
    // Emit a custom event for key selection
    const event = new CustomEvent('redis-key-selected', {
      detail: { key, database: selectedDatabase },
    });
    window.dispatchEvent(event);

    // Also call the callback if provided
    onKeySelect?.(key);
  };


  const loadMoreKeys = () => {
    if (!loadingMore && hasMore) {
      loadKeys(false);
    }
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    loadKeys(true); // Reset to first page
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();

    // Seulement pour les dossiers
    if (node.type === 'folder') {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        node
      });
    }
  };

  const handleDeleteFolder = async () => {
    if (!contextMenu || !activeTab) return;

    const confirmed = confirm(
      `Voulez-vous vraiment supprimer toutes les clés du dossier "${contextMenu.node.name}" ?\n\n` +
      `Cela supprimera ${contextMenu.node.keyCount || 0} clé(s). Cette action est irréversible.`
    );

    if (!confirmed) {
      setContextMenu(null);
      return;
    }

    try {
      setDeleteLoading(true);

      // Pattern pour supprimer toutes les clés du dossier
      const pattern = `${contextMenu.node.fullPath}:*`;

      console.log(`🗑️ Deleting folder keys with pattern: ${pattern}`);

      let deletedCount = 0;
      try {
        deletedCount = await window.electron.invoke(
          'redis:delete-keys-by-pattern',
          activeTab.id,
          pattern
        );
        console.log(`✅ Deleted ${deletedCount} keys from folder ${contextMenu.node.name}`);
      } catch (deleteError) {
        console.warn('Delete operation failed, but continuing:', deleteError);
        // Continuer même si la suppression échoue (clés peut-être déjà supprimées)
        deletedCount = 0;
      }

      // Toujours recharger les clés pour mettre à jour l'affichage
      console.log('🔄 Refreshing keys after delete operation...');
      await loadKeys(true);

      // Message de succès même si certaines clés n'existaient plus
      if (deletedCount > 0) {
        alert(`${deletedCount} clé(s) supprimée(s) du dossier "${contextMenu.node.name}"`);
      } else {
        alert(`Dossier "${contextMenu.node.name}" traité (clés peuvent être déjà supprimées)`);
      }
    } catch (error) {
      console.error('Error in delete folder operation:', error);
      // Même en cas d'erreur, recharger les clés au cas où certaines auraient été supprimées
      try {
        await loadKeys(true);
      } catch (reloadError) {
        console.error('Failed to reload keys:', reloadError);
      }
      alert(`Opération terminée. Les clés ont été rafraîchies.`);
    } finally {
      setDeleteLoading(false);
      setContextMenu(null);
    }
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // Fermer le menu contextuel quand on clique ailleurs
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const buildTree = (keysList: RedisKeyInfo[]): TreeNode[] => {
    const nodeMap: { [path: string]: TreeNode } = {};
    const roots: TreeNode[] = [];

    keysList.forEach(keyInfo => {
      const parts = keyInfo.key.split(':');
      let currentPath = '';

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}:${part}` : part;

        if (!nodeMap[currentPath]) {
          const node: TreeNode = {
            name: part,
            fullPath: currentPath,
            type: isLast ? 'key' : 'folder',
            level: index,
            children: isLast ? undefined : [],
            keyInfo: isLast ? keyInfo : undefined,
            keyCount: isLast ? 1 : 0
          };

          nodeMap[currentPath] = node;

          if (parentPath && nodeMap[parentPath]) {
            if (!nodeMap[parentPath].children) {
              nodeMap[parentPath].children = [];
            }
            nodeMap[parentPath].children!.push(node);
          } else {
            roots.push(node);
          }
        }
      });
    });

    // Calculate key counts recursively for folders
    const calculateKeyCounts = (node: TreeNode): number => {
      if (node.type === 'key') {
        return 1;
      }

      let totalKeys = 0;
      if (node.children) {
        for (const child of node.children) {
          totalKeys += calculateKeyCounts(child);
        }
      }
      node.keyCount = totalKeys;
      return totalKeys;
    };

    // Calculate counts for all root nodes
    roots.forEach(calculateKeyCounts);

    return roots.sort((a, b) => a.name.localeCompare(b.name));
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.fullPath);
    const IconComponent = node.type === 'key' ? RedisTypeIcons[node.keyInfo?.type || 'string'] :
                          isExpanded ? FolderOpen : Folder;

    return (
      <div key={node.fullPath}>
        <div
          className="flex items-center px-1 py-0.5 hover:bg-red-50 cursor-pointer rounded text-sm min-w-0 group"
          style={{ paddingLeft: `${(node.level * 16) + 4}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.fullPath);
            } else {
              handleKeyClick(node.keyInfo!.key);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          {node.type === 'folder' && (
            <ChevronRight
              className={`h-3 w-3 mr-1 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
          <IconComponent
            className={`h-3 w-3 mx-2 flex-shrink-0 ${
              node.type === 'key' ? getTypeColor(node.keyInfo?.type || 'string') : 'text-blue-500'
            }`}
          />
          <div className="flex-1 min-w-0">
            <div
              className="text-gray-700 truncate font-mono text-xs flex items-center gap-1"
              style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
              title={node.type === 'key' ? node.keyInfo!.key : node.fullPath}
            >
              <span>{node.name}</span>
              {node.type === 'folder' && node.keyCount !== undefined && node.keyCount > 0 && (
                <span className="text-gray-500 text-xs font-normal">
                  ({node.keyCount})
                </span>
              )}
            </div>
            {node.type === 'key' && node.keyInfo && (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span className={`font-medium ${getTypeColor(node.keyInfo.type)}`}>
                  {node.keyInfo.type.toUpperCase()}
                </span>
                {node.keyInfo.ttl !== undefined && node.keyInfo.ttl !== -1 && (
                  <>
                    <span>•</span>
                    <span>TTL: {formatTTL(node.keyInfo.ttl)}</span>
                  </>
                )}
                {node.keyInfo.memoryUsage && (
                  <>
                    <span>•</span>
                    <span>{Math.round(node.keyInfo.memoryUsage / 1024)}KB</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderTreeNode({ ...child, level: node.level + 1 }))}
          </div>
        )}
      </div>
    );
  };

  const formatTTL = (ttl: number): string => {
    if (ttl === -1) return '∞'; // No expiry
    if (ttl === -2) return 'EXP'; // Expired
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
    return `${Math.floor(ttl / 86400)}d`;
  };

  const getTypeColor = (type: RedisKeyInfo['type']): string => {
    const colors = {
      string: 'text-blue-600',
      hash: 'text-green-600',
      list: 'text-purple-600',
      set: 'text-orange-600',
      zset: 'text-red-600',
      stream: 'text-teal-600',
      json: 'text-indigo-600',
    };
    return colors[type] || 'text-gray-600';
  };

  if (!activeTab) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Database className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No active Redis connection</p>
      </div>
    );
  }

  if (!activeTab.isConnected) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <h3 className="font-medium text-gray-900 mb-1">Redis Explorer</h3>
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
            className="w-full px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            onClick={async () => {
              try {
                await window.electron.invoke('tabs:connect', activeTab.id);
              } catch (error) {
                console.error('Redis connection failed:', error);
              }
            }}
          >
            Connect to Redis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex-shrink-0 p-4 pb-0">
        {/* Sélecteur de base de données Redis */}
        <div className="flex items-center gap-2 mt-0">
          {/* Bouton refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex-shrink-0 p-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Recharger toutes les clés"
          >
            <RefreshCw
              className={`h-3 w-3 text-gray-600 ${loading ? 'animate-spin' : ''}`}
            />
          </button>

          {/* Sélecteur de base de données */}
          <div className="flex-1">
            <div className="relative border border-gray-300 rounded bg-white">
            <span className="absolute left-2 top-1.5 text-xs text-gray-500 pointer-events-none">
              DB:
            </span>
            <select
              className="w-full text-xs bg-transparent border-0 pl-10 pr-6 py-1.5 appearance-none cursor-pointer focus:outline-none"
              value={selectedDatabase}
              onChange={async e => {
                const newDatabase = parseInt(e.target.value);
                try {
                  setLoading(true);
                  // Changer de base de données Redis côté serveur
                  await window.electron.invoke(
                    'redis:select-database',
                    activeTab.id,
                    newDatabase
                  );
                  setSelectedDatabase(newDatabase);
                } catch (error) {
                  console.error('Error changing Redis database:', error);
                  setError(`Failed to change to database: ${newDatabase}`);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {availableDatabases.map(db => (
                <option key={db} value={db}>
                  Database {db}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1.5 pointer-events-none">
              <svg
                className="w-3 h-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          </div>
        </div>

      </div>

      {error && (
        <div className="mb-4 p-2 bg-red-50 text-red-700 text-xs rounded flex-shrink-0 mx-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-500 text-sm flex-shrink-0">
          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
          Loading keys...
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-4 pt-0 pb-6">
          {treeNodes.length > 0 ? (
            <>
              {treeNodes.map(node => renderTreeNode(node))}
              {hasMore && (
                <div className="p-4 text-center">
                  <button
                    onClick={loadMoreKeys}
                    disabled={loadingMore}
                    className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          ) : (
            !loading && (
              <div className="text-center text-gray-500 text-sm py-8">
                <Key className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No keys found in database {selectedDatabase}</p>
                <p className="text-xs mt-1">
                  Try different search pattern: *, user:*, cache:*
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Menu contextuel */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 min-w-[160px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 disabled:opacity-50"
            onClick={handleDeleteFolder}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <span className="text-red-500">🗑️</span>
                Supprimer le dossier ({contextMenu.node.keyCount || 0} clés)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};