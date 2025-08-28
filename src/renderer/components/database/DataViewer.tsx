import React, { useState, useEffect, useRef } from 'react';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database,
  Columns,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Filter,
} from 'lucide-react';
import { TabConnection } from '../../../database/connection-service';
import { ResizableTable } from '../ui/ResizableTable';
import { FilterPanel, FilterCondition, FilterMode } from '../ui/FilterPanel';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';
import JsonView from '@uiw/react-json-view';
import { Search, Copy, Check, X as XIcon } from 'lucide-react';
import { useMemo } from 'react';

interface DataViewerProps {
  activeTab: TabConnection | null;
  tableName?: string;
  tabId?: string;
  onBack?: () => void;
  sqlFilter?: string;
  onForeignKeyClick?: (targetTable: string, targetColumn: string, value: any) => void;
}

interface TableData {
  columns: string[];
  rows: any[];
  total?: number;
}

interface ColumnStructure {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: any;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
  comment: string;
  foreignKeyTable?: string;
  foreignKeyColumn?: string;
  isReferencedByOtherTables?: boolean;
  referencedByTables?: Array<{
    table: string;
    column: string;
  }>;
}

interface IndexInfo {
  name: string;
  algorithm: string;
  isUnique: boolean;
  columnName: string;
  condition: string;
  include: string;
  comment: string;
}

type ViewMode = 'data' | 'structure';

interface EditingCell {
  rowIndex: number;
  field: keyof ColumnStructure;
  value: string;
}

interface EditingDataCell {
  rowIndex: number;
  columnKey: string;
  value: string;
}

