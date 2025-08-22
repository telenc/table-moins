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
import { JsonModal } from '../ui/JsonModal';
import { ResizableTable } from '../ui/ResizableTable';
import { FilterPanel, FilterCondition, FilterMode } from '../ui/FilterPanel';

interface DataViewerProps {
  activeTab: TabConnection | null;
  tableName?: string;
  onBack?: () => void;
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

export const DataViewer: React.FC<DataViewerProps> = ({ activeTab, tableName, onBack }) => {
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
  const [jsonModalData, setJsonModalData] = useState<any>(null);
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [whereClause, setWhereClause] = useState<string>('');
  const [filterMode, setFilterMode] = useState<FilterMode>('builder');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);

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
      }
    >
  >({});

  // Track previous table name to detect real table changes
  const previousTableName = useRef<string | undefined>(undefined);

  // Save and restore filters per table
  useEffect(() => {
    if (!tableName) return;

    // Check if the table actually changed
    const hasTableChanged = previousTableName.current !== tableName;
    previousTableName.current = tableName;

    if (!hasTableChanged) {
      // Same table, don't reset anything
      console.log('🔍 DEBUG - Same table, no filter restoration needed:', tableName);
      return;
    }

    console.log('🔍 DEBUG - Table changed, managing filters for:', tableName);

    // Restore filters for this table if they exist
    const savedFilters = tableFilters[tableName];
    if (savedFilters) {
      console.log('🔍 DEBUG - Restoring saved filters for table:', tableName, savedFilters);
      setWhereClause(savedFilters.whereClause);
      setFilterMode(savedFilters.filterMode);
      setFilterConditions(savedFilters.filterConditions);
      setPage(savedFilters.page);
      setFilterPanelOpen(savedFilters.filterPanelOpen);
    } else {
      console.log('🔍 DEBUG - No saved filters, using defaults for table:', tableName);
      setWhereClause('');
      setFilterMode('builder');
      setFilterConditions([]);
      setPage(1);
      setFilterPanelOpen(false);
    }
  }, [tableName, tableFilters]); // Include tableFilters to handle first-time restoration

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

      setData({
        columns: columns,
        rows: tableData.rows || [],
        total: tableData.total || tableData.rowCount,
      });

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

    try {
      setLoading(true);
      setError(null);

      const columns = await window.electron.invoke('database:get-columns', activeTab.id, tableName);

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
    setSortColumn(columnKey);
    setSortDirection(direction);
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
    }> = {}
  ) => {
    if (tableName) {
      setTableFilters(prev => ({
        ...prev,
        [tableName]: {
          whereClause: overrides.whereClause ?? whereClause,
          filterMode: overrides.filterMode ?? filterMode,
          filterConditions: overrides.filterConditions ?? filterConditions,
          page: overrides.page ?? page,
          filterPanelOpen: overrides.filterPanelOpen ?? filterPanelOpen,
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

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    return String(value);
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

    setJsonModalData(jsonData);
    setJsonModalOpen(true);
  };

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
    if (!data || !activeTab || !tableName) return;

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

      // Update local data immediately for responsive UI
      const newData = { ...data };
      newData.rows[rowIndex][columnKey] = convertedValue;
      setData(newData);

      // TODO: Send update to backend to modify actual table data
      console.log('Data cell updated:', {
        tableName,
        rowIndex,
        columnKey,
        oldValue: data.rows[rowIndex][columnKey],
        newValue: convertedValue,
      });

      // Here we would need to implement UPDATE SQL query
      // For now, just log the update
    } catch (err) {
      console.error('Error updating data cell:', err);
      setError('Failed to update cell value');
    }
  };

  // Cancel data cell edit
  const cancelDataCellEdit = () => {
    setEditingDataCell(null);
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
            columns={data.columns.map(column => ({
              key: column,
              title: column,
              render: (value: any) => {
                const isJson = isJsonValue(value);
                return (
                  <div className="flex items-center gap-1">
                    <div className="truncate flex-1" title={formatCellValue(value)}>
                      {value === null || value === undefined ? (
                        <span className="text-gray-400 italic">NULL</span>
                      ) : (
                        <span className="text-gray-900">{formatCellValue(value)}</span>
                      )}
                    </div>
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
            }))}
            data={data.rows}
            onCellEdit={handleDataCellEdit}
            onCellDoubleClick={handleDataCellDoubleClick}
            editingCell={editingDataCell}
            onEditingChange={setEditingDataCell}
            onSort={handleSort}
            maxHeight="calc(100vh - 180px)"
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
                  <span className="text-gray-700 font-mono text-xs truncate block" title={value}>
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
                    {row.isPrimaryKey && <span className="text-blue-600 font-semibold">PK</span>}
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

      {/* JSON Modal */}
      <JsonModal
        isOpen={jsonModalOpen}
        onClose={() => setJsonModalOpen(false)}
        data={jsonModalData}
        title="JSON Data Viewer"
      />
    </div>
  );
};
