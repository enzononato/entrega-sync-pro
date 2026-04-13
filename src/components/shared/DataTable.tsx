import { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T, index: number) => void;
  selectedIndex?: number;
}

export function DataTable<T>({ columns, data, loading, emptyMessage = 'Nenhum dado encontrado', onRowClick, selectedIndex }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <EmptyState titulo={emptyMessage} />;
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, i) => (
              <TableRow key={i} onClick={() => onRowClick?.(item, i)} className={onRowClick ? 'cursor-pointer' : '' + (selectedIndex === i ? ' bg-accent' : '')}>
                {columns.map(col => (
                  <TableCell key={col.key}>
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {data.map((item, i) => (
          <div key={i} onClick={() => onRowClick?.(item, i)} className={`rounded-xl border bg-card p-4 shadow-sm space-y-2 ${onRowClick ? 'cursor-pointer' : ''} ${selectedIndex === i ? 'ring-2 ring-primary' : ''}`}>
            {columns.map(col => (
              <div key={col.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">{col.label}</span>
                <span>{col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
