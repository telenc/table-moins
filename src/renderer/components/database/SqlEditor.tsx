import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Save, FolderOpen, FileText, AlertCircle, CheckCircle, Clock, Download, PlayCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { TabConnection } from '../../../database/connection-service';
import { ResizableTable } from '../ui/ResizableTable';
import { useSqlEditorStore } from '../../stores/sqlEditorStore';

// ===== CONSTANTES D'AUTOCOMPLÉTION =====

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
  'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA', 'TRIGGER', 'PROCEDURE', 'FUNCTION',
  'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'EXISTS', 'BETWEEN', 'CASE', 'WHEN',
  'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
  'OUTER', 'UNION', 'ALL', 'DISTINCT', 'AS', 'ASC', 'DESC', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'COALESCE', 'CONCAT', 'SUBSTRING', 'LENGTH', 'UPPER', 'LOWER', 'TRIM', 'NOW', 'DATE', 'TIME'
];

const COMMON_COLUMNS = ['id', 'name', 'email', 'created_at', 'updated_at', 'deleted_at', 'status', 'title', 'description'];

// ===== FONCTIONS HELPER D'AUTOCOMPLÉTION =====

/**
 * Génère les suggestions de mots-clés SQL
 */
const getKeywordSuggestions = (currentWord: string, range: any, monaco: any) => {
  const suggestions: any[] = [];
  const isEmpty = currentWord === '';
  
  SQL_KEYWORDS.forEach(keyword => {
    const matchesStart = keyword.toLowerCase().startsWith(currentWord);
    if (matchesStart || isEmpty) {
      suggestions.push({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range: range,
        documentation: `SQL keyword: ${keyword}`,
        sortText: '0' + keyword
      });
    }
  });

  return suggestions;
};

/**
 * Génère les suggestions de tables depuis le cache
 */
const getTableSuggestions = async (currentWord: string, range: any, model: any, position: any, monaco: any, connectionId: string, getCachedDatabase: any) => {
  const suggestions: any[] = [];
  
  try {
    const cachedData = getCachedDatabase(connectionId);
    if (!cachedData) {
      return suggestions;
    }

    const { tables } = cachedData;
    const lineContent = model.getLineContent(position.lineNumber);
    const beforeCursor = lineContent.substring(0, position.column - 1);
    
    // Check if we're after a table name (for column suggestions)
    const tablePattern = /(\w+)\.$|(\w+)\.(\w*)$/;
    const tableMatch = beforeCursor.match(tablePattern);
    
    if (tableMatch) {
      // Suggestions de colonnes pour une table spécifique
      return await getColumnSuggestions(tableMatch[1] || tableMatch[2], currentWord, range, monaco, connectionId);
    } else {
      // Suggestions de tables
      const isEmpty = currentWord === '';
      
      tables.forEach((table: any) => {
        const tableName = table.name.toLowerCase();
        const qualifiedName = `${table.schema}.${table.name}`;
        const qualifiedNameLower = qualifiedName.toLowerCase();
        
        const tableNameMatches = tableName.startsWith(currentWord);
        const qualifiedNameMatches = qualifiedNameLower.startsWith(currentWord);
        
        if (tableNameMatches || qualifiedNameMatches || isEmpty) {
          // Table simple (seulement pour public)
          if (table.schema === 'public' && (tableNameMatches || isEmpty)) {
            suggestions.push({
              label: table.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: table.name,
              range: range,
              documentation: `Table from schema ${table.schema}`,
              sortText: '1' + table.name
            });
          }
          
          // Table qualifiée (schema.table)
          if (qualifiedNameMatches || isEmpty || (tableNameMatches && table.schema !== 'public')) {
            suggestions.push({
              label: qualifiedName,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: qualifiedName,
              range: range,
              documentation: `Table from schema ${table.schema}`,
              sortText: table.schema === 'public' ? '2' + qualifiedName : '3' + qualifiedName
            });
          }
        }
      });
    }
  } catch (error) {
    console.warn('Error getting table suggestions:', error);
  }

  return suggestions;
};

/**
 * Génère les suggestions de colonnes pour une table spécifique
 */
const getColumnSuggestions = async (tableName: string, currentWord: string, range: any, monaco: any, connectionId: string) => {
  const suggestions: any[] = [];
  
  try {
    // Ici on pourrait récupérer les colonnes de la table spécifique
    // Pour l'instant, on ajoute des colonnes communes
    const isEmpty = currentWord === '';
    
    COMMON_COLUMNS.forEach(column => {
      const matchesStart = column.toLowerCase().startsWith(currentWord);
      if (matchesStart || isEmpty) {
        suggestions.push({
          label: column,
          kind: monaco.languages.CompletionItemKind.Field,
          insertText: column,
          range: range,
          documentation: `Common column: ${column}`,
          sortText: '4' + column
        });
      }
    });
  } catch (error) {
    console.warn('Error getting column suggestions:', error);
  }

  return suggestions;
};

interface SqlEditorProps {
  activeTab: TabConnection | null;
  fileName?: string;
  onSave?: (fileName: string, content: string) => void;
  onLoad?: () => void;
  tabId?: string; // Unique identifier for this SQL editor tab
}

interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount?: number;
  executionTime?: number;
  error?: string;
}

