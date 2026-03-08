import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';
import type { IndicatorStatus } from '@/types';

interface KpiCardProps {
  titulo: string;
  valor: number | string;
  meta?: number | string;
  percentual?: number;
  status?: IndicatorStatus;
  unidade?: string;
}

const statusColor = { acima_meta: 'green' as const, dentro_meta: 'blue' as const, abaixo_meta: 'red' as const };

export function KpiCard({ titulo, valor, meta, percentual, status, unidade }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">{titulo}</span>
        {status && <StatusBadge status={status} />}
      </div>
      <div className="text-2xl font-bold text-foreground">
        {valor}{unidade && <span className="text-sm font-normal text-muted-foreground ml-1">{unidade}</span>}
      </div>
      {meta !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">Meta: {meta}{unidade ? ` ${unidade}` : ''}</p>
      )}
      {percentual !== undefined && (
        <div className="mt-3 space-y-1">
          <ProgressBar value={percentual} color={status ? statusColor[status] : 'blue'} />
          <p className="text-xs text-muted-foreground text-right">{percentual.toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
}