export const DataViewer: React.FC<DataViewerProps> = ({
  activeTab,
  tableName,
  tabId,
  onBack,
  sqlFilter,
  onForeignKeyClick,
}) => {
  const [data, setData] = useState<TableData | null>(null);
  const [structure, setStructure] = useState<ColumnStructure[] | null>(null);
  const [indexes, setIndexes] = useState<IndexInfo[] | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('data');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editingDataCell, setEditingDataCell] = useState<EditingDataCell | null>(null);
  // JSON viewer state (now managed per table, but kept for current table)
  const [jsonViewerData, setJsonViewerData] = useState<any>(null);
  const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
  const [jsonSearchTerm, setJsonSearchTerm] = useState('');
  const [jsonCopied, setJsonCopied] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [whereClause, setWhereClause] = useState<string>('');
  const [filterMode, setFilterMode] = useState<FilterMode>('builder');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);

  // State pour gérer les modifications des cellules
  const [modifiedCells, setModifiedCells] = useState<
    Map<
      string,
      {
        rowIndex: number;
        columnKey: string;
        originalValue: any;
        newValue: any;
        rowPrimaryKey: { [columnName: string]: any };
      }
    >
  >(new Map());
  const [originalData, setOriginalData] = useState<TableData | null>(null);
  const [savingChanges, setSavingChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Per-table filter storage
  const [tableFilters, setTableFilters] = useState<
    Record<
      string,
      {
        whereClause: string;
        filterMode: FilterMode;
        filterConditions: FilterCondition[];
        page: number;
        filterPanelOpen: boolean;
        jsonViewerOpen: boolean;
        jsonViewerData: any;
        jsonSearchTerm: string;
      }
    >
  >({});

  // Initialize with SQL filter if provided (for foreign key navigation)
  useEffect(() => {
    if (sqlFilter && tableName) {
      // Remove "WHERE " prefix if present
      const cleanFilter = sqlFilter.replace(/^WHERE\s+/i, '');
      console.log('🔍 DEBUG - Setting sqlFilter for foreign key navigation:', {
        sqlFilter,
        cleanFilter,
        tableName,
      });
      setWhereClause(cleanFilter);
      // Also open the filter panel to show the user that a filter is applied
      setFilterPanelOpen(true);
    }
  }, [sqlFilter, tableName]);

  // Track previous table name to detect real table changes
  const previousTableName = useRef<string | undefined>(undefined);

  // Save and restore filters per tab (not per table)
  useEffect(() => {
    if (!tableName || !tabId) return;

    // Use tabId for unique filter storage
    const filterKey = tabId || tableName;

    console.log('🔍 DEBUG - Managing filters for tab:', filterKey, 'table:', tableName);

    // Restore filters for this tab if they exist
    const savedFilters = tableFilters[filterKey];
    if (savedFilters) {
      console.log('🔍 DEBUG - Restoring saved filters for tab:', filterKey, savedFilters);
      setWhereClause(savedFilters.whereClause);
      setFilterMode(savedFilters.filterMode);
      setFilterConditions(savedFilters.filterConditions);
      setPage(savedFilters.page);
      setFilterPanelOpen(savedFilters.filterPanelOpen);
      setJsonViewerOpen(savedFilters.jsonViewerOpen || false);
      setJsonViewerData(savedFilters.jsonViewerData || null);
      setJsonSearchTerm(savedFilters.jsonSearchTerm || '');
    } else {
      console.log('🔍 DEBUG - No saved filters, using defaults for tab:', filterKey);
      // Don't reset whereClause if we have an sqlFilter from foreign key navigation
      if (!sqlFilter) {
        setWhereClause('');
      }
      setFilterMode('builder');
      setFilterConditions([]);
      setPage(1);
      // Keep filter panel open if we have an sqlFilter from foreign key navigation
      setFilterPanelOpen(!!sqlFilter);
      setJsonViewerOpen(false);
      setJsonViewerData(null);
      setJsonSearchTerm('');
    }
  }, [tableName, tabId, tableFilters, sqlFilter]); // Include tabId and sqlFilter

  // Charger les données quand la table change
  useEffect(() => {
    console.log('🔍 DEBUG useEffect - Dependencies changed:', {
      activeTabId: activeTab?.id,
      tableName,
      page,
      limit,
      viewMode,
      isConnected: activeTab?.isConnected,
    });

    if (activeTab && activeTab.isConnected && tableName) {
      console.log('🔍 DEBUG useEffect - Conditions met, loading data...');
      if (viewMode === 'data') {
        console.log('🔍 DEBUG useEffect - Loading table data');
        loadTableData();
        // Also load structure to get foreign key information
        loadTableStructure();
      } else {
        console.log('🔍 DEBUG useEffect - Loading structure and indexes');
        loadTableStructure();
        loadTableIndexes();
      }
    } else {
      console.log('🔍 DEBUG useEffect - Conditions not met, clearing data');
      setData(null);
      setStructure(null);
      setIndexes(null);
    }
  }, [activeTab?.id, tableName, page, limit, viewMode, sortColumn, sortDirection, whereClause]);

  const loadTableData = async () => {
    if (!activeTab || !tableName) {
      console.log('🔍 DEBUG loadTableData - Missing activeTab or tableName:', {
        activeTab: activeTab?.id,
        tableName,
      });
      return;
    }

    console.log('🔍 DEBUG loadTableData - Starting to load data for:', {
      tableName,
      activeTabId: activeTab.id,
      page,
      limit,
    });

    setLoading(true);
    setError(null);

    try {
      const options = {
        limit,
        offset: (page - 1) * limit,
        orderBy: sortColumn ? `${sortColumn} ${sortDirection.toUpperCase()}` : undefined,
        where: whereClause || undefined,
      };

      console.log('🔍 DEBUG loadTableData - Calling electron with options:', options);

      const tableData = await window.electron.invoke(
        'database:get-table-data',
        activeTab.id,
        tableName,
        options
      );

      console.log('🔍 DEBUG loadTableData - Received data:', tableData);

      // Extract column names from fields if columns not provided
      const columns =
        tableData.columns ||
        (tableData.fields ? tableData.fields.map((field: any) => field.name) : []);

      const newData = {
        columns: columns,
        rows: tableData.rows || [],
        total: tableData.total || tableData.rowCount,
      };

      setData(newData);
      // Sauvegarder les données originales pour le tracking des modifications
      setOriginalData(JSON.parse(JSON.stringify(newData))); // Deep copy
      // Reset modifications when new data is loaded
      setModifiedCells(new Map());
      setSaveError(null);
      setSaveSuccess(false);

      console.log('🔍 DEBUG loadTableData - Final data structure:', {
        columnsCount: columns.length,
        rowsCount: tableData.rows?.length || 0,
        total: tableData.total || tableData.rowCount,
      });

      console.log('🔍 DEBUG loadTableData - Data set successfully');
    } catch (err) {
      console.error('❌ ERROR loading table data:', err);
      setError(`Failed to load data from ${tableName}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTableStructure = async () => {
    if (!activeTab || !tableName) return;
    console.log('🔍 DEBUG loadTableStructure - Starting for table:', tableName);

    try {
      setLoading(true);
      setError(null);

      const columns = await window.electron.invoke('database:get-columns', activeTab.id, tableName);
      console.log('🔍 DEBUG loadTableStructure - Got columns:', columns);

      // Log foreign keys specifically
      const foreignKeys = columns?.filter((col: any) => col.isForeignKey) || [];
      console.log('🔍 DEBUG Foreign keys found:', foreignKeys);

      setStructure(columns);
    } catch (err) {
      console.error('Error loading table structure:', err);
      setError(`Failed to load structure for ${tableName}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTableIndexes = async () => {
    if (!activeTab || !tableName) return;

    try {
      // Mock data for now - à remplacer par un vrai appel backend
      const mockIndexes: IndexInfo[] = [
        {
          name: `idx_${tableName}_number`,
          algorithm: 'BTREE',
          isUnique: false,
          columnName: 'number',
          condition: 'EMPTY',
          include: 'EMPTY',
          comment: 'NULL',
        },
        {
          name: `idx_${tableName}_data`,
          algorithm: 'BTREE',
          isUnique: false,
          columnName: 'data',
          condition: 'EMPTY',
          include: 'EMPTY',
          comment: 'NULL',
        },
        {
          name: `idx_${tableName}_created`,
          algorithm: 'BTREE',
          isUnique: false,
          columnName: 'created_at',
          condition: 'EMPTY',
          include: 'EMPTY',
          comment: 'NULL',
        },
        {
          name: `${tableName}_pkey`,
          algorithm: 'BTREE',
          isUnique: true,
          columnName: 'id',
          condition: 'EMPTY',
          include: 'EMPTY',
          comment: 'NULL',
        },
      ];

      setIndexes(mockIndexes);
    } catch (err) {
      console.error('Error loading table indexes:', err);
      setError(`Failed to load indexes for ${tableName}`);
    }
  };

  const handleRefresh = () => {
    if (viewMode === 'data') {
      loadTableData();
    } else {
      loadTableStructure();
      loadTableIndexes();
    }
  };

  const handleSort = (columnKey: string, direction: 'asc' | 'desc') => {
    console.log('🔍 DEBUG DataViewer handleSort:', columnKey, direction);
    
    // Handle unsorted state (empty string means no sort)
    if (columnKey === '') {
      setSortColumn('');
      setSortDirection('asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection(direction);
    }
    
    setPage(1); // Reset to first page when sorting
  };

  // Helper function to save current table state
  const saveTableState = (
    overrides: Partial<{
      whereClause: string;
      filterMode: FilterMode;
      filterConditions: FilterCondition[];
      page: number;
      filterPanelOpen: boolean;
      jsonViewerOpen: boolean;
      jsonViewerData: any;
      jsonSearchTerm: string;
    }> = {}
  ) => {
    const filterKey = tabId || tableName;
    if (filterKey) {
      setTableFilters(prev => ({
        ...prev,
        [filterKey]: {
          whereClause: overrides.whereClause ?? whereClause,
          filterMode: overrides.filterMode ?? filterMode,
          filterConditions: overrides.filterConditions ?? filterConditions,
          page: overrides.page ?? page,
          filterPanelOpen: overrides.filterPanelOpen ?? filterPanelOpen,
          jsonViewerOpen: overrides.jsonViewerOpen ?? jsonViewerOpen,
          jsonViewerData: overrides.jsonViewerData ?? jsonViewerData,
          jsonSearchTerm: overrides.jsonSearchTerm ?? jsonSearchTerm,
        },
      }));
    }
  };

  const handleApplyFilter = (where: string, mode?: FilterMode, conditions?: FilterCondition[]) => {
    console.log('🔍 DEBUG DataViewer handleApplyFilter:', where, mode, conditions);
    setWhereClause(where);
    setPage(1); // Reset to first page when filtering

    // Save filter state for restoration
    if (mode) setFilterMode(mode);
    if (conditions) setFilterConditions(conditions);

    // Save filters for this table
    saveTableState({
      whereClause: where,
      filterMode: mode || 'builder',
      filterConditions: conditions || [],
      page: 1,
      filterPanelOpen: true, // Panel stays open when applying filters
    });

    // Ne pas fermer le panneau automatiquement
  };

  const handleOpenFilter = () => {
    setFilterPanelOpen(true);
    saveTableState({ filterPanelOpen: true });
  };

  const handleReload = () => {
    if (viewMode === 'data') {
      loadTableData();
    } else {
      loadTableStructure();
      loadTableIndexes();
    }
  };

  const handleCloseFilter = () => {
    setFilterPanelOpen(false);
    saveTableState({ filterPanelOpen: false });
  };

  const handlePreviousPage = () => {
    if (page > 1) {
      const newPage = page - 1;
      setPage(newPage);
      saveTableState({ page: newPage });
    }
  };

  const handleNextPage = () => {
    if (data && data.total && page * limit < data.total) {
      const newPage = page + 1;
      setPage(newPage);
      saveTableState({ page: newPage });
    }
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to first page when changing limit
  };

  const handleFirstPage = () => {
    setPage(1);
    saveTableState({ page: 1 });
  };

  const handleLastPage = () => {
    if (data && data.total) {
      const totalPages = Math.ceil(data.total / limit);
      setPage(totalPages);
      saveTableState({ page: totalPages });
    }
  };

  const handleGoToPage = (targetPage: number) => {
    if (data && data.total) {
      const totalPages = Math.ceil(data.total / limit);
      if (targetPage >= 1 && targetPage <= totalPages) {
        setPage(targetPage);
        saveTableState({ page: targetPage });
      }
    }
  };

  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    // Format dates (both Date objects and date strings)
    if (value instanceof Date) {
      return formatDateObject(value);
    }

    if (typeof value === 'string' && isDateString(value)) {
      return formatDateString(value);
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return String(value);
  };

  // Helper function to format Date objects
  const formatDateObject = (date: Date): string => {
    try {
      // Check if time is midnight (likely date-only)
      if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
        return date.toLocaleDateString();
      }
      
      // Format with date and time
      return date.toLocaleString();
    } catch (e) {
      return String(date); // Fallback to string conversion if formatting fails
    }
  };

  // Helper function to detect if a string is a date
  const isDateString = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    
    // Common date formats: ISO strings, PostgreSQL timestamps
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,        // ISO format like 2025-08-18T00:00:00.000Z
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/,        // PostgreSQL timestamp: 2025-08-18 14:30:15.123456
      /^\d{4}-\d{2}-\d{2}$/,                                       // Date only: 2025-08-18
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?[+-]\d{2}:\d{2}$/, // With timezone
    ];
    
    const isMatch = datePatterns.some(pattern => pattern.test(value));
    const isValidDate = !isNaN(Date.parse(value));
    
    
    return isMatch && isValidDate;
  };

  // Helper function to format date strings nicely
  const formatDateString = (value: string): string => {
    try {
      const date = new Date(value);
      
      // Check if it's just a date (no time part)
      if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return date.toLocaleDateString();
      }
      
      // Check if time is midnight (likely date-only)
      if (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0) {
        return date.toLocaleDateString();
      }
      
      // Format with date and time
      return date.toLocaleString();
    } catch (e) {
      return value; // Fallback to original value if formatting fails
    }
  };

  // Check if a value is JSON/JSONB
  const isJsonValue = (value: any): boolean => {
    if (value === null || value === undefined) return false;

    // Check if it's already an object (JSONB type from PostgreSQL)
    // But exclude Date objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Exclude Date objects
      if (value instanceof Date) return false;

      // Check if it has date-like properties (for objects that might be dates)
      if (value.toISOString || value.toDateString) return false;

      return true;
    }

    // Check if it's a JSON string
    if (typeof value === 'string') {
      // First check if it looks like a date string (ISO 8601 format)
      const datePattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      if (datePattern.test(value)) return false;

      // Also check for other common date formats
      if (!isNaN(Date.parse(value)) && value.includes('-') && value.length < 30) {
        return false;
      }

      // Try to parse as JSON
      try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object';
      } catch {
        return false;
      }
    }

    return false;
  };

  // Handle JSON viewer click
  const handleJsonView = (value: any) => {
    let jsonData = value;

    // Parse if it's a string
    if (typeof value === 'string') {
      try {
        jsonData = JSON.parse(value);
      } catch {
        jsonData = value;
      }
    }

    setJsonViewerData(jsonData);
    setJsonViewerOpen(true);

    // Save JSON viewer state for this table
    saveTableState({
      jsonViewerOpen: true,
      jsonViewerData: jsonData,
      jsonSearchTerm: '',
    });
  };

  // Handle JSON viewer close
  const handleJsonViewClose = () => {
    setJsonViewerOpen(false);
    setJsonViewerData(null);
    setJsonSearchTerm('');

    // Save JSON viewer state for this table
    saveTableState({
      jsonViewerOpen: false,
      jsonViewerData: null,
      jsonSearchTerm: '',
    });
  };

  // Handle JSON copy
  const handleJsonCopy = () => {
    if (jsonViewerData) {
      navigator.clipboard.writeText(JSON.stringify(jsonViewerData, null, 2));
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    }
  };

  // Filter JSON data based on search term
  const filteredJsonData = useMemo(() => {
    if (!jsonSearchTerm.trim() || !jsonViewerData) return jsonViewerData;

    const searchLower = jsonSearchTerm.toLowerCase();

    const containsSearchTerm = (obj: any, searchKey: string): boolean => {
      if (obj === null || obj === undefined) return false;

      if (typeof obj === 'string' || typeof obj === 'number') {
        return String(obj).toLowerCase().includes(searchKey);
      }

      if (Array.isArray(obj)) {
        return obj.some(item => containsSearchTerm(item, searchKey));
      }

      if (typeof obj === 'object') {
        return Object.entries(obj).some(
          ([key, value]) =>
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

    const result = filterObject(jsonViewerData, searchLower);
    return result !== undefined ? result : {};
  }, [jsonViewerData, jsonSearchTerm]);

  // Handle cell double-click for editing
  const handleCellDoubleClick = (rowIndex: number, field: keyof ColumnStructure) => {
    if (!structure) return;

    const column = structure[rowIndex];
    let value = '';

    switch (field) {
      case 'name':
        value = column.name;
        break;
      case 'type':
        value = column.type;
        break;
      case 'nullable':
        value = column.nullable ? 'YES' : 'NO';
        break;
      case 'defaultValue':
        value = column.defaultValue || '';
        break;
      case 'comment':
        value = column.comment || '';
        break;
      default:
        return; // Don't allow editing other fields
    }

    setEditingCell({ rowIndex, field, value });
  };

  // Save cell edit
  const saveCellEdit = () => {
    if (!editingCell || !structure) return;

    const newStructure = [...structure];
    const column = newStructure[editingCell.rowIndex];

    switch (editingCell.field) {
      case 'name':
        column.name = editingCell.value;
        break;
      case 'type':
        column.type = editingCell.value;
        break;
      case 'nullable':
        column.nullable = editingCell.value.toUpperCase() === 'YES';
        break;
      case 'defaultValue':
        column.defaultValue = editingCell.value || null;
        break;
      case 'comment':
        column.comment = editingCell.value;
        break;
    }

    setStructure(newStructure);
    setEditingCell(null);

    // TODO: Send update to backend to modify table structure
    console.log('Structure updated:', column);
  };

  // Cancel cell edit
  const cancelCellEdit = () => {
    setEditingCell(null);
  };

  // Handle data cell double-click for editing
  const handleDataCellDoubleClick = (rowIndex: number, columnKey: string) => {
    if (!data) return;

    const row = data.rows[rowIndex];
    const currentValue = row[columnKey];

    setEditingDataCell({
      rowIndex,
      columnKey,
      value: formatCellValue(currentValue),
    });
  };

  // Handle data cell edit
  const handleDataCellEdit = async (rowIndex: number, columnKey: string, value: string) => {
    if (!data || !activeTab || !tableName || !structure || !originalData) return;

    try {
      // Convert the value to appropriate type
      let convertedValue: any = value;

      // Handle NULL values
      if (value.trim().toLowerCase() === 'null' || value.trim() === '') {
        convertedValue = null;
      } else if (!isNaN(Number(value))) {
        // Try to convert to number if it looks like a number
        convertedValue = Number(value);
      }

      // Get original value for comparison
      const originalValue = originalData.rows[rowIndex][columnKey];

      // Update local data immediately for responsive UI
      const newData = { ...data };
      newData.rows[rowIndex][columnKey] = convertedValue;
      setData(newData);

      // Get primary key values for this row to identify it in UPDATE query
      const primaryKeyColumns = structure.filter(col => col.isPrimaryKey);
      const rowPrimaryKey: { [columnName: string]: any } = {};

      primaryKeyColumns.forEach(pkCol => {
        rowPrimaryKey[pkCol.name] = originalData.rows[rowIndex][pkCol.name];
      });

      // Create unique key for tracking this modification
      const modificationKey = `${rowIndex}_${columnKey}`;

      // Check if the value has actually changed from original
      if (convertedValue === originalValue) {
        // Value reverted to original - remove from modifications
        setModifiedCells(prev => {
          const newModifications = new Map(prev);
          newModifications.delete(modificationKey);
          return newModifications;
        });
      } else {
        // Value changed - add/update modification
        setModifiedCells(prev => {
          const newModifications = new Map(prev);
          newModifications.set(modificationKey, {
            rowIndex,
            columnKey,
            originalValue,
            newValue: convertedValue,
            rowPrimaryKey,
          });
          return newModifications;
        });
      }

      console.log('Cell modification tracked:', {
        tableName,
        rowIndex,
        columnKey,
        originalValue,
        newValue: convertedValue,
        rowPrimaryKey,
      });
    } catch (err) {
      console.error('Error tracking cell modification:', err);
      setError('Failed to track cell modification');
    }
  };

  // Cancel data cell edit
  const cancelDataCellEdit = () => {
    setEditingDataCell(null);
  };

  // Save all modifications to database
  const saveChanges = async () => {
    if (!activeTab || !tableName || modifiedCells.size === 0) return;

    setSavingChanges(true);
    setSaveError(null);

    try {
      // Build updates array for the IPC call
      const updates = Array.from(modifiedCells.values()).map(modification => ({
        whereClause: modification.rowPrimaryKey,
        setClause: {
          [modification.columnKey]: modification.newValue,
        },
      }));

      console.log('Saving changes:', {
        tableName,
        modifications: updates.length,
        updates,
      });

      // Call the IPC method to update database
      const result = await window.electron.invoke(
        'database:update-table-data',
        activeTab.id,
        tableName,
        updates
      );

      if (result.success) {
        console.log(`Successfully updated ${result.updatedRows} rows`);

        // Update original data to match current data (modifications are now saved)
        setOriginalData(JSON.parse(JSON.stringify(data)));
        // Clear modifications
        setModifiedCells(new Map());
        // Show success feedback
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        console.error('Save failed:', result.error);
        setSaveError(result.error || 'Failed to save changes');
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setSavingChanges(false);
    }
  };

  // Cancel all modifications
  const cancelChanges = () => {
    if (!originalData) return;

    // Revert data to original state
    setData(JSON.parse(JSON.stringify(originalData)));
    // Clear all modifications
    setModifiedCells(new Map());
    // Clear editing state
    setEditingDataCell(null);
    setSaveError(null);
    setSaveSuccess(false);

    console.log('All modifications cancelled');
  };

  // Check if a cell is modified
  const isCellModified = (rowIndex: number, columnKey: string): boolean => {
    return modifiedCells.has(`${rowIndex}_${columnKey}`);
  };

  if (!activeTab) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>No active connection</p>
      </div>
    );
  }

  if (!activeTab.isConnected) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Connection not active</p>
      </div>
    );
  }

  console.log('DataViewer - tableName:', tableName, 'activeTab:', activeTab);

  if (!tableName) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <p className="mb-2">Select a table to view its data</p>
          <p className="text-sm">Click on a table in the database explorer</p>
        </div>
      </div>
    );
  }

  console.log('DataViewer - Rendering with switch, viewMode:', viewMode);

  return (
    <div className="h-full flex flex-col">
      {/* Save/Cancel buttons - Only visible when there are modifications */}
      {modifiedCells.size > 0 && (
        <div className="fixed bottom-28 right-4" style={{ zIndex: 10000 }}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {modifiedCells.size} change{modifiedCells.size > 1 ? 's' : ''}
            </span>
            <Button onClick={saveChanges} disabled={savingChanges} size="sm">
              {savingChanges ? 'Saving...' : 'Save'}
            </Button>
            <Button onClick={cancelChanges} disabled={savingChanges} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Success/Error notifications */}
      {saveSuccess && (
        <div
          className="fixed bottom-40 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-lg shadow-lg"
          style={{ zIndex: 10000 }}
        >
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            Changes saved successfully!
          </div>
        </div>
      )}

      {saveError && (
        <div
          className="fixed bottom-40 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg shadow-lg max-w-sm"
          style={{ zIndex: 10000 }}
        >
          <div className="flex items-center gap-2">
            <XIcon className="h-4 w-4" />
            <div>
              <div className="font-medium">Save failed</div>
              <div className="text-sm">{saveError}</div>
            </div>
          </div>
        </div>
      )}

      {/* Switch Data/Structure - Always visible when table is selected */}
      <div className="fixed bottom-16 right-4 flex items-center gap-2" style={{ zIndex: 9999 }}>
        {/* Filter button - Only in data view */}
        {viewMode === 'data' && (
          <button
            className={`p-2 bg-white border border-gray-200 rounded-lg shadow-lg hover:bg-gray-50 transition-colors ${
              whereClause ? 'text-blue-600' : 'text-gray-600'
            }`}
            onClick={handleOpenFilter}
            title="Advanced Filter"
          >
            <Filter className="h-4 w-4" />
          </button>
        )}

        {/* Reload button */}
        <button
          className="p-2 bg-white border border-gray-200 rounded-lg shadow-lg hover:bg-gray-50 transition-colors text-gray-600 hover:text-blue-600"
          onClick={handleReload}
          title={`Reload ${viewMode === 'data' ? 'data' : 'structure'}`}
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Data/Structure Switch */}
        <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-lg">
          <button
            className={`px-2 py-1 rounded-l text-xs font-medium transition-colors ${
              viewMode === 'data'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => setViewMode('data')}
            title="Data view"
          >
            Data
          </button>
          <button
            className={`px-2 py-1 rounded-r text-xs font-medium transition-colors ${
              viewMode === 'structure'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            onClick={() => setViewMode('structure')}
            title="Structure view"
          >
            Structure
          </button>
        </div>
      </div>

      {/* Main Content Area - Flex Row for Side-by-Side Layout */}
      <div className="flex-1 flex flex-row min-h-0">
        {/* Left Panel - Table Content (resizes when JSON viewer is open) */}
        <div className={`flex flex-col min-h-0 ${jsonViewerOpen ? 'w-1/2' : 'w-full'}`}>
          {/* Error */}
          {error && <div className="p-4 bg-red-50 text-red-700 text-sm">{error}</div>}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading data...
              </div>
            </div>
          )}

          {/* Data Table */}
          {viewMode === 'data' && data && !loading && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Filter Panel */}
              {data && (
                <FilterPanel
                  columns={data.columns}
                  isOpen={filterPanelOpen}
                  onClose={handleCloseFilter}
                  onApplyFilter={handleApplyFilter}
                  initialWhere={whereClause}
                  initialMode={filterMode}
                  initialConditions={filterConditions}
                />
              )}

              <ResizableTable
                columns={data.columns.map(column => {
                  const columnDef = {
                    key: column,
                    title: column,
                    render: (value: any, row: any, rowIndex: number) => {
                    
                    const isJson = isJsonValue(value);

                    // Check if this column has foreign key relations
                    const columnInfo = structure?.find(col => col.name === column);
                    const hasForeignKey = columnInfo?.isForeignKey && onForeignKeyClick && value;
                    const hasReverseForeignKey =
                      columnInfo?.isReferencedByOtherTables && onForeignKeyClick && value;

                    const isModified = isCellModified(rowIndex, column);

                    return (
                      <div
                        className={`flex items-center gap-1 ${isModified ? 'bg-yellow-100 border-l-2 border-l-orange-400' : ''}`}
                      >
                        <div className="truncate flex-1" title={formatCellValue(value)}>
                          {value === null || value === undefined ? (
                            <span className="text-gray-400 italic">NULL</span>
                          ) : (
                            <span
                              className={`${isModified ? 'text-orange-800 font-medium' : 'text-gray-900'}`}
                            >
                              {formatCellValue(value)}
                            </span>
                          )}
                        </div>

                        {/* Foreign Key Navigation Button */}
                        {hasForeignKey && columnInfo && (
                          <Tooltip
                            content={`${columnInfo.foreignKeyTable} where ${columnInfo.foreignKeyColumn} = ${value}`}
                            delay={200}
                          >
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                onForeignKeyClick!(
                                  columnInfo.foreignKeyTable!,
                                  columnInfo.foreignKeyColumn!,
                                  value
                                );
                              }}
                              className="ml-1 text-blue-500 hover:text-blue-700 transition-colors flex-shrink-0"
                            >
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                />
                              </svg>
                            </button>
                          </Tooltip>
                        )}

                        {/* Reverse Foreign Key Navigation Buttons */}
                        {hasReverseForeignKey &&
                          columnInfo?.referencedByTables?.map((refTable, index) => (
                            <Tooltip
                              key={`${refTable.table}-${refTable.column}-${index}`}
                              content={`${refTable.table} where ${refTable.column} = ${value}`}
                              delay={200}
                            >
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onForeignKeyClick!(refTable.table, refTable.column, value);
                                }}
                                className="ml-1 text-green-600 hover:text-green-800 transition-colors flex-shrink-0"
                              >
                                <svg
                                  className="h-3 w-3 transform rotate-180"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                  />
                                </svg>
                              </button>
                            </Tooltip>
                          ))}

                        {/* JSON View Button */}
                        {isJson && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleJsonView(value);
                            }}
                            className="p-1 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                            title="View JSON"
                          >
                            <Eye className="h-3 w-3 text-blue-600" />
                          </button>
                        )}
                      </div>
                      );
                    },
                  };
                  
                  return columnDef;
                })}
                data={data.rows}
                onCellEdit={handleDataCellEdit}
                onCellDoubleClick={handleDataCellDoubleClick}
                editingCell={editingDataCell}
                onEditingChange={setEditingDataCell}
                onSort={handleSort}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                maxHeight="calc(100vh - 180px)"
                foreignKeys={
                  structure
                    ?.filter(col => col.isForeignKey)
                    .map(col => ({
                      columnName: col.name,
                      targetTable: col.foreignKeyTable || '',
                      targetColumn: col.foreignKeyColumn || '',
                    })) || []
                }
                onForeignKeyClick={onForeignKeyClick}
              />

              {/* TablePlus-style Pagination Controls - Always visible at bottom */}
              {data.total !== undefined && (
                <div className="flex-shrink-0 border-t p-3 flex items-center justify-between bg-gray-50 text-xs">
                  {/* Left side - Row info and limit selector */}
                  <div className="flex items-center gap-4">
                    <div className="text-gray-600">
                      Showing {Math.min((page - 1) * limit + 1, data.total)} to{' '}
                      {Math.min(page * limit, data.total)} of {data.total} rows
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Limit:</span>
                      <select
                        value={limit}
                        onChange={e => handleLimitChange(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000</option>
                      </select>
                    </div>
                  </div>

                  {/* Right side - Navigation controls */}
                  <div className="flex items-center gap-1">
                    {/* First page */}
                    <button
                      onClick={handleFirstPage}
                      disabled={page <= 1}
                      className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title="First page"
                    >
                      <ChevronsLeft className="h-3 w-3" />
                    </button>

                    {/* Previous page */}
                    <button
                      onClick={handlePreviousPage}
                      disabled={page <= 1}
                      className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Previous page"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>

                    {/* Page input */}
                    <div className="flex items-center gap-1 mx-2">
                      <span className="text-gray-600">Page</span>
                      <input
                        type="number"
                        value={page}
                        onChange={e => {
                          const newPage = parseInt(e.target.value);
                          if (!isNaN(newPage)) {
                            handleGoToPage(newPage);
                          }
                        }}
                        className="w-12 border border-gray-300 rounded px-1 py-1 text-xs text-center bg-white focus:outline-none focus:border-blue-500"
                        min="1"
                        max={data.total ? Math.ceil(data.total / limit) : 1}
                      />
                      <span className="text-gray-600">
                        of {data.total ? Math.ceil(data.total / limit) : 1}
                      </span>
                    </div>

                    {/* Next page */}
                    <button
                      onClick={handleNextPage}
                      disabled={!data.total || page * limit >= data.total}
                      className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Next page"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>

                    {/* Last page */}
                    <button
                      onClick={handleLastPage}
                      disabled={!data.total || page * limit >= data.total}
                      className="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Last page"
                    >
                      <ChevronsRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {viewMode === 'data' && data && !loading && data.rows.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <p>No data found in {tableName}</p>
            </div>
          )}

          {/* Structure Table - Excel/TablePlus style */}
          {viewMode === 'structure' && structure && !loading && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Columns Table */}
              <ResizableTable
                columns={[
                  {
                    key: 'name',
                    title: 'Column',
                    width: 200,
                    minWidth: 100,
                    render: (value: any, row: ColumnStructure) => (
                      <span
                        className={`${row.isPrimaryKey ? 'font-semibold text-blue-700' : 'text-gray-900'} truncate block`}
                        title={value}
                      >
                        {value}
                      </span>
                    ),
                  },
                  {
                    key: 'type',
                    title: 'Type',
                    width: 150,
                    minWidth: 80,
                    render: (value: any) => (
                      <span
                        className="text-gray-700 font-mono text-xs truncate block"
                        title={value}
                      >
                        {value}
                      </span>
                    ),
                  },
                  {
                    key: 'nullable',
                    title: 'Null',
                    width: 80,
                    minWidth: 60,
                    render: (value: any) => (
                      <div className="text-center">
                        <span className={`text-xs ${value ? 'text-green-600' : 'text-red-600'}`}>
                          {value ? 'YES' : 'NO'}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: 'defaultValue',
                    title: 'Default',
                    width: 150,
                    minWidth: 80,
                    render: (value: any) => (
                      <span
                        className="text-gray-700 font-mono text-xs truncate block"
                        title={value || 'NULL'}
                      >
                        {value ? value : <span className="text-gray-400 italic">NULL</span>}
                      </span>
                    ),
                  },
                  {
                    key: 'keys',
                    title: 'Key',
                    width: 80,
                    minWidth: 60,
                    render: (_value: any, row: ColumnStructure) => (
                      <div className="flex justify-center gap-0.5">
                        {row.isPrimaryKey && (
                          <span className="text-blue-600 font-semibold">PK</span>
                        )}
                        {row.isForeignKey && <span className="text-purple-600">FK</span>}
                        {row.isUnique && !row.isPrimaryKey && (
                          <span className="text-orange-600">UQ</span>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'extra',
                    title: 'Extra',
                    width: 120,
                    minWidth: 80,
                    render: (_value: any, row: ColumnStructure) => (
                      <span className="text-gray-700 truncate block">
                        {row.isAutoIncrement ? (
                          <span className="text-xs">auto_increment</span>
                        ) : (
                          <span className="text-gray-400 italic">NULL</span>
                        )}
                      </span>
                    ),
                  },
                ]}
                data={structure.map(col => ({
                  ...col,
                  keys: '', // Placeholder for key column
                  extra: '', // Placeholder for extra column
                }))}
                onCellEdit={(rowIndex, columnKey, value) => {
                  // Handle structure cell edit
                  if (!structure) return;
                  const updatedStructure = [...structure];
                  const column = updatedStructure[rowIndex];

                  switch (columnKey) {
                    case 'name':
                      column.name = value;
                      break;
                    case 'type':
                      column.type = value;
                      break;
                    case 'nullable':
                      column.nullable = value.toUpperCase() === 'YES';
                      break;
                    case 'defaultValue':
                      column.defaultValue = value || null;
                      break;
                  }

                  setStructure(updatedStructure);
                  console.log('Structure updated:', column);
                }}
                onCellDoubleClick={(rowIndex, columnKey) => {
                  // Only allow editing certain columns
                  if (['name', 'type', 'nullable', 'defaultValue'].includes(columnKey)) {
                    handleCellDoubleClick(rowIndex, columnKey as keyof ColumnStructure);
                  }
                }}
                editingCell={
                  editingCell
                    ? {
                        rowIndex: editingCell.rowIndex,
                        columnKey: editingCell.field,
                        value: editingCell.value,
                      }
                    : null
                }
                onEditingChange={editing => {
                  if (editing) {
                    setEditingCell({
                      rowIndex: editing.rowIndex,
                      field: editing.columnKey as keyof ColumnStructure,
                      value: editing.value,
                    });
                  } else {
                    setEditingCell(null);
                  }
                }}
                maxHeight="calc(50vh - 90px)"
              />

              {/* Index Table - Section séparée */}
              {indexes && indexes.length > 0 && (
                <div className="mt-6 flex-1">
                  <ResizableTable
                    columns={[
                      {
                        key: 'name',
                        title: 'index_name',
                        width: 160,
                        minWidth: 100,
                        render: (value: any) => (
                          <span className="truncate block" title={value}>
                            {value}
                          </span>
                        ),
                      },
                      {
                        key: 'algorithm',
                        title: 'index_algorithm',
                        width: 120,
                        minWidth: 80,
                        render: (value: any) => (
                          <span
                            className="text-gray-700 font-mono text-xs truncate block"
                            title={value}
                          >
                            {value}
                          </span>
                        ),
                      },
                      {
                        key: 'isUnique',
                        title: 'is_unique',
                        width: 80,
                        minWidth: 60,
                        render: (value: any) => (
                          <div className="text-center">
                            <span
                              className={`text-xs ${value ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}
                            >
                              {value ? 'TRUE' : 'FALSE'}
                            </span>
                          </div>
                        ),
                      },
                      {
                        key: 'columnName',
                        title: 'column_name',
                        width: 150,
                        minWidth: 100,
                        render: (value: any) => (
                          <span className="text-gray-700 truncate block" title={value}>
                            {value}
                          </span>
                        ),
                      },
                      {
                        key: 'condition',
                        title: 'condition',
                        width: 150,
                        minWidth: 100,
                        render: (value: any) => (
                          <span className="text-gray-700 truncate block" title={value || 'NULL'}>
                            {value && value !== 'EMPTY' ? (
                              value
                            ) : (
                              <span className="text-gray-400 italic">NULL</span>
                            )}
                          </span>
                        ),
                      },
                      {
                        key: 'include',
                        title: 'include',
                        width: 150,
                        minWidth: 100,
                        render: (value: any) => (
                          <span className="text-gray-700 truncate block" title={value || 'NULL'}>
                            {value && value !== 'EMPTY' ? (
                              value
                            ) : (
                              <span className="text-gray-400 italic">NULL</span>
                            )}
                          </span>
                        ),
                      },
                      {
                        key: 'comment',
                        title: 'comment',
                        width: 150,
                        minWidth: 100,
                        render: (value: any) => (
                          <span className="text-gray-700 truncate block" title={value || 'NULL'}>
                            {value && value !== 'NULL' ? (
                              value
                            ) : (
                              <span className="text-gray-400 italic">NULL</span>
                            )}
                          </span>
                        ),
                      },
                    ]}
                    data={indexes}
                    maxHeight="calc(40vh - 90px)"
                  />
                </div>
              )}
            </div>
          )}

          {/* Structure Empty State */}
          {viewMode === 'structure' && structure && !loading && structure.length === 0 && (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <p>No structure found for {tableName}</p>
            </div>
          )}
        </div>

        {/* JSON Viewer - Right Panel in Side-by-Side Layout */}
        {jsonViewerOpen && jsonViewerData && (
          <div className="w-1/2 h-full bg-white border-l shadow-lg flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">JSON Viewer</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleJsonCopy}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Copy JSON"
                >
                  {jsonCopied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-600" />
                  )}
                </button>
                <button
                  onClick={handleJsonViewClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <XIcon className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search keys or values..."
                  value={jsonSearchTerm}
                  onChange={e => {
                    const newSearchTerm = e.target.value;
                    setJsonSearchTerm(newSearchTerm);
                    // Save search term for this table
                    saveTableState({
                      jsonSearchTerm: newSearchTerm,
                    });
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                {jsonSearchTerm && (
                  <button
                    onClick={() => {
                      setJsonSearchTerm('');
                      saveTableState({
                        jsonSearchTerm: '',
                      });
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Clear search"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <JsonView
                  value={filteredJsonData}
                  collapsed={jsonSearchTerm ? false : 1}
                  displayDataTypes={false}
                  displayObjectSize={true}
                  enableClipboard={true}
                  style={{
                    fontSize: '13px',
                    fontFamily:
                      'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
