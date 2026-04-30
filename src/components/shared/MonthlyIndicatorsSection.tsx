import { CalendarDays, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMonthLabel } from '@/lib/indicatorPeriodicity';
import type { DesempenhoRow } from '@/hooks/useDesempenho';

interface MonthlyIndicatorsSectionProps {
  rows: DesempenhoRow[];
  /** "compact" usa tipografia menor, ideal para Home mobile do colaborador. */
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * Seção dedicada para indicadores mensais (não vinculados a mapa).
 * Renderizada acima da listagem por mapa nas telas de Desempenho.
 */
export function MonthlyIndicatorsSection({ rows, variant = 'default', className }: MonthlyIndicatorsSectionProps) {
  if (!rows || rows.length === 0) return null;

  // Agrupa por mês de referência (YYYY-MM) preservando a ordem (já vem sort desc).
  const byMonth = new Map<string, DesempenhoRow[]>();
  for (const r of rows) {
    const ym = (r.data_referencia ?? '').slice(0, 7);
    if (!byMonth.has(ym)) byMonth.set(ym, []);
    byMonth.get(ym)!.push(r);
  }

  const compact = variant === 'compact';

  return (
    <div className={cn('rounded-xl border border-amber-200/60 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10 overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/60 dark:border-amber-900/40 bg-amber-100/40 dark:bg-amber-950/20">
        <Trophy className={cn('text-amber-700 dark:text-amber-400 shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        <span className={cn('font-bold text-amber-900 dark:text-amber-200', compact ? 'text-xs' : 'text-sm')}>
          Indicadores Mensais
        </span>
        <span className={cn('ml-auto text-amber-700/70 dark:text-amber-400/70 font-medium', compact ? 'text-[10px]' : 'text-[11px]')}>
          Não vinculados a mapa
        </span>
      </div>

      <div>
        {Array.from(byMonth.entries()).map(([ym, monthRows]) => (
          <div key={ym} className="border-b border-amber-200/40 dark:border-amber-900/30 last:border-b-0">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-100/20 dark:bg-amber-950/10">
              <CalendarDays className="h-3 w-3 text-amber-700 dark:text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                {formatMonthLabel(`${ym}-01`)}
              </span>
            </div>
            <div className="divide-y divide-amber-200/30 dark:divide-amber-900/20">
              {monthRows.map(r => (
                <MonthlyRow key={r.id} row={r} compact={compact} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtNumber(v: number | null | undefined): string {
  if (v == null) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MonthlyRow({ row, compact }: { row: DesempenhoRow; compact: boolean }) {
  const valor = Number(row.valor) || 0;
  const meta = row.meta != null ? Number(row.meta) : null;
  const desafio = row.desafio != null ? Number(row.desafio) : null;

  const atingiuMeta = row.status === 'atingiu' || row.status === 'dentro_meta' || row.status === 'acima_meta';
  const atingiuDesafio = row.status_desafio === 'atingiu' || (desafio != null && desafio > 0 && valor >= desafio);

  const StatusIcon = atingiuMeta ? CheckCircle : XCircle;

  return (
    <div className={cn('flex items-center gap-3 px-4', compact ? 'py-2' : 'py-2.5')}>
      <span className={cn(
        'inline-flex items-center rounded-md bg-amber-200/60 dark:bg-amber-900/40 px-2 py-0.5 font-mono font-bold text-amber-800 dark:text-amber-200 shrink-0',
        compact ? 'text-[9px]' : 'text-[10px]'
      )}>
        {row.indicators?.codigo}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-semibold text-foreground truncate', compact ? 'text-xs' : 'text-sm')}>
          {row.indicators?.nome}
        </p>
        <p className={cn('text-muted-foreground mt-0.5', compact ? 'text-[10px]' : 'text-[11px]')}>
          Realizado <strong className="text-foreground">{fmtNumber(valor)}</strong>
          {meta != null && <> · Meta {fmtNumber(meta)}</>}
          {desafio != null && desafio > 0 && <> · Desafio {fmtNumber(desafio)}</>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn(
          'inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full',
          compact ? 'text-[9px]' : 'text-[10px]',
          atingiuMeta
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
        )}>
          <StatusIcon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
          {atingiuMeta ? 'Atingiu' : 'Não Atingiu'}
        </span>
        {desafio != null && desafio > 0 && (
          <span className={cn(
            'font-bold px-2 py-0.5 rounded-full',
            compact ? 'text-[9px]' : 'text-[10px]',
            atingiuDesafio
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              : 'bg-muted text-muted-foreground'
          )}>
            {atingiuDesafio ? '🎯 Desafio ✓' : '🎯 Desafio'}
          </span>
        )}
      </div>
    </div>
  );
}