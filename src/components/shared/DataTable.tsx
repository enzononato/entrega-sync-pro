import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './EmptyState';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  /** Enable client-side pagination. Defaults to true. Pass false to render all rows. */
  paginated?: boolean;
  /** Rows per page when paginated. Default 50. */
  pageSize?: number;
}

export function DataTable<T>({ columns, data, loading, emptyMessage = 'Nenhum dado encontrado', onRowClick, selectedIndex, paginated = true, pageSize = 50 }: DataTableProps<T>) {
  const [page, setPage] = useState(0);

  // Reset to first page whenever the underlying data changes (e.g. filters applied)
  useEffect(() => { setPage(0); }, [data]);

  const totalPages = paginated ? Math.max(1, Math.ceil(data.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const pageData = useMemo(() => {
    if (!paginated) return data;
    const start = safePage * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, paginated, pageSize, safePage]);

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
            {pageData.map((item, i) => {
              const absoluteIndex = paginated ? safePage * pageSize + i : i;
              return (
              <TableRow key={absoluteIndex} onClick={() => onRowClick?.(item, absoluteIndex)} className={onRowClick ? 'cursor-pointer' : '' + (selectedIndex === absoluteIndex ? ' bg-accent' : '')}>
                {columns.map(col => (
                  <TableCell key={col.key}>
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            );})}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {pageData.map((item, i) => {
          const absoluteIndex = paginated ? safePage * pageSize + i : i;
          return (
          <div key={absoluteIndex} onClick={() => onRowClick?.(item, absoluteIndex)} className={`rounded-xl border bg-card p-4 shadow-sm space-y-2 ${onRowClick ? 'cursor-pointer' : ''} ${selectedIndex === absoluteIndex ? 'ring-2 ring-primary' : ''}`}>
            {columns.map(col => (
              <div key={col.key} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">{col.label}</span>
                <span>{col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}</span>
              </div>
            ))}
          </div>
        );})}
      </div>

      {paginated && data.length > pageSize && (
        <div className="flex items-center justify-between gap-3 mt-4 text-sm">
          <span className="text-muted-foreground">
            Mostrando {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, data.length)} de {data.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">{safePage + 1} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
