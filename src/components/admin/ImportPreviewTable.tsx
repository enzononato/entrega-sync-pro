import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Copy, X } from 'lucide-react';

export type RowStatus = 'novo' | 'duplicado' | 'invalido';

export interface PreviewColumn<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
}

interface Props<T> {
  rows: { row: T; status: RowStatus; reason?: string }[];
  columns: PreviewColumn<T>[];
  maxPreview?: number;
  skippedCount?: number;
  skippedReasons?: Record<string, number>;
  detectedColumns?: { name: string; mapped: boolean }[];
  fileName?: string;
  invalidLines?: { line: number; reason: string; preview?: string }[];
}

const STATUS_BADGE: Record<RowStatus, { label: string; className: string; icon: React.ElementType }> = {
  novo: { label: 'Novo', className: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
  duplicado: { label: 'Duplicado', className: 'bg-warning/15 text-warning border-warning/30', icon: Copy },
  invalido: { label: 'Inválido', className: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
};

export function ImportPreviewTable<T>({ rows, columns, maxPreview = 50, skippedCount = 0, skippedReasons, detectedColumns, fileName, invalidLines }: Props<T>) {
  const novos = rows.filter(r => r.status === 'novo').length;
  const dups = rows.filter(r => r.status === 'duplicado').length;
  const inv = rows.filter(r => r.status === 'invalido').length;
  const [filter, setFilter] = useState<RowStatus | null>(null);
  const filtered = filter ? rows.filter(r => r.status === filter) : rows;
  const visible = filtered.slice(0, maxPreview);
  const mappedCols = detectedColumns?.filter(c => c.mapped) ?? [];
  const unmappedCols = detectedColumns?.filter(c => !c.mapped) ?? [];

  const toggle = (s: RowStatus) => setFilter(prev => (prev === s ? null : s));
  const btnBase = 'transition cursor-pointer hover:opacity-80';
  const activeRing = (s: RowStatus) => (filter === s ? 'ring-2 ring-offset-1 ring-primary' : '');

  return (
    <div className="space-y-3">
      {fileName && (
        <p className="text-xs text-muted-foreground truncate">
          Arquivo: <span className="font-mono">{fileName}</span>
        </p>
      )}

      {detectedColumns && detectedColumns.length > 0 && (
        <div className="rounded border bg-muted/30 p-2 space-y-1.5 text-xs">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-success/15 text-success border-success/30">
              {mappedCols.length} colunas reconhecidas
            </Badge>
            {unmappedCols.length > 0 && (
              <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
                {unmappedCols.length} ignoradas
              </Badge>
            )}
          </div>
          {unmappedCols.length > 0 && (
            <p className="text-muted-foreground">
              <strong>Não mapeadas:</strong>{' '}
              <span className="font-mono">{unmappedCols.map(c => c.name).join(', ')}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => toggle('novo')} className={`${btnBase} ${activeRing('novo')} rounded`}>
          <Badge variant="outline" className={STATUS_BADGE.novo.className}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> {novos} novos
          </Badge>
        </button>
        <button type="button" onClick={() => toggle('duplicado')} className={`${btnBase} ${activeRing('duplicado')} rounded`}>
          <Badge variant="outline" className={STATUS_BADGE.duplicado.className}>
            <Copy className="h-3 w-3 mr-1" /> {dups} duplicados
          </Badge>
        </button>
        <button type="button" onClick={() => toggle('invalido')} className={`${btnBase} ${activeRing('invalido')} rounded`}>
          <Badge variant="outline" className={STATUS_BADGE.invalido.className}>
            <AlertTriangle className="h-3 w-3 mr-1" /> {inv} inválidos
          </Badge>
        </button>
        {skippedCount > 0 && (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            {skippedCount} linhas puladas
          </Badge>
        )}
        <Badge variant="outline">Total: {rows.length}</Badge>
        {filter && (
          <button type="button" onClick={() => setFilter(null)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" /> limpar filtro
          </button>
        )}
      </div>

      {skippedReasons && Object.keys(skippedReasons).length > 0 && (
        <ul className="text-[11px] text-muted-foreground space-y-0.5 pl-4 list-disc">
          {Object.entries(skippedReasons).map(([reason, count]) => (
            <li key={reason}>{reason}: <strong>{count}</strong></li>
          ))}
        </ul>
      )}

      <div className="max-h-72 overflow-auto rounded border text-xs">
        <table className="w-full">
          <thead className="sticky top-0 bg-muted z-10">
            <tr>
              <th className="p-2 text-left">Status</th>
              {columns.map(c => (
                <th key={c.key} className={`p-2 text-${c.align ?? 'left'}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="p-3 text-center text-muted-foreground">Nenhuma linha neste filtro.</td></tr>
            )}
            {visible.map((entry, i) => {
              const cfg = STATUS_BADGE[entry.status];
              const Icon = cfg.icon;
              return (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px] ${cfg.className}`}
                      title={entry.reason}
                    >
                      <Icon className="h-3 w-3" /> {cfg.label}
                    </span>
                  </td>
                  {columns.map(c => (
                    <td key={c.key} className={`p-2 text-${c.align ?? 'left'}`}>
                      {c.render ? c.render(entry.row) : String((entry.row as any)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > maxPreview && (
          <p className="p-2 text-center text-muted-foreground border-t">
            … e mais {filtered.length - maxPreview} linhas
          </p>
        )}
      </div>

      {dups > 0 && (
        <p className="text-xs text-muted-foreground">
          Linhas duplicadas serão <strong>ignoradas</strong> na importação.
        </p>
      )}
      {inv > 0 && (
        <p className="text-xs text-muted-foreground">
          Linhas inválidas (campos obrigatórios faltando) serão <strong>ignoradas</strong>.
        </p>
      )}

      {invalidLines && invalidLines.length > 0 && (
        <details className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs" open>
          <summary className="cursor-pointer font-medium text-destructive">
            <AlertTriangle className="inline h-3 w-3 mr-1" />
            {invalidLines.length} linha(s) com erro — clique para ver detalhes
          </summary>
          <div className="mt-2 max-h-48 overflow-auto rounded border bg-background">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="p-1.5 text-left w-16">Linha</th>
                  <th className="p-1.5 text-left">Motivo</th>
                  <th className="p-1.5 text-left">Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                {invalidLines.slice(0, 100).map((l, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-1.5 font-mono">{l.line}</td>
                    <td className="p-1.5 text-destructive">{l.reason}</td>
                    <td className="p-1.5 font-mono text-muted-foreground truncate max-w-xs" title={l.preview}>
                      {l.preview ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {invalidLines.length > 100 && (
              <p className="p-1.5 text-center text-muted-foreground border-t">
                … e mais {invalidLines.length - 100} linhas
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}