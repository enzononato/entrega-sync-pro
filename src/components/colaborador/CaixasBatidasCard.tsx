import { useState } from 'react';
import { format } from 'date-fns';
import { Package, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useCaixasBatidasColaborador } from '@/hooks/useCaixasBatidas';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function CaixasBatidasCard({ userId, mes }: { userId: string | undefined; mes: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading } = useCaixasBatidasColaborador(userId, mes);

  if (isLoading || !data) return null;
  const d = data.detalhes;
  const pct = d.teto > 0 ? Math.min(100, (data.valor_estimado / d.teto) * 100) : 0;

  return (
    <div className="card-elevated rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">Caixas Batidas</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Acumulado do mês</span>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-extrabold text-primary leading-none">{fmtBRL(data.valor_estimado)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              de <span className="font-semibold">{fmtBRL(d.teto)}</span> (teto {d.worker_type})
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Caixas</p>
            <p className="text-base font-bold text-foreground">{d.total_caixas.toLocaleString('pt-BR')}</p>
            <p className="text-[10px] text-muted-foreground">{d.qtd_mapas} mapas</p>
          </div>
        </div>

        <Progress value={pct} className="h-2" />

        {d.teto_atingido && (
          <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg p-2.5">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="text-[11px]">
              <p className="font-semibold text-foreground">Teto atingido</p>
              <p className="text-muted-foreground">
                Bruto: {fmtBRL(d.valor_bruto)} • Cortado: <span className="font-semibold text-warning">{fmtBRL(d.valor_cortado)}</span>
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded(p => !p)}
          className="w-full flex items-center justify-between text-[11px] text-muted-foreground hover:text-foreground transition-colors pt-1"
        >
          <span>Detalhamento por mapa ({d.mapas.length})</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {expanded && (
          <div className="border-t border-border/40 pt-2 max-h-72 overflow-y-auto space-y-1.5">
            {d.mapas.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] py-1.5 px-1">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{m.mapa}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(m.data + 'T00:00:00'), 'dd/MM')} • {m.caixas} cx × {fmtBRL(m.valor_caixa)} • Fator {m.fator}
                  </p>
                </div>
                <span className="font-bold text-primary shrink-0 ml-2">{fmtBRL(m.valor)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
