import React, { useState, useEffect, useRef } from 'react';

interface Column {
  key: string;
  title: string;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  render?: (value: any, row: any, rowIndex: number) => React.ReactNode;
}

interface ResizableTableProps {
  columns: Column[];
  data: any[];
  onCellEdit?: (rowIndex: number, columnKey: string, value: any) => void;
  onCellDoubleClick?: (rowIndex: number, columnKey: string) => void;
  editingCell?: { rowIndex: number; columnKey: string; value: string } | null;
  onEditingChange?: (
    editing: { rowIndex: number; columnKey: string; value: string } | null
  ) => void;
  onSort?: (columnKey: string, direction: 'asc' | 'desc') => void;
  className?: string;
  maxHeight?: string;
}

export const ResizableTable: React.FC<ResizableTableProps> = ({
  columns,
  data,
  onCellEdit,
  onCellDoubleClick,
  editingCell,
  onEditingChange,
  onSort,
  className = '',
  maxHeight = 'calc(100vh - 180px)',
}) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    columnKey: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    columnKey: '',
  });
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Initialize column widths
  useEffect(() => {
    if (columns.length > 0 && Object.keys(columnWidths).length === 0) {
      const initialWidths: Record<string, number> = {};
      columns.forEach(column => {
        initialWidths[column.key] = column.width || 150;
      });
      setColumnWidths(initialWidths);
    }
  }, [columns, columnWidths]);

  // Handle click outside context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu({ show: false, x: 0, y: 0, columnKey: '' });
      }
    };

    if (contextMenu.show) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.show]);

  // Calculate total width for consistent table size
  const totalWidth =
    Object.keys(columnWidths).length > 0
      ? Math.max(
          Object.values(columnWidths).reduce((sum, width) => sum + width, 0),
          800
        )
      : columns.length * 150;

  // Handle column resize start
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[columnKey] || 150;
    const minWidth = columns.find(col => col.key === columnKey)?.minWidth || 80;

    // Define move handler with closure
    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(minWidth, startWidth + deltaX);

      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth,
      }));
    };

    // Define end handler with closure
    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    // Set cursor and disable text selection during resize
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
  };

  // Handle header right click for sort menu
  const handleHeaderRightClick = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    if (!onSort) return; // Only show when sort callback exists

    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      columnKey,
    });
  };

  // Handle sort action
  const handleSort = (direction: 'asc' | 'desc') => {
    if (onSort) {
      onSort(contextMenu.columnKey, direction);
    }
    setContextMenu({ show: false, x: 0, y: 0, columnKey: '' });
  };

  // Handle cell double click
  const handleCellDoubleClick = (rowIndex: number, columnKey: string) => {
    if (onCellDoubleClick) {
      onCellDoubleClick(rowIndex, columnKey);
    }
  };

  // Handle edit value change
  const handleEditChange = (newValue: string) => {
    if (editingCell && onEditingChange) {
      onEditingChange({ ...editingCell, value: newValue });
    }
  };

  // Handle edit key events
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && editingCell && onCellEdit) {
      onCellEdit(editingCell.rowIndex, editingCell.columnKey, editingCell.value);
      if (onEditingChange) onEditingChange(null);
    } else if (e.key === 'Escape') {
      if (onEditingChange) onEditingChange(null);
    }
  };

  // Handle edit blur
  const handleEditBlur = () => {
    if (editingCell && onCellEdit) {
      onCellEdit(editingCell.rowIndex, editingCell.columnKey, editingCell.value);
    }
    if (onEditingChange) onEditingChange(null);
  };

  // Get cell value
  const getCellValue = (row: any, column: Column) => {
    return row[column.key];
  };

  // Render cell content
  const renderCell = (row: any, column: Column, rowIndex: number) => {
    const value = getCellValue(row, column);

    if (column.render) {
      return column.render(value, row, rowIndex);
    }

    // Default rendering
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">NULL</span>;
    }

    return (
      <div className="truncate" title={String(value)}>
        {String(value)}
      </div>
    );
  };

  return (
    <div className={`flex-1 overflow-auto ${className}`}>
      <table
        className="border-collapse border border-gray-300 text-xs"
        style={{
          width: totalWidth,
          tableLayout: 'fixed',
        }}
      >
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className="border border-gray-300 px-2 py-1 text-left font-normal text-gray-800 relative"
                style={{ width: columnWidths[column.key] || column.width || 150 }}
                onContextMenu={e => handleHeaderRightClick(e, column.key)}
              >
                <div className="truncate pr-2">{column.title}</div>
                {/* Resize handle */}
                <div
                  className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-300 transition-colors"
                  onMouseDown={e => handleResizeStart(e, column.key)}
                  onContextMenu={e => e.stopPropagation()}
                  title="Drag to resize column"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {columns.map(column => (
                <td
                  key={column.key}
                  className="border border-gray-300 px-2 py-1 cursor-pointer hover:bg-blue-50 overflow-hidden font-mono"
                  style={{
                    width: columnWidths[column.key] || column.width || 150,
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  }}
                  onDoubleClick={() => handleCellDoubleClick(rowIndex, column.key)}
                >
                  {editingCell?.rowIndex === rowIndex && editingCell?.columnKey === column.key ? (
                    <input
                      type="text"
                      value={editingCell.value}
                      onChange={e => handleEditChange(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleEditBlur}
                      className="w-full bg-white border-0 outline-none text-xs font-mono"
                      style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
                      autoFocus
                    />
                  ) : (
                    renderCell(row, column, rowIndex)
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu.show && onSort && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg py-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={() => handleSort('asc')}
          >
            Sort Ascending
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 transition-colors"
            onClick={() => handleSort('desc')}
          >
            Sort Descending
          </button>
        </div>
      )}
    </div>
  );
};
