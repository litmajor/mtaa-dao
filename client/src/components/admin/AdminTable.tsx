import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row?: any) => React.ReactNode;
}

interface Props {
  data: any[];
  columns: Column[];
  actions?: any[];
  selectedRows?: Set<string>;
  onSelectRow?: (id: string) => void;
  onSelectAll?: (checked: boolean) => void;
}

export default function AdminTable({ data, columns, actions }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key}>{col.label}</TableHead>
          ))}
          {actions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id}>
            {columns.map((col) => (
              <TableCell key={col.key}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </TableCell>
            ))}
            {actions && (
              <TableCell>
                <div className="flex gap-2">
                  {actions.map((a: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => a.onClick && a.onClick(row)}
                      className="text-sm text-primary underline"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
