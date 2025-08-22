import React, { useState, useEffect } from 'react';
import { Plus, Minus, Search, Code2, Filter } from 'lucide-react';

export type FilterMode = 'builder' | 'raw';

type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL';

export interface FilterCondition {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string;
  enabled: boolean;
}

interface FilterPanelProps {
  columns: string[];
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (where: string, mode?: FilterMode, conditions?: FilterCondition[]) => void;
  initialWhere?: string;
  initialMode?: FilterMode;
  initialConditions?: FilterCondition[];
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  columns,
  isOpen,
  onClose,
  onApplyFilter,
  initialWhere,
  initialMode,
  initialConditions
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('builder');
  const [rawSQL, setRawSQL] = useState('');
  const [conditions, setConditions] = useState<FilterCondition[]>([
    {
      id: '1',
      column: columns[0] || '',
      operator: '=',
      value: '',
      enabled: true
    }
  ]);
  const [initialized, setInitialized] = useState(false);

  // Initialize filter state from props
  useEffect(() => {
    if ((initialWhere || initialMode || initialConditions) && !initialized) {
      // Restore the mode if provided, otherwise default to builder
      if (initialMode) {
        setFilterMode(initialMode);
      }
      
      // Restore conditions if provided
      if (initialConditions && initialConditions.length > 0) {
        setConditions(initialConditions);
      }
      
      // Restore raw SQL if provided and mode is raw
      if (initialWhere && initialWhere.trim() && initialMode === 'raw') {
        setRawSQL(initialWhere);
      }
      
      setInitialized(true);
    }
  }, [initialWhere, initialMode, initialConditions, initialized]);

  const operators: { value: FilterOperator; label: string }[] = [
    { value: '=', label: 'Equals' },
    { value: '!=', label: 'Not equals' },
    { value: '>', label: 'Greater than' },
    { value: '<', label: 'Less than' },
    { value: '>=', label: 'Greater or equal' },
    { value: '<=', label: 'Less or equal' },
    { value: 'LIKE', label: 'Contains' },
    { value: 'NOT LIKE', label: 'Does not contain' },
    { value: 'IN', label: 'In list' },
    { value: 'NOT IN', label: 'Not in list' },
    { value: 'IS NULL', label: 'Is empty' },
    { value: 'IS NOT NULL', label: 'Is not empty' }
  ];

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: Date.now().toString(),
      column: columns[0] || '',
      operator: '=',
      value: '',
      enabled: true
    };
    setConditions([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== id));
    }
  };

  const updateCondition = (id: string, field: keyof FilterCondition, value: any) => {
    setConditions(conditions.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const buildWhereClause = (): string => {
    if (filterMode === 'raw') {
      return rawSQL.trim();
    }

    const enabledConditions = conditions.filter(c => c.enabled && c.column);
    if (enabledConditions.length === 0) return '';

    const clauseParts = enabledConditions.map(condition => {
      const { column, operator, value } = condition;
      
      // Escape column name
      const escapedColumn = `"${column}"`;
      
      switch (operator) {
        case 'IS NULL':
        case 'IS NOT NULL':
          return `${escapedColumn} ${operator}`;
        case 'LIKE':
        case 'NOT LIKE':
          return `${escapedColumn} ${operator} '%${value.replace(/'/g, "''")}%'`;
        case 'IN':
        case 'NOT IN': {
          const values = value.split(',').map(v => `'${v.trim().replace(/'/g, "''")}'`).join(', ');
          return `${escapedColumn} ${operator} (${values})`;
        }
        default:
          return `${escapedColumn} ${operator} '${value.replace(/'/g, "''")}'`;
      }
    });

    return clauseParts.join(' AND ');
  };

  const handleApply = () => {
    const whereClause = buildWhereClause();
    // Pass current state back to parent for preservation
    onApplyFilter(whereClause, filterMode, conditions);
  };

  const handleReset = () => {
    setRawSQL('');
    setConditions([{
      id: '1',
      column: columns[0] || '',
      operator: '=',
      value: '',
      enabled: true
    }]);
    onApplyFilter('');
  };

  if (!isOpen) return null;

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
      <div className="flex items-start justify-between gap-3 text-xs">
        {/* Filter Toggle */}
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-gray-500" />
          <button
            onClick={() => setFilterMode('builder')}
            className={`px-2 py-0.5 rounded ${
              filterMode === 'builder'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Builder
          </button>
          <button
            onClick={() => setFilterMode('raw')}
            className={`px-2 py-0.5 rounded ${
              filterMode === 'raw'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            SQL
          </button>
        </div>

        {/* Conditions */}
        {filterMode === 'builder' ? (
          <div className="flex-1">
            <div className="space-y-1">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={condition.enabled}
                    onChange={(e) => updateCondition(condition.id, 'enabled', e.target.checked)}
                    className="w-3 h-3"
                  />
                  <select
                    value={condition.column}
                    onChange={(e) => updateCondition(condition.id, 'column', e.target.value)}
                    className="border border-gray-300 rounded px-1 py-0.5 text-xs font-mono min-w-20"
                    style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
                  >
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) => updateCondition(condition.id, 'operator', e.target.value as FilterOperator)}
                    className="border border-gray-300 rounded px-1 py-0.5 text-xs"
                  >
                    {operators.map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  {!['IS NULL', 'IS NOT NULL'].includes(condition.operator) && (
                    <input
                      type="text"
                      value={condition.value}
                      onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                      placeholder="value"
                      className="border border-gray-300 rounded px-1 py-0.5 text-xs font-mono w-20"
                      style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
                    />
                  )}
                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="text-red-600 hover:text-red-800 p-0.5"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                  )}
                  {index < conditions.length - 1 && <span className="text-gray-400 text-xs">AND</span>}
                </div>
              ))}
            </div>
            <button
              onClick={addCondition}
              className="text-blue-600 hover:text-blue-800 p-0.5 mt-1 flex items-center gap-1"
              title="Add condition"
            >
              <Plus className="h-3 w-3" />
              <span className="text-xs">Add condition</span>
            </button>
          </div>
        ) : (
          <div className="flex-1">
            <input
              type="text"
              value={rawSQL}
              onChange={(e) => setRawSQL(e.target.value)}
              placeholder="column = 'value' AND other_column > 100"
              className="w-full border border-gray-300 rounded px-2 py-0.5 text-xs font-mono"
              style={{ fontFamily: 'Menlo, Monaco, "Courier New", monospace' }}
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleReset}
            className="px-2 py-0.5 text-xs text-gray-700 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            className="px-2 py-0.5 bg-blue-600 text-white hover:bg-blue-700 rounded text-xs"
          >
            Apply
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-0.5"
            title="Close"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};