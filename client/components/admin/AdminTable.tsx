import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import styles from './AdminTable.module.css';

interface Row {
  id: string;
  [key: string]: unknown;
}

interface Column {
  key: string;
  label: string;
  render?: (value: any, row?: any) => React.ReactNode;
  width?: string;
}

interface TableAction {
  label: string;
  onClick: (row: Row) => void | Promise<void>;
  variant?: string;
  disabled?: (row: Row) => boolean;
}

interface AdminTableProps {
  columns: Column[];
  rows: Row[];
  loading?: boolean;
  onRowClick?: (row: Row) => void;
  onAction?: (action: string, row: Row) => void;
  actions?: TableAction[];
  pagination?: {
    current: number;
    total: number;
    pageSize: number;
    onChange: (page: number) => void;
  };
  selectable?: boolean;
  onSelectionChange?: (selected: string[]) => void;
}

export const AdminTable: React.FC<AdminTableProps> = (props: AdminTableProps) => {
  const {
    columns,
    rows,
    loading = false,
    onRowClick,
    onAction,
    actions = [],
    pagination,
    selectable = false,
    onSelectionChange,
  } = props;
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(rows.map(r => r.id));
      setSelectedRows(allIds);
      onSelectionChange?.(Array.from(allIds));
    } else {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newSelected = new Set(selectedRows);
    if (e.target.checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (rows.length === 0) {
    return <div className={styles.empty}>No data available</div>;
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {selectable && (
                <th className={styles.checkboxCol}>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedRows.size === rows.length && rows.length > 0}
                    aria-label="Select all rows"
                    title="Select all rows"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.key} className={styles.cell}>
                  {col.label}
                </th>
              ))}
              <th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={selectedRows.has(row.id) ? styles.selected : ''}
              >
                {selectable && (
                  <td className={styles.checkboxCol}>
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.id)}
                      onChange={(e) => handleSelectRow(row.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select row ${row.id}`}
                      title={`Select row ${row.id}`}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={`${row.id}-${col.key}`}>
                    <>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] as any)}
                    </>
                  </td>
                ))}
                <td className={styles.actionsCol}>
                  {actions.length > 0 ? (
                    <div className={styles.actionButtons}>
                      {actions.map((action, index) => (
                        <button
                          key={`${row.id}-action-${index}`}
                          className={styles.menuBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row);
                          }}
                          disabled={action.disabled?.(row)}
                          title={action.label}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      className={styles.menuBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Show context menu
                      }}
                      aria-label="Row actions"
                      title="Row actions"
                    >
                      {/* use MoreVertical icon */}
                      <MoreVertical size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            disabled={pagination.current === 1}
            onClick={() => pagination.onChange(pagination.current - 1)}
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Page {pagination.current} of {totalPages}
          </span>
          <button
            disabled={pagination.current === totalPages}
            onClick={() => pagination.onChange(pagination.current + 1)}
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminTable;
