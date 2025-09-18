import React, { useState, useEffect } from 'react';
import { Key, Hash, List, Layers, Eye, Copy, Trash2, Edit, Save, X } from 'lucide-react';
import { TabConnection } from '../../../database/connection-service';

interface RedisValueViewerProps {
  activeTab: TabConnection | null;
  selectedKey?: string;
}

interface RedisValueInfo {
  key: string;
  type: 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'json';
  value: any;
  size: number;
  ttl: number;
  encoding?: string;
}

export const RedisValueViewer: React.FC<RedisValueViewerProps> = ({ activeTab, selectedKey }) => {
  const [valueInfo, setValueInfo] = useState<RedisValueInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    if (activeTab && activeTab.isConnected && selectedKey) {
      loadKeyValue();
    } else {
      setValueInfo(null);
    }
  }, [activeTab?.id, activeTab?.isConnected, selectedKey]);

  const loadKeyValue = async () => {
    if (!activeTab || !selectedKey) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 RedisValueViewer - Loading value for key:', selectedKey);

      const result = await window.electron.invoke('redis:get-key-value', activeTab.id, selectedKey);

      console.log('🔍 RedisValueViewer - Value retrieved:', result);
      setValueInfo(result);
    } catch (err) {
      console.error('Error loading Redis key value:', err);
      setError(`Failed to load value for key: ${selectedKey}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (selectedKey) {
      navigator.clipboard.writeText(selectedKey);
    }
  };

  const handleCopyValue = () => {
    if (valueInfo) {
      let textToCopy = '';
      if (typeof valueInfo.value === 'string') {
        textToCopy = valueInfo.value;
      } else {
        textToCopy = JSON.stringify(valueInfo.value, null, 2);
      }
      navigator.clipboard.writeText(textToCopy);
    }
  };

  const handleDeleteKey = async () => {
    if (!activeTab || !selectedKey) return;

    if (confirm(`Are you sure you want to delete key: ${selectedKey}?`)) {
      try {
        await window.electron.invoke('redis:delete-key', activeTab.id, selectedKey);

        // Refresh the key list
        const event = new CustomEvent('redis-keys-updated');
        window.dispatchEvent(event);

        // Clear the current view
        setValueInfo(null);
      } catch (error) {
        console.error('Error deleting key:', error);
        setError(`Failed to delete key: ${selectedKey}`);
      }
    }
  };

  const handleEditToggle = () => {
    if (!editMode && valueInfo) {
      // Enter edit mode
      setEditValue(
        typeof valueInfo.value === 'string'
          ? valueInfo.value
          : JSON.stringify(valueInfo.value, null, 2)
      );
    }
    setEditMode(!editMode);
  };

  const handleSaveValue = async () => {
    if (!activeTab || !selectedKey) return;

    try {
      await window.electron.invoke('redis:set-key-value', activeTab.id, selectedKey, editValue);

      // Refresh the value
      await loadKeyValue();
      setEditMode(false);
    } catch (error) {
      console.error('Error saving key value:', error);
      setError(`Failed to save value for key: ${selectedKey}`);
    }
  };

  const formatTTL = (ttl: number): string => {
    if (ttl === -1) return 'No expiry';
    if (ttl === -2) return 'Expired';
    if (ttl < 60) return `${ttl} seconds`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)} minutes`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)} hours`;
    return `${Math.floor(ttl / 86400)} days`;
  };

  const getTypeIcon = (type: RedisValueInfo['type']) => {
    const icons = {
      string: Key,
      hash: Hash,
      list: List,
      set: Layers,
      zset: Layers,
      stream: Eye,
      json: Eye,
    };
    return icons[type] || Key;
  };

  const getTypeColor = (type: RedisValueInfo['type']): string => {
    const colors = {
      string: 'text-blue-600 bg-blue-50',
      hash: 'text-green-600 bg-green-50',
      list: 'text-purple-600 bg-purple-50',
      set: 'text-orange-600 bg-orange-50',
      zset: 'text-red-600 bg-red-50',
      stream: 'text-teal-600 bg-teal-50',
      json: 'text-indigo-600 bg-indigo-50',
    };
    return colors[type] || 'text-gray-600 bg-gray-50';
  };

  const renderValue = () => {
    if (!valueInfo) return null;

    if (editMode && valueInfo.type === 'string') {
      return (
        <div className="space-y-2">
          <textarea
            className="w-full h-40 p-3 border border-gray-300 rounded font-mono text-sm"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveValue}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      );
    }

    switch (valueInfo.type) {
      case 'string':
        return (
          <pre className="bg-gray-50 p-3 rounded border font-mono text-sm whitespace-pre-wrap overflow-auto">
            {valueInfo.value}
          </pre>
        );

      case 'hash':
        return (
          <div className="space-y-1">
            {Object.entries(valueInfo.value).map(([field, val]) => (
              <div key={field} className="flex border-b border-gray-100 py-1">
                <div className="w-1/3 font-mono text-sm text-gray-600 truncate pr-2">{field}</div>
                <div className="flex-1 font-mono text-sm break-all">{String(val)}</div>
              </div>
            ))}
          </div>
        );

      case 'list':
        return (
          <div className="space-y-1">
            {(valueInfo.value as string[]).map((item, index) => (
              <div key={index} className="flex border-b border-gray-100 py-1">
                <div className="w-16 font-mono text-sm text-gray-600 text-right pr-2">
                  [{index}]
                </div>
                <div className="flex-1 font-mono text-sm break-all">{item}</div>
              </div>
            ))}
          </div>
        );

      case 'set':
        return (
          <div className="space-y-1">
            {(valueInfo.value as string[]).map((item, index) => (
              <div
                key={index}
                className="border-b border-gray-100 py-1 font-mono text-sm break-all"
              >
                {item}
              </div>
            ))}
          </div>
        );

      case 'zset':
        return (
          <div className="space-y-1">
            {(valueInfo.value as Array<{ value: string; score: number }>).map((item, index) => (
              <div key={index} className="flex border-b border-gray-100 py-1">
                <div className="w-20 font-mono text-sm text-gray-600 text-right pr-2">
                  {item.score}
                </div>
                <div className="flex-1 font-mono text-sm break-all">{item.value}</div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <pre className="bg-gray-50 p-3 rounded border font-mono text-sm whitespace-pre-wrap overflow-auto">
            {JSON.stringify(valueInfo.value, null, 2)}
          </pre>
        );
    }
  };

  if (!selectedKey) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 h-full">
        <div className="text-center">
          <Key className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">Select a Redis key</p>
          <p className="text-sm">Choose a key from the explorer to view its value</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
          <p>Loading key value...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-red-600">
          <X className="h-16 w-16 mx-auto mb-4 text-red-300" />
          <p className="text-lg font-medium mb-2">Error loading key</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={loadKeyValue}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!valueInfo) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Key className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium mb-2">Key not found</p>
          <p className="text-sm">The selected key may have been deleted or expired</p>
        </div>
      </div>
    );
  }

  const TypeIcon = getTypeIcon(valueInfo.type);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-white p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2 rounded ${getTypeColor(valueInfo.type)}`}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="font-mono text-sm font-medium text-gray-900 truncate"
                title={valueInfo.key}
              >
                {valueInfo.key}
              </h3>
              <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                <span className={`font-medium ${getTypeColor(valueInfo.type).split(' ')[0]}`}>
                  {valueInfo.type.toUpperCase()}
                </span>
                <span>Size: {valueInfo.size}</span>
                <span>TTL: {formatTTL(valueInfo.ttl)}</span>
                {valueInfo.encoding && <span>Encoding: {valueInfo.encoding}</span>}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-4">
            <button
              onClick={handleCopyKey}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Copy key"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={handleCopyValue}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Copy value"
            >
              <Copy className="h-4 w-4" />
            </button>
            {valueInfo.type === 'string' && (
              <button
                onClick={handleEditToggle}
                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                title="Edit value"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleDeleteKey}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
              title="Delete key"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Value Content */}
      <div className="flex-1 p-4 overflow-auto">{renderValue()}</div>
    </div>
  );
};