export const SqlEditor: React.FC<SqlEditorProps> = ({ 
  activeTab, 
  fileName: initialFileName,
  onSave,
  onLoad,
  tabId
}) => {
  // Each SQL editor tab maintains its own content state
  const editorKey = tabId || activeTab?.id || 'default';
  
  // Use the store to manage content per tab
  const { 
    getEditorContent, 
    setEditorContent, 
    getEditorData, 
    setEditorData,
    getCachedDatabase,
    setCachedDatabase 
  } = useSqlEditorStore();
  
  // Get content from store
  const sqlContent = getEditorContent(editorKey);
  const editorData = getEditorData(editorKey);
  
  const [fileName, setFileName] = useState<string>(editorData?.fileName || initialFileName || 'Untitled.sql');
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  
  // Handle filename change and update store
  const handleFileNameChange = (newFileName: string) => {
    setFileName(newFileName);
    setEditorData(editorKey, { fileName: newFileName });
  };
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResults, setQueryResults] = useState<QueryResult | null>(null);
  const [lastExecutionTime, setLastExecutionTime] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(editorData?.hasUnsavedChanges || false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(editorData?.filePath || null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  
  // Update local state when editor data changes
  useEffect(() => {
    if (editorData) {
      setFileName(editorData.fileName);
      setHasUnsavedChanges(editorData.hasUnsavedChanges);
      if (editorData.filePath) {
        setCurrentFilePath(editorData.filePath);
        // Si on a un filePath, c'est qu'un fichier existant a été chargé
        // Ne mettre à jour originalFileName que si ce n'est pas encore défini
        if (!originalFileName) {
          setOriginalFileName(editorData.fileName);
        }
      }
    }
  }, [editorData, originalFileName]);
  
  // Charger le contenu sauvegardé au montage pour reprendre le travail
  useEffect(() => {
    const loadSavedContent = async () => {
      try {
        const result = await window.electron.invoke('sql-editor:auto-load', editorKey, fileName);
        
        if (result.success && result.content && result.content.trim()) {
          // Si on a du contenu sauvegardé et que le store est vide ou contient le contenu par défaut
          const currentContent = getEditorContent(editorKey);
          if (!currentContent || currentContent === '-- Write your SQL query here\nSELECT * FROM your_table LIMIT 10;') {
            setSqlContent(result.content);
            
            if (result.filePath) {
              setEditorData(editorKey, {
                content: result.content,
                fileName: result.fileName,
                filePath: result.filePath,
                hasUnsavedChanges: false
              });
              
              setCurrentFilePath(result.filePath);
              setHasUnsavedChanges(false);
              setOriginalFileName(result.fileName);
            }
          }
        }
      } catch (error) {
        console.error('Erreur lors du chargement du contenu sauvegardé:', error);
      }
    };
    
    // Charger seulement au premier montage
    loadSavedContent();
  }, [editorKey]); // Ne dépendre que de editorKey pour charger une seule fois
  
  // Update store when local state changes
  const setSqlContent = useCallback((content: string) => {
    setEditorContent(editorKey, content);
  }, [editorKey, setEditorContent]);
  
  
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<any[]>([]);
  
  // Fonction pour charger/recharger le cache
  const loadDatabaseCache = useCallback(async (forceReload = false) => {
    if (!activeTab || !activeTab.isConnected || !activeTab.connectionId) {
      return;
    }
    
    // Vérifier si le cache existe déjà (sauf si on force le rechargement)
    if (!forceReload) {
      const existingCache = getCachedDatabase(activeTab.connectionId);
      if (existingCache && existingCache.lastUpdated) {
        // Cache valide pendant 5 minutes
        const cacheAge = Date.now() - new Date(existingCache.lastUpdated).getTime();
        if (cacheAge < 5 * 60 * 1000) {
          console.log('🔍 Using cached database info');
          return;
        }
      }
    }
      
      console.log('🔍 Loading database schema and tables into cache...');
      
      try {
        // Pour PostgreSQL, récupérer les schémas, pas les bases de données
        let schemas = [];
        try {
          // Essayer d'abord get-schemas (PostgreSQL)
          schemas = await window.electron.invoke('database:get-schemas', activeTab.id);
          console.log('🔍 Got schemas:', schemas);
        } catch (error) {
          // Si ça échoue, essayer get-databases (MySQL/autres)
          console.log('🔍 get-schemas failed, trying get-databases');
          schemas = await window.electron.invoke('database:get-databases', activeTab.id);
        }
        
        const allSchemas = ['public', ...(schemas || [])];
        const uniqueSchemas = [...new Set(allSchemas)];
        
        // Récupérer toutes les tables de tous les schémas
        const allTables: any[] = [];
        for (const schema of uniqueSchemas) {
          try {
            const tables = await window.electron.invoke('database:get-tables', activeTab.id, schema);
            if (tables && tables.length > 0) {
              tables.forEach((table: any) => {
                allTables.push({
                  schema,
                  name: table.name || table.tablename || table,
                  columns: [] // On pourrait charger les colonnes aussi si besoin
                });
              });
            }
          } catch (error) {
            console.warn(`🔍 Could not get tables for schema ${schema}:`, error);
          }
        }
        
        // Sauvegarder dans le cache
        setCachedDatabase(activeTab.connectionId, {
          schemas: uniqueSchemas,
          tables: allTables,
          lastUpdated: new Date()
        });
        
        console.log(`🔍 Cached ${uniqueSchemas.length} schemas and ${allTables.length} tables`);
      } catch (error) {
        console.error('🔍 Error loading database cache:', error);
      }
    }, [activeTab?.connectionId, getCachedDatabase, setCachedDatabase, activeTab?.id]);
  
  // Charger le cache au montage
  useEffect(() => {
    // Forcer le rechargement du cache pour tester
    loadDatabaseCache(true);
  }, [activeTab?.id, activeTab?.isConnected, activeTab?.connectionId]);

  // Track changes for unsaved indicator
  useEffect(() => {
    if (sqlContent !== '-- Write your SQL query here\nSELECT * FROM your_table LIMIT 10;') {
      setHasUnsavedChanges(true);
    }
  }, [sqlContent]);

  const handleSave = useCallback(async () => {
    try {
      setAutoSaveStatus('saving');
      
      // Extraire le nom original du chemin du fichier actuel
      const actualOriginalFileName = currentFilePath ? 
        currentFilePath.split('/').pop()?.replace('.sql', '') || '' : '';
      
      // Debug logs pour comprendre la logique
      console.log('🔍 handleSave DEBUG:', {
        currentFilePath,
        actualOriginalFileName,
        fileName: fileName.replace('.sql', ''),
        hasExistingFile: !!currentFilePath,
        hasChangedName: actualOriginalFileName && actualOriginalFileName !== fileName.replace('.sql', '')
      });
      
      // Si le fichier existe déjà et que le nom a changé, renommer l'ancien fichier
      const hasExistingFile = currentFilePath;
      const hasChangedName = actualOriginalFileName && actualOriginalFileName !== fileName.replace('.sql', '');
      
      if (hasExistingFile && hasChangedName) {
        // Renommer l'ancien fichier
        const renameResult = await window.electron.invoke('sql-editor:rename-file', currentFilePath, fileName);
        
        if (renameResult.success) {
          // Maintenant sauvegarder le contenu dans le fichier renommé
          const saveResult = await window.electron.invoke('sql-editor:auto-save', editorKey, sqlContent, renameResult.newFileName);
          
          if (saveResult.success) {
            // Mettre à jour avec le nouveau chemin
            setCurrentFilePath(saveResult.filePath);
            setAutoSaveStatus('saved');
            setHasUnsavedChanges(false);
            
            // Mettre à jour le store
            setEditorData(editorKey, {
              hasUnsavedChanges: false,
              filePath: saveResult.filePath,
              fileName: saveResult.fileName
            });
            
            console.log('File renamed and saved successfully:', saveResult.filePath);
            
            if (onSave) {
              onSave(saveResult.fileName, sqlContent);
            }
            
            // Mettre à jour le nom original après succès pour futurs changements
            setOriginalFileName(saveResult.fileName);
            
            // Émettre un événement pour notifier le DatabaseExplorer du changement
            const event = new CustomEvent('queries-updated');
            window.dispatchEvent(event);
            
            // Effacer le statut après 2 secondes
            setTimeout(() => setAutoSaveStatus(null), 2000);
          } else {
            console.error('Error saving renamed file:', saveResult.error);
            setAutoSaveStatus('error');
            setTimeout(() => setAutoSaveStatus(null), 3000);
          }
        } else {
          console.error('Error renaming file:', renameResult.error);
          setAutoSaveStatus('error');
          setTimeout(() => setAutoSaveStatus(null), 3000);
        }
      } else {
        // Utiliser notre système de sauvegarde automatique normal
        const result = await window.electron.invoke('sql-editor:auto-save', editorKey, sqlContent, fileName);
        
        if (result.success) {
          setAutoSaveStatus('saved');
          setCurrentFilePath(result.filePath);
          setFileName(result.fileName);
          setHasUnsavedChanges(false);
          
          // Mettre à jour le store
          setEditorData(editorKey, {
            hasUnsavedChanges: false,
            filePath: result.filePath,
            fileName: result.fileName
          });
          
          console.log('File saved successfully:', result.filePath);
        
          if (onSave) {
            onSave(result.fileName, sqlContent);
          }
          
          // Mettre à jour le nom original après succès pour futurs changements
          setOriginalFileName(result.fileName);
          
          // Émettre un événement pour notifier le DatabaseExplorer du changement
          const event = new CustomEvent('queries-updated');
          window.dispatchEvent(event);
          
          // Effacer le statut après 2 secondes
          setTimeout(() => setAutoSaveStatus(null), 2000);
        } else {
          setAutoSaveStatus('error');
          console.error('Error saving file:', result.error);
          setTimeout(() => setAutoSaveStatus(null), 3000);
        }
      }
    } catch (error) {
      setAutoSaveStatus('error');
      console.error('Error saving file:', error);
      setTimeout(() => setAutoSaveStatus(null), 3000);
    }
  }, [editorKey, sqlContent, fileName, onSave, setEditorData, getEditorData, currentFilePath, originalFileName]);

  const handleSaveAs = useCallback(async () => {
    try {
      const result = await window.electronAPI.sqlFile.saveAs(sqlContent, fileName);
      
      if (!result.canceled && result.filePath) {
        setCurrentFilePath(result.filePath);
        setFileName(result.fileName || 'Untitled.sql');
        setHasUnsavedChanges(false);
        console.log('File saved as:', result.filePath);
        
        if (onSave) {
          onSave(result.fileName || 'Untitled.sql', sqlContent);
        }
      }
    } catch (error) {
      console.error('Error saving file as:', error);
    }
  }, [sqlContent, fileName, onSave]);

  const handleLoad = useCallback(async () => {
    try {
      const result = await window.electronAPI.sqlFile.open();
      
      if (!result.canceled && result.content) {
        setSqlContent(result.content);
        setFileName(result.fileName || 'Untitled.sql');
        setCurrentFilePath(result.filePath || null);
        setHasUnsavedChanges(false);
        setQueryResults(null); // Clear previous results
        console.log('File loaded successfully:', result.filePath);
        
        if (onLoad) {
          onLoad();
        }
      }
    } catch (error) {
      console.error('Error loading file:', error);
    }
  }, [onLoad]);

  /**
   * Update editor decorations to highlight the active query
   */
  const updateQueryHighlight = useCallback(() => {
    if (!editorRef.current || !monacoRef.current) {
      return;
    }

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const position = editor.getPosition();
    
    if (!position) {
      return;
    }

    // Get the current content directly from the editor
    const model = editor.getModel();
    if (!model) {
      return;
    }
    
    const currentContent = model.getValue();
    
    // Parse SQL content to find queries
    const lines = currentContent.split('\n');
    const queries: { startLine: number; endLine: number; text: string }[] = [];
    let currentQueryLines: number[] = [];
    let inQuery = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines between queries
      if (!trimmedLine && !inQuery) {
        continue;
      }
      
      // Start tracking a query
      if (trimmedLine && !inQuery) {
        inQuery = true;
        currentQueryLines = [i];
      } else if (inQuery) {
        currentQueryLines.push(i);
      }
      
      // Check if this line ends the query (has semicolon at the end)
      if (inQuery && trimmedLine.endsWith(';')) {
        // Remove trailing empty lines from the query
        while (currentQueryLines.length > 0) {
          const lastLineIdx = currentQueryLines[currentQueryLines.length - 1];
          if (!lines[lastLineIdx].trim() && !lines[lastLineIdx].endsWith(';')) {
            currentQueryLines.pop();
          } else {
            break;
          }
        }
        
        if (currentQueryLines.length > 0) {
          const queryText = currentQueryLines.map(idx => lines[idx]).join('\n').trim();
          if (queryText) {
            queries.push({
              startLine: currentQueryLines[0] + 1, // Monaco uses 1-based indexing
              endLine: currentQueryLines[currentQueryLines.length - 1] + 1,
              text: queryText
            });
          }
        }
        
        inQuery = false;
        currentQueryLines = [];
      }
    }
    
    // Handle query without semicolon at the end
    if (inQuery && currentQueryLines.length > 0) {
      // Remove trailing empty lines
      while (currentQueryLines.length > 0) {
        const lastLineIdx = currentQueryLines[currentQueryLines.length - 1];
        if (!lines[lastLineIdx].trim()) {
          currentQueryLines.pop();
        } else {
          break;
        }
      }
      
      if (currentQueryLines.length > 0) {
        const queryText = currentQueryLines.map(idx => lines[idx]).join('\n').trim();
        if (queryText) {
          queries.push({
            startLine: currentQueryLines[0] + 1,
            endLine: currentQueryLines[currentQueryLines.length - 1] + 1,
            text: queryText
          });
        }
      }
    }
    
    // Find which query contains the cursor
    let currentQuery: { startLine: number; endLine: number } | null = null;
    const cursorLine = position.lineNumber;
    
    // console.log('🔍 DEBUG Highlight - Cursor at line:', cursorLine);
    // console.log('🔍 DEBUG Highlight - Found queries:', queries);
    
    for (const query of queries) {
      // Check if cursor is within the query bounds (inclusive)
      if (cursorLine >= query.startLine && cursorLine <= query.endLine) {
        currentQuery = {
          startLine: query.startLine,
          endLine: query.endLine
        };
        // console.log('🔍 DEBUG Highlight - Active query:', query.text.substring(0, 50) + '...');
        break;
      }
    }

    // Clear old decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      []
    );

    // Add new decorations
    if (currentQuery) {
      const newDecorations = [
        // Barre colorée dans la marge gauche
        {
          range: new monaco.Range(
            currentQuery.startLine,
            1,
            currentQuery.endLine,
            1
          ),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'active-query-line-decoration',
            className: 'active-query-highlight'
          }
        },
        // Surbrillance du texte
        {
          range: new monaco.Range(
            currentQuery.startLine,
            1,
            currentQuery.endLine,
            Number.MAX_SAFE_INTEGER
          ),
          options: {
            inlineClassName: 'active-query-text'
          }
        }
      ];
      
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        newDecorations
      );
    }
  }, []);

  // Update highlights when content changes
  useEffect(() => {
    if (editorRef.current) {
      updateQueryHighlight();
    }
  }, [sqlContent, updateQueryHighlight]);

  /**
   * Extract the query at the cursor position
   * Handles multi-line queries and multiple queries separated by semicolons
   */
  const getQueryAtCursor = useCallback((): string => {
    // If editor is not ready, fallback to full content
    if (!editorRef.current) {
      console.log('🔍 DEBUG getQueryAtCursor - Editor not ready, returning full content');
      return sqlContent.trim();
    }

    const editor = editorRef.current;
    const position = editor.getPosition();
    if (!position) {
      console.log('🔍 DEBUG getQueryAtCursor - No cursor position, returning full content');
      return sqlContent.trim();
    }

    const model = editor.getModel();
    if (!model) {
      console.log('🔍 DEBUG getQueryAtCursor - No model, returning full content');
      return sqlContent.trim();
    }

    const fullText = model.getValue();
    const lines = fullText.split('\n');
    
    // Find all query boundaries (semicolons at end of line or standalone)
    const queries: { start: number; end: number; text: string }[] = [];
    let currentQuery = '';
    let queryStartLine = 0;
    let inComment = false;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let lineContent = '';
      
      // Parse the line character by character to handle strings and comments
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];
        
        // Handle string literals
        if (!inComment) {
          if ((char === "'" || char === '"') && (j === 0 || line[j - 1] !== '\\')) {
            if (!inString) {
              inString = true;
              stringChar = char;
            } else if (char === stringChar) {
              inString = false;
              stringChar = '';
            }
          }
        }
        
        // Handle comments
        if (!inString) {
          if (char === '-' && nextChar === '-') {
            inComment = true;
            j++; // Skip next char
            continue;
          }
        }
        
        if (!inComment) {
          lineContent += char;
        }
      }
      
      // Reset comment flag at end of line (SQL comments are single-line)
      inComment = false;
      
      // Check if this line ends a query (has semicolon at the end)
      const trimmedLine = lineContent.trim();
      if (trimmedLine.length > 0) {
        if (currentQuery.length === 0) {
          queryStartLine = i;
        }
        currentQuery += (currentQuery.length > 0 ? '\n' : '') + line;
        
        // Check if line ends with semicolon (outside of strings)
        if (!inString && trimmedLine.endsWith(';')) {
          queries.push({
            start: queryStartLine,
            end: i,
            text: currentQuery.trim()
          });
          currentQuery = '';
        }
      } else if (currentQuery.length > 0) {
        // Add empty lines to maintain query structure
        currentQuery += '\n' + line;
      }
    }
    
    // Add remaining query if no semicolon at the end
    if (currentQuery.trim().length > 0) {
      queries.push({
        start: queryStartLine,
        end: lines.length - 1,
        text: currentQuery.trim()
      });
    }
    
    // Find which query contains the cursor
    const cursorLine = position.lineNumber - 1; // Monaco uses 1-based indexing
    
    console.log('🔍 DEBUG getQueryAtCursor - Cursor line:', cursorLine);
    console.log('🔍 DEBUG getQueryAtCursor - Found queries:', queries);
    
    for (const query of queries) {
      if (cursorLine >= query.start && cursorLine <= query.end) {
        console.log('🔍 DEBUG getQueryAtCursor - Selected query:', query.text);
        return query.text;
      }
    }
    
    // If no query found at cursor, return the full content
    console.log('🔍 DEBUG getQueryAtCursor - No query at cursor, returning full content');
    return sqlContent.trim();
  }, [sqlContent]);

  const executeQuery = useCallback(async (forceFullContent = false) => {
    if (!activeTab || !activeTab.isConnected) {
      return;
    }

    // Get the query to execute
    let queryToExecute: string = '';
    
    // Try to get query at cursor first
    console.log('🔍 DEBUG - Editor ref exists:', !!editorRef.current);
    console.log('🔍 DEBUG - Force full content:', forceFullContent);
    
    if (editorRef.current && !forceFullContent) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      console.log('🔍 DEBUG - Editor position:', position);
      
      if (position) {
        // Split content by semicolons to find individual queries
        const queries: { text: string; startLine: number; endLine: number }[] = [];
        const lines = sqlContent.split('\n');
        let currentQuery = '';
        let startLine = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (currentQuery === '' && line.trim() !== '') {
            startLine = i;
          }
          
          currentQuery += (currentQuery ? '\n' : '') + line;
          
          // Check if line ends with semicolon
          if (line.trim().endsWith(';')) {
            if (currentQuery.trim()) {
              queries.push({
                text: currentQuery.trim(),
                startLine: startLine,
                endLine: i
              });
            }
            currentQuery = '';
          }
        }
        
        // Add last query if no semicolon at the end
        if (currentQuery.trim()) {
          queries.push({
            text: currentQuery.trim(),
            startLine: startLine,
            endLine: lines.length - 1
          });
        }
        
        // Find which query contains the cursor
        const cursorLine = position.lineNumber - 1; // Monaco uses 1-based indexing
        console.log('🔍 DEBUG - Cursor at line:', cursorLine);
        console.log('🔍 DEBUG - Found queries:', queries);
        
        for (const query of queries) {
          if (cursorLine >= query.startLine && cursorLine <= query.endLine) {
            queryToExecute = query.text;
            console.log('🔍 DEBUG - Executing query at cursor position');
            break;
          }
        }
        
        // If no query found at cursor, use first query
        if (!queryToExecute && queries.length > 0) {
          queryToExecute = queries[0].text;
          console.log('🔍 DEBUG - No query at cursor, using first query');
        }
      } else {
        // No cursor position, use first query
        const queries = sqlContent.split(';').map(q => q.trim()).filter(q => q.length > 0);
        queryToExecute = queries[0] || sqlContent.trim();
      }
    } else {
      // Editor not ready, use simple approach
      const queries = sqlContent.split(';').map(q => q.trim()).filter(q => q.length > 0);
      queryToExecute = queries[0] || sqlContent.trim();
    }
    
    queryToExecute = queryToExecute || sqlContent.trim();
    
    if (!queryToExecute.trim()) {
      return;
    }

    setIsExecuting(true);
    setQueryResults(null);
    
    try {
      console.log('🔍 DEBUG SqlEditor - Executing SQL:', queryToExecute);
      console.log('🔍 DEBUG SqlEditor - Active tab ID:', activeTab.id);
      console.log('🔍 DEBUG SqlEditor - Active tab connected:', activeTab.isConnected);
      
      const startTime = Date.now();
      const result = await window.electron.invoke('database:execute-query', activeTab.id, queryToExecute);
      const executionTime = Date.now() - startTime;
      
      console.log('🔍 DEBUG SqlEditor - Query result:', result);
      
      if (result.error) {
        setQueryResults({
          columns: [],
          rows: [],
          error: result.error,
          executionTime
        });
      } else {
        // Handle both 'columns' and 'fields' from different database drivers
        const columns = result.columns || result.fields || [];
        const columnNames = columns.map((col: any) => 
          typeof col === 'string' ? col : col.name
        );
        
        setQueryResults({
          columns: columnNames,
          rows: result.rows || [],
          rowCount: result.rows?.length || 0,
          executionTime
        });
      }
      
      setLastExecutionTime(new Date());
    } catch (error) {
      console.error('Error executing SQL query:', error);
      setQueryResults({
        columns: [],
        rows: [],
        error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        executionTime: 0
      });
    } finally {
      setIsExecuting(false);
    }
  }, [activeTab, getQueryAtCursor, sqlContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl shortcuts
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            if (event.shiftKey) {
              handleSaveAs();
            } else {
              handleSave();
            }
            break;
          case 'o':
            event.preventDefault();
            handleLoad();
            break;
          // Note: Enter shortcuts are now handled directly by Monaco Editor
          // to avoid conflicts with the editor's default behavior
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleLoad, executeQuery, sqlContent, activeTab]);


  const formatExecutionTime = (time: number) => {
    if (time < 1000) {
      return `${time}ms`;
    } else {
      return `${(time / 1000).toFixed(2)}s`;
    }
  };

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">No active connection</p>
          <p className="text-sm">Connect to a database to use the SQL editor</p>
        </div>
      </div>
    );
  }

  if (!activeTab.isConnected) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p className="mb-2">Connection not active</p>
          <p className="text-sm">Please connect to the database first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-600" />
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fileName}
              onChange={(e) => handleFileNameChange(e.target.value)}
              className="text-sm font-medium bg-transparent border-0 outline-none min-w-32"
              placeholder="Enter filename..."
            />
            {currentFilePath && (
              <span className="text-xs text-gray-400" title={currentFilePath}>
                ({currentFilePath.split('/').slice(-2, -1)[0] || 'Desktop'})
              </span>
            )}
            {hasUnsavedChanges && <span className="text-orange-500 text-xs">●</span>}
            {autoSaveStatus === 'saving' && (
              <span className="text-blue-500 text-xs flex items-center gap-1" title="Auto-saving...">
                <Clock className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-green-500 text-xs flex items-center gap-1" title="Auto-saved">
                <CheckCircle className="h-3 w-3" />
                Saved
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-red-500 text-xs flex items-center gap-1" title="Auto-save error">
                <AlertCircle className="h-3 w-3" />
                Error
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoad}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Open file (Ctrl+O)"
          >
            <FolderOpen className="h-3 w-3" />
            Open
          </button>
          
          <button
            onClick={handleSave}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Save file (Ctrl+S)"
          >
            <Save className="h-3 w-3" />
            Save
          </button>
          
          <button
            onClick={handleSaveAs}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Save As... (Ctrl+Shift+S)"
          >
            <Download className="h-3 w-3" />
            Save As
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-1" />
          
          <button
            onClick={() => executeQuery(false)}
            disabled={isExecuting}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Execute query at cursor (⌘+Enter / Ctrl+Enter)"
          >
            {isExecuting ? (
              <Clock className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {isExecuting ? 'Running...' : 'Run at Cursor'}
          </button>
          
          <button
            onClick={() => {
              // Execute all content
              const allQueries = sqlContent.trim();
              if (allQueries) {
                setIsExecuting(true);
                setQueryResults(null);
                
                window.electron.invoke('database:execute-query', activeTab.id, allQueries)
                  .then((result: any) => {
                    console.log('🔍 DEBUG SqlEditor - All queries result:', result);
                    if (result.error) {
                      setQueryResults({
                        columns: [],
                        rows: [],
                        error: result.error,
                        executionTime: 0
                      });
                    } else {
                      const columns = result.columns || result.fields || [];
                      const columnNames = columns.map((col: any) => 
                        typeof col === 'string' ? col : col.name
                      );
                      
                      setQueryResults({
                        columns: columnNames,
                        rows: result.rows || [],
                        rowCount: result.rows?.length || 0,
                        executionTime: result.executionTime || 0
                      });
                    }
                    setLastExecutionTime(new Date());
                  })
                  .catch((error: any) => {
                    console.error('Error executing all queries:', error);
                    setQueryResults({
                      columns: [],
                      rows: [],
                      error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                      executionTime: 0
                    });
                  })
                  .finally(() => {
                    setIsExecuting(false);
                  });
              }
            }}
            disabled={isExecuting || !sqlContent.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Execute all queries (⇧+⌘+Enter / Shift+Ctrl+Enter)"
          >
            {isExecuting ? (
              <Clock className="h-3 w-3 animate-spin" />
            ) : (
              <PlayCircle className="h-3 w-3" />
            )}
            {isExecuting ? 'Running...' : 'Run All'}
          </button>
        </div>
      </div>

      {/* SQL Editor */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Code Editor Area */}
        <div className="border-b border-gray-200" style={{ height: '400px' }}>
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={sqlContent}
            onChange={(value) => {
              const newContent = value || '';
              setSqlContent(newContent);
              
              // Marquer comme non sauvegardé
              if (newContent !== '-- Write your SQL query here\nSELECT * FROM your_table LIMIT 10;') {
                setHasUnsavedChanges(true);
                setEditorData(editorKey, { hasUnsavedChanges: true });
              }
            }}
            onMount={(editor, monaco) => {
              console.log('🔍 DEBUG - Monaco Editor mounted');
              editorRef.current = editor;
              monacoRef.current = monaco;
              
              // Set focus to editor when mounted
              editor.focus();
              
              // Register SQL autocompletion provider
              const disposable = monaco.languages.registerCompletionItemProvider('sql', {
                provideCompletionItems: async (model, position) => {
                  const word = model.getWordUntilPosition(position);
                  const currentWord = word.word.toLowerCase();
                  
                  const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                  };

                  const suggestions = [];

                  // Ajouter les suggestions de mots-clés
                  suggestions.push(...getKeywordSuggestions(currentWord, range, monaco));

                  // Ajouter les suggestions de tables depuis le cache
                  if (activeTab?.isConnected && activeTab.connectionId) {
                    suggestions.push(...await getTableSuggestions(currentWord, range, model, position, monaco, activeTab.connectionId, getCachedDatabase));
                  }

                  // Ancien code supprimé - utilise maintenant les fonctions refactorisées
                  /*
                  console.log('🔍 Filtering keywords - currentWord:', `"${currentWord}"`, 'length:', currentWord.length);
                  let addedKeywords = 0;
                  SQL_KEYWORDS.forEach(keyword => {
                    const matchesStart = keyword.toLowerCase().startsWith(currentWord);
                    const isEmpty = currentWord === '';
                    console.log(`🔍 Keyword "${keyword}" - matches start: ${matchesStart}, isEmpty: ${isEmpty}, condition: ${matchesStart || isEmpty}`);
                    
                    if (matchesStart || isEmpty) {
                      suggestions.push({
                        label: keyword,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: keyword,
                        range: range,
                        documentation: `SQL keyword: ${keyword}`,
                        sortText: '0' + keyword // Priority for keywords
                      });
                      addedKeywords++;
                    }
                  });
                  console.log('🔍 Added', addedKeywords, 'keywords out of', sqlKeywords.length);

                  // Get table names and columns from CACHE
                  if (activeTab && activeTab.isConnected && activeTab.connectionId) {
                    try {
                      console.log('🔍 Getting tables from cache for autocompletion');
                      
                      // Utiliser le cache au lieu de faire des requêtes
                      const cachedData = getCachedDatabase(activeTab.connectionId);
                      
                      if (!cachedData) {
                        console.warn('🔍 No cache available yet, skipping table suggestions');
                        return { suggestions };
                      }
                      
                      const { schemas, tables } = cachedData;
                      console.log(`🔍 Using cached data: ${schemas.length} schemas, ${tables.length} tables`);
                      
                      // Get current line text to detect context
                      const lineContent = model.getLineContent(position.lineNumber);
                      const beforeCursor = lineContent.substring(0, position.column - 1);
                      
                      // Check if we're after a table name (for column suggestions)
                      const tablePattern = /(\w+)\.$|(\w+)\.(\w*)$/;
                      const tableMatch = beforeCursor.match(tablePattern);
                      
                      if (tableMatch) {
                        // We're typing after a table name, suggest columns
                        const tableName = tableMatch[1] || tableMatch[2];
                        console.log('🔍 Suggesting columns for table:', tableName);
                        
                        // TODO: On pourrait charger les colonnes dans le cache aussi
                        // Pour l'instant, on fait toujours la requête pour les colonnes
                        const tableInfo = tables.find(t => t.name === tableName);
                        if (tableInfo) {
                          try {
                            const columns = await window.electron.invoke('database:get-table-structure', activeTab.id, tableInfo.schema, tableName);
                            if (columns) {
                              columns.forEach((column: any) => {
                                const columnName = column.column_name || column.name || column.Field || column;
                                const dataType = column.data_type || column.type || column.Type || 'unknown';
                                suggestions.push({
                                  label: columnName,
                                  kind: monaco.languages.CompletionItemKind.Field,
                                  insertText: columnName,
                                  range: range,
                                  documentation: `Column: ${columnName} (${dataType}) from table ${tableName}`,
                                  sortText: '0' + columnName // High priority for specific table columns
                                });
                              });
                            }
                          } catch (error) {
                            console.warn('Error fetching columns for table:', tableName, error);
                          }
                        }
                      } else {
                        // Suggérer les tables depuis le cache
                        console.log('🔍 Filtering cached tables for word:', `"${currentWord}"`);
                        let addedTables = 0;
                        
                        tables.forEach(table => {
                          const tableName = table.name.toLowerCase();
                          const qualifiedName = `${table.schema}.${table.name}`;
                          const qualifiedNameLower = qualifiedName.toLowerCase();
                          const isEmpty = currentWord === '';
                          
                          // Check if table name or qualified name matches
                          const tableNameMatches = tableName.startsWith(currentWord);
                          const qualifiedNameMatches = qualifiedNameLower.startsWith(currentWord);
                          
                          if (tableNameMatches || qualifiedNameMatches || isEmpty) {
                            // Suggérer le nom simple de la table (seulement si schema est public et le nom simple correspond)
                            if (table.schema === 'public' && (tableNameMatches || isEmpty)) {
                              suggestions.push({
                                label: table.name,
                                kind: monaco.languages.CompletionItemKind.Class,
                                insertText: table.name,
                                range: range,
                                documentation: `Table from schema ${table.schema}`,
                                sortText: '1' + table.name // Priorité pour public
                              });
                              addedTables++;
                            }
                            
                            // Toujours suggérer avec le schéma pour clarité (schema.table)
                            if (qualifiedNameMatches || isEmpty || (tableNameMatches && table.schema !== 'public')) {
                              suggestions.push({
                                label: qualifiedName,
                                kind: monaco.languages.CompletionItemKind.Class,
                                insertText: qualifiedName,
                                range: range,
                                documentation: `Table from schema ${table.schema}`,
                                sortText: table.schema === 'public' ? '2' + qualifiedName : '3' + qualifiedName
                              });
                              addedTables++;
                            }
                          }
                        });
                        
                        console.log(`🔍 Added ${addedTables} table suggestions from cache`);
                        
                        // Also suggest common columns that might exist across tables
                        const commonColumns = ['id', 'name', 'email', 'created_at', 'updated_at', 'deleted_at', 'status', 'title', 'description'];
                        commonColumns.forEach(column => {
                          if (column.toLowerCase().startsWith(currentWord) || currentWord === '') {
                            suggestions.push({
                              label: column,
                              kind: monaco.languages.CompletionItemKind.Field,
                              insertText: column,
                              range: range,
                              documentation: `Common column: ${column}`,
                              sortText: '4' + column // Lower priority for common columns
                            });
                          }
                        });
                      }
                    } catch (error) {
                      console.warn('Error fetching database info for autocompletion:', error);
                    }
                  }
                  */

                  // Déduplication des suggestions par label pour éviter les doublons
                  const uniqueSuggestions = suggestions.reduce((acc: any[], current: any) => {
                    const exists = acc.find((item: any) => item.label === current.label);
                    if (!exists) {
                      acc.push(current);
                    }
                    return acc;
                  }, []);

                  // Debug: Show first few suggestions with more detail
                  const debugSuggestions = uniqueSuggestions.slice(0, 5).map((s: any) => ({ label: s.label, kind: s.kind }));
                  console.log('🔍 SQL Autocompletion returning', uniqueSuggestions.length, 'unique suggestions (from', suggestions.length, 'total) for word "' + currentWord + '":', debugSuggestions);
                  return { suggestions: uniqueSuggestions };
                }
              });

              // Store disposable for cleanup
              (editor as any)._sqlCompletionDisposable = disposable;
              
              // Add custom keyboard shortcuts directly to Monaco
              // Cmd/Ctrl + Enter = Run at cursor
              editor.addAction({
                id: 'run-query-at-cursor',
                label: 'Run Query at Cursor',
                keybindings: [
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
                ],
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.5,
                run: () => {
                  console.log('🔍 Monaco Shortcut: Run at Cursor');
                  // Get the current position
                  const position = editor.getPosition();
                  if (!position) {
                    return;
                  }
                  
                  // Get current content from editor
                  const currentContent = editor.getValue();
                  const lines = currentContent.split('\n');
                  
                  // Find queries
                  const queries: { text: string; startLine: number; endLine: number }[] = [];
                  let currentQuery = '';
                  let startLine = 0;
                  
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    if (currentQuery === '' && line.trim() !== '') {
                      startLine = i;
                    }
                    
                    currentQuery += (currentQuery ? '\n' : '') + line;
                    
                    // Check if line ends with semicolon
                    if (line.trim().endsWith(';')) {
                      if (currentQuery.trim()) {
                        queries.push({
                          text: currentQuery.trim(),
                          startLine: startLine,
                          endLine: i
                        });
                      }
                      currentQuery = '';
                    }
                  }
                  
                  // Add last query if no semicolon at the end
                  if (currentQuery.trim()) {
                    queries.push({
                      text: currentQuery.trim(),
                      startLine: startLine,
                      endLine: lines.length - 1
                    });
                  }
                  
                  // Find which query contains the cursor
                  const cursorLine = position.lineNumber - 1; // Monaco uses 1-based indexing
                  let queryToExecute = '';
                  
                  for (const query of queries) {
                    if (cursorLine >= query.startLine && cursorLine <= query.endLine) {
                      queryToExecute = query.text;
                      console.log('🔍 Monaco - Executing query at cursor');
                      break;
                    }
                  }
                  
                  // If no query found at cursor, use first query
                  if (!queryToExecute && queries.length > 0) {
                    queryToExecute = queries[0].text;
                    console.log('🔍 Monaco - No query at cursor, using first query');
                  }
                  
                  if (!queryToExecute) {
                    queryToExecute = currentContent.trim();
                  }
                  
                  // Execute the query
                  if (queryToExecute && activeTab && activeTab.isConnected) {
                    console.log('🔍 Monaco - Executing SQL:', queryToExecute);
                    setIsExecuting(true);
                    setQueryResults(null);
                    
                    window.electron.invoke('database:execute-query', activeTab.id, queryToExecute)
                      .then((result: any) => {
                        if (result.error) {
                          setQueryResults({
                            columns: [],
                            rows: [],
                            error: result.error,
                            executionTime: 0
                          });
                        } else {
                          const columns = result.columns || result.fields || [];
                          const columnNames = columns.map((col: any) => 
                            typeof col === 'string' ? col : col.name
                          );
                          
                          setQueryResults({
                            columns: columnNames,
                            rows: result.rows || [],
                            rowCount: result.rows?.length || 0,
                            executionTime: result.executionTime || 0
                          });
                        }
                        setLastExecutionTime(new Date());
                      })
                      .catch((error: any) => {
                        setQueryResults({
                          columns: [],
                          rows: [],
                          error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                          executionTime: 0
                        });
                      })
                      .finally(() => {
                        setIsExecuting(false);
                      });
                  }
                }
              });
              
              // Shift + Cmd/Ctrl + Enter = Run all
              editor.addAction({
                id: 'run-all-queries',
                label: 'Run All Queries',
                keybindings: [
                  monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter
                ],
                contextMenuGroupId: 'navigation',
                contextMenuOrder: 1.6,
                run: () => {
                  console.log('🔍 Monaco Shortcut: Run All');
                  const allQueries = editor.getValue().trim();
                  if (allQueries && activeTab && activeTab.isConnected) {
                    setIsExecuting(true);
                    setQueryResults(null);
                    
                    window.electron.invoke('database:execute-query', activeTab.id, allQueries)
                      .then((result: any) => {
                        if (result.error) {
                          setQueryResults({
                            columns: [],
                            rows: [],
                            error: result.error,
                            executionTime: 0
                          });
                        } else {
                          const columns = result.columns || result.fields || [];
                          const columnNames = columns.map((col: any) => 
                            typeof col === 'string' ? col : col.name
                          );
                          
                          setQueryResults({
                            columns: columnNames,
                            rows: result.rows || [],
                            rowCount: result.rows?.length || 0,
                            executionTime: result.executionTime || 0
                          });
                        }
                        setLastExecutionTime(new Date());
                      })
                      .catch((error: any) => {
                        setQueryResults({
                          columns: [],
                          rows: [],
                          error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                          executionTime: 0
                        });
                      })
                      .finally(() => {
                        setIsExecuting(false);
                      });
                  }
                }
              });
              
              // Add cursor position change listener
              editor.onDidChangeCursorPosition(() => {
                // Use a timeout to ensure we get the latest content
                setTimeout(() => {
                  updateQueryHighlight();
                }, 0);
              });
              
              // Initial highlight with delay
              setTimeout(() => {
                updateQueryHighlight();
              }, 100);
            }}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible'
              },
              automaticLayout: true,
              tabSize: 2,
              insertSpaces: true,
              wordWrap: 'on',
              folding: true,
              lineHeight: 20,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              // Autocompletion options
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              parameterHints: { enabled: true },
              suggest: {
                showKeywords: true,
                showSnippets: true,
                showClasses: true,
                showFunctions: true,
                showVariables: true,
                showFields: true
              }
            }}
            loading={
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500 animate-spin" />
                  <p className="text-sm">Loading SQL editor...</p>
                </div>
              </div>
            }
          />
        </div>
        
        {/* Results Area */}
        <div className="flex-1 flex flex-col bg-white min-h-0">
          {/* Results Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900">Query Results</h3>
            {lastExecutionTime && (
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {queryResults?.executionTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatExecutionTime(queryResults.executionTime)}
                  </span>
                )}
                {queryResults?.rowCount !== undefined && !queryResults.error && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    {queryResults.rowCount} rows
                  </span>
                )}
                <span>Last run: {lastExecutionTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          
          {/* Results Content */}
          <div className="flex-1 overflow-auto">
            {!queryResults && !isExecuting && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Play className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Click "Run" to execute your query</p>
                </div>
              </div>
            )}
            
            {isExecuting && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500 animate-spin" />
                  <p className="text-sm">Executing query...</p>
                </div>
              </div>
            )}
            
            {queryResults?.error && (
              <div className="p-4">
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-900">Query Error</h4>
                    <pre className="mt-1 text-xs text-red-700 whitespace-pre-wrap font-mono">
                      {queryResults.error}
                    </pre>
                  </div>
                </div>
              </div>
            )}
            
            {queryResults && !queryResults.error && queryResults.rows.length > 0 && (
              <ResizableTable
                columns={queryResults.columns.map(column => ({
                  key: column,
                  title: column,
                  render: (value: any) => {
                    if (value === null || value === undefined) {
                      return <span className="text-gray-400 italic">NULL</span>;
                    }
                    return <div className="truncate" title={String(value)}>{String(value)}</div>;
                  }
                }))}
                data={queryResults.rows}
                className="h-full"
                maxHeight="none"
              />
            )}
            
            {queryResults && !queryResults.error && queryResults.rows.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">Query executed successfully</p>
                  <p className="text-xs text-gray-400">No rows returned</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};