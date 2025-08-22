import React, { useEffect, useState, useMemo } from 'react';
import { X, Copy, Check, Search } from 'lucide-react';
import JsonView from '@uiw/react-json-view';
import { githubLightTheme } from '@uiw/react-json-view/githubLight';
import { githubDarkTheme } from '@uiw/react-json-view/githubDark';

interface JsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  title?: string;
}

export const JsonModal: React.FC<JsonModalProps> = ({ isOpen, onClose, data, title = 'JSON Viewer' }) => {
  const [copied, setCopied] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter JSON data based on search term - MUST be before the early return
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    
    const searchLower = searchTerm.toLowerCase();
    
    const containsSearchTerm = (obj: any, searchKey: string): boolean => {
      if (obj === null || obj === undefined) return false;
      
      if (typeof obj === 'string' || typeof obj === 'number') {
        return String(obj).toLowerCase().includes(searchKey);
      }
      
      if (Array.isArray(obj)) {
        return obj.some(item => containsSearchTerm(item, searchKey));
      }
      
      if (typeof obj === 'object') {
        return Object.entries(obj).some(([key, value]) => 
          key.toLowerCase().includes(searchKey) || containsSearchTerm(value, searchKey)
        );
      }
      
      return false;
    };
    
    const filterObject = (obj: any, searchKey: string): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      
      if (Array.isArray(obj)) {
        const filteredArray = obj
          .map(item => filterObject(item, searchKey))
          .filter(item => item !== undefined);
        return filteredArray.length > 0 ? filteredArray : undefined;
      }
      
      const filtered: any = {};
      let hasMatch = false;
      
      for (const [key, value] of Object.entries(obj)) {
        // Always include if key matches
        if (key.toLowerCase().includes(searchKey)) {
          filtered[key] = value; // Keep full value, not filtered
          hasMatch = true;
        }
        // Or if value contains search term (keep full structure)
        else if (containsSearchTerm(value, searchKey)) {
          if (typeof value === 'object' && value !== null) {
            const nestedResult = filterObject(value, searchKey);
            if (nestedResult !== undefined) {
              filtered[key] = nestedResult;
              hasMatch = true;
            }
          } else {
            filtered[key] = value;
            hasMatch = true;
          }
        }
      }
      
      return hasMatch ? filtered : undefined;
    };
    
    const result = filterObject(data, searchLower);
    return result !== undefined ? result : {};
  }, [data, searchTerm]);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="px-3 py-1 text-sm hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle theme"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copy JSON"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search keys or values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className={`flex-1 overflow-auto p-6 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <JsonView
              value={filteredData}
              style={isDarkMode ? githubDarkTheme : githubLightTheme}
              displayDataTypes={false}
              displayObjectSize={true}
              collapsed={searchTerm ? false : 1}
              enableClipboard={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};