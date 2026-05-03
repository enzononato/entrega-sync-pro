import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Copy } from 'lucide-react';

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
}

const STATUS_BADGE: Record<RowStatus, { label: string; className: string; icon: React.ElementType }> = {
  novo: { label: 'Novo', className: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
  duplicado: { label: 'Duplicado', className: 'bg-warning/15 text-warning border-warning/30', icon: Copy },
  invalido: { label: 'Inválido', className: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
};

export function ImportPreviewTable<T>({ rows, columns, maxPreview = 50 }: Props<T>) {
  const novos = rows.filter(r => r.status === 'novo').length;
  const dups = rows.filter(r => r.status === 'duplicado').length;
  const inv = rows.filter(r => r.status === 'invalido').length;
  const visible = rows.slice(0, maxPreview);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={STATUS_BADGE.novo.className}>
          <CheckCircle2 className="h-3 w-3 mr-1" /> {novos} novos
        </Badge>
        <Badge variant="outline" className={STATUS_BADGE.duplicado.className}>
          <Copy className="h-3 w-3 mr-1" /> {dups} duplicados
        </Badge>
        <Badge variant="outline" className={STATUS_BADGE.invalido.className}>
          <AlertTriangle className="h-3 w-3 mr-1" /> {inv} inválidos
        </Badge>
        <Badge variant="outline">Total: {rows.length}</Badge>
      </div>

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
        {rows.length > maxPreview && (
          <p className="p-2 text-center text-muted-foreground border-t">
            … e mais {rows.length - maxPreview} linhas
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
    </div>
  );
}