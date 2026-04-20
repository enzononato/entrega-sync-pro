import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useIncentivoDiario, useIncentivoDiarioHistorico } from '@/hooks/useIncentivoDiario';
import { useMetas } from '@/hooks/useMetas';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useDescontosColaborador } from '@/hooks/useDescontos';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, Loader2, TrendingDown, TrendingUp,
  AlertTriangle, Info, ChevronDown, ChevronUp, Sparkles,
  CheckCircle2, XCircle, Minus, Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CaixasBatidasCard } from '@/components/colaborador/CaixasBatidasCard';
import { useCaixasBatidasColaborador } from '@/hooks/useCaixasBatidas';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function IncentivoColaborador() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [showAllDescontos, setShowAllDescontos] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);

  const { data: incentivo, isLoading: loadInc } = useIncentivoDiario(user?.id, today);
  const { data: historico = [], isLoading: loadHist } = useIncentivoDiarioHistorico(user?.id, 30);
  const { data: metas = [] } = useMetas({ vigentes: true });
  const { data: desempenho = [] } = useDesempenhoDiario(today, today, { user_id: user?.id });
  const { data: descontos = [] } = useDescontosColaborador(user?.id, 60);

  // Monthly bonus record (stored on first day of month)
  const mesAtual = format(new Date(), 'yyyy-MM');
  const firstDayOfMonth = `${mesAtual}-01`;
  const { data: bonusMensal } = useQuery({
    queryKey: ['bonus_mensal', user?.id, mesAtual],
    queryFn: async () => {
      const { data: rows, error } = await (supabase
        .from('user_incentives_daily' as any) as any)
        .select('*')
        .eq('user_id', user!.id)
        .eq('data_referencia', firstDayOfMonth);
      if (error) throw error;
      const data = (rows ?? []).find((r: any) => (r.detalhes_json as any)?.tipo === 'bonus_mensal');
      if (!data) return null;
      return data as { valor_estimado: number; detalhes_json: { tipo: string; mes: string; indicadores: { indicator_id: string; valor_agregado: number; meta: number; atingiu: boolean; bonus: number; desafio?: number; atingiu_desafio?: boolean; bonus_desafio?: number }[] } };
    },
    enabled: !!user?.id,
  });

  const { data: caixasBatidas } = useCaixasBatidasColaborador(user?.id, mesAtual);

  // Monthly goals with bonificacao > 0 for this user's worker_type
  const metasMensais = useMemo(() => {
    return metas.filter(m => {
      if (m.periodo_tipo !== 'mensal' || m.valor_bonificacao <= 0) return false;
      if (!m.user_id && m.worker_type === user?.worker_type) return true;
      if (!m.user_id && !m.worker_type) return true;
      if (m.user_id === user?.id) return true;
      return false;
    });
  }, [metas, user]);

  // Filter goals relevant to this user's worker_type and with bonus > 0
  const metasRelevantes = useMemo(() => {
    return metas.filter(m => {
      if (m.valor_bonificacao <= 0) return false;
      // Individual goal for this user
      if (m.user_id === user?.id) return true;
      // Goal for user's worker_type (no specific user)
      if (!m.user_id && m.worker_type === user?.worker_type) return true;
      // General goal (no user, no worker_type)
      if (!m.user_id && !m.worker_type) return true;
      return false;
    });
  }, [metas, user]);

  const breakdown = useMemo(() => {
    return metasRelevantes.map(m => {
      const d = desempenho.find(x => x.indicator_id === m.indicator_id);
      const atingiu = d?.status === 'dentro_meta' || d?.status === 'acima_meta';
      const valorGerado = atingiu ? m.valor_bonificacao : 0;
      const atingiuDesafio = atingiu && m.valor_desafio > 0 && (d?.valor ?? Infinity) <= m.valor_desafio;
      const bonusDesafio = atingiuDesafio ? m.valor_bonificacao_desafio : 0;
      return {
        indicador: m.indicators?.nome ?? '',
        codigo: m.indicators?.codigo ?? '',
        valor: d?.valor ?? 0,
        atingiu,
        atingiuDesafio,
        bonusDesafio,
        status: d?.status ?? 'abaixo_meta',
        valorGerado: valorGerado + bonusDesafio,
        desafio: m.valor_desafio,
      };
    });
  }, [metasRelevantes, desempenho]);

  const totalEstimado = breakdown.reduce((s, b) => s + b.valorGerado, 0);
  const valorHoje = incentivo?.valor_estimado ?? totalEstimado;

  const mesAtualStr = format(new Date(), 'yyyy-MM');
  const mesHistorico = useMemo(() => historico.filter(h => h.data_referencia.startsWith(mesAtualStr)), [historico, mesAtualStr]);
  const bonusAcumuladoBase = mesHistorico.reduce((s, h) => s + (h.valor_fechado ?? h.valor_estimado), 0);
  const valorCaixasBatidas = caixasBatidas?.valor_estimado ?? 0;
  const bonusAcumulado = bonusAcumuladoBase + valorCaixasBatidas;
  const diasComDados = mesHistorico.length;

  const descontosMes = useMemo(() => descontos.filter(d => d.data_referencia.startsWith(mesAtualStr)), [descontos, mesAtualStr]);
  const totalDescontos = descontosMes.reduce((s, d) => s + d.valor_desconto, 0);
  const liquidoMes = bonusAcumulado - totalDescontos;

  const descontosAnteriores = useMemo(() => descontos.filter(d => !d.data_referencia.startsWith(mesAtualStr)), [descontos, mesAtualStr]);

  const chartData = useMemo(() =>
    [...historico].slice(0, 7).reverse().map(h => ({
      data: format(new Date(h.data_referencia + 'T00:00:00'), 'dd/MM'),
      valor: h.valor_fechado ?? h.valor_estimado,
    })),
  [historico]);

  if (loadInc) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 stagger-children pb-2">
      {/* ── Header ─────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Remuneração Variável</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* ── Hero Card ──────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
        <div className="p-5 pb-4 text-white">
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">
            {totalDescontos > 0 ? 'Líquido estimado no mês' : 'Bônus acumulado no mês'}
          </p>
          <div className="flex items-end justify-between mt-1.5">
            <div>
              <p className="text-3xl font-extrabold leading-none">
                {fmtBRL(totalDescontos > 0 ? liquidoMes : bonusAcumulado)}
              </p>
              {totalDescontos > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-white/50">
                    Bruto {fmtBRL(bonusAcumulado)}
                  </span>
                  <span className="text-[11px] text-red-300 font-medium">
                    -{fmtBRL(totalDescontos)}
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="h-12 w-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-1">
                <Sparkles className="h-6 w-6 text-white/80" />
              </div>
              <p className="text-[10px] text-white/40">{diasComDados} dias</p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bg-white/[0.06] backdrop-blur-sm">
          <div className="py-3 px-4 text-center">
            <p className="text-[8px] text-white/40 uppercase tracking-widest font-medium mb-0.5">
              Metas Mensais Atingidas
            </p>
            <p className="text-base font-bold text-white">
              {(bonusMensal?.detalhes_json?.indicadores?.filter((i: any) => i.atingiu).length ?? 0)}/{metasMensais.length}
            </p>
          </div>
        </div>
      </div>

      {/* ── Caixas Batidas ─────────────────────── */}
      <CaixasBatidasCard userId={user?.id} mes={mesAtual} />

      {/* ── Bônus Mensal ──────────────────────── */}
      {metasMensais.length > 0 && (
        <div className="card-elevated rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Bônus Mensal</span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {metasMensais.map((m, i) => {
              const bonusDetail = bonusMensal?.detalhes_json?.indicadores?.find(
                (ind: any) => ind.indicator_id === m.indicator_id
              );
              const atingiu = bonusDetail?.atingiu ?? false;
              const valorAgregado = bonusDetail?.valor_agregado;
              const bonusValor = (bonusDetail?.bonus ?? 0) + (bonusDetail?.atingiu_desafio ? (bonusDetail?.bonus_desafio ?? 0) : 0);
              const StatusIcon = bonusDetail ? (atingiu ? CheckCircle2 : XCircle) : Minus;
              const statusClr = bonusDetail ? (atingiu ? 'text-success' : 'text-destructive') : 'text-muted-foreground';

              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <StatusIcon className={cn('h-4 w-4 shrink-0', statusClr)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">
                          {m.indicators?.nome ?? m.indicators?.codigo ?? ''}
                        </span>
                        <span className="text-sm font-bold text-primary ml-2 shrink-0">
                          {fmtBRL(bonusValor)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          Meta: ≤ {m.valor_meta}{m.indicators?.codigo === 'TX_REPOSICAO' ? '' : '%'}
                        </span>
                        {valorAgregado != null && (
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                            atingiu ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          )}>
                            Resultado: {valorAgregado}{m.indicators?.codigo === 'TX_REPOSICAO' ? '' : '%'}
                          </span>
                        )}
                        {!bonusDetail && (
                          <span className="text-[10px] text-muted-foreground italic">Aguardando cálculo</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Bonificação: {fmtBRL(m.valor_bonificacao)}
                        {m.valor_desafio > 0 && (
                          <span className="ml-2 text-amber-600">| Desafio: +{fmtBRL(m.valor_bonificacao_desafio)}</span>
                        )}
                      </p>
                      {bonusDetail && bonusDetail.atingiu_desafio && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-block mt-1">
                          🎯 Desafio atingido! +{fmtBRL(bonusDetail.bonus_desafio ?? 0)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {bonusMensal && (
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
                <span className="text-sm font-bold text-foreground">Total bônus mensal</span>
                <span className="text-lg font-extrabold text-primary">{fmtBRL(bonusMensal.valor_estimado)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Descontos do Mês ──────────────────── */}
      <div className="card-elevated rounded-2xl overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm font-bold text-foreground">Descontos do Mês</span>
          {descontosMes.length > 0 && (
            <span className="ml-auto text-[10px] bg-destructive/10 text-destructive rounded-full px-2 py-0.5 font-bold">
              {descontosMes.length}
            </span>
          )}
        </div>

        {descontosMes.length > 0 ? (
          <div className="divide-y divide-border/40">
            {descontosMes.map(d => (
              <div key={d.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{d.indicators?.nome ?? '—'}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                      {format(new Date(d.data_referencia + 'T00:00:00'), 'dd/MM')}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-destructive shrink-0 ml-2">-{fmtBRL(d.valor_desconto)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted-foreground">Meta</p>
                    <p className="font-semibold text-foreground">{d.valor_meta}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Resultado</p>
                    <p className="font-semibold text-foreground">{d.valor_realizado}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Atingimento</p>
                    <p className={cn('font-semibold', d.percentual_atingimento >= 100 ? 'text-success' : 'text-destructive')}>
                      {d.percentual_atingimento.toFixed(0)}%
                    </p>
                  </div>
                </div>
                {d.motivo && (
                  <div className="flex items-start gap-1.5 bg-warning/5 border border-warning/10 rounded-lg p-2.5">
                    <Info className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <p className="text-[11px] text-muted-foreground">{d.motivo}</p>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-destructive/5">
              <span className="text-sm font-bold text-foreground">Total descontos</span>
              <span className="text-base font-extrabold text-destructive">-{fmtBRL(totalDescontos)}</span>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="rounded-xl bg-success/5 border border-success/10 p-4 text-center">
              <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-1.5" />
              <p className="text-sm font-medium text-foreground">Nenhum desconto no mês</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Continue mantendo suas metas! 🎯</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Descontos Anteriores (collapsible) ── */}
      {descontosAnteriores.length > 0 && (
        <div className="card-elevated rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowAllDescontos(p => !p)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
          >
            <span className="text-sm font-bold text-foreground">Descontos Anteriores</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">{descontosAnteriores.length}</span>
              {showAllDescontos ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
          {showAllDescontos && (
            <div className="divide-y divide-border/40">
              {descontosAnteriores.slice(0, 10).map(d => (
                <div key={d.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{d.indicators?.nome ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(d.data_referencia + 'T00:00:00'), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-destructive shrink-0 ml-2">-{fmtBRL(d.valor_desconto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Histórico Recente ─────────────────── */}
      {historico.length > 0 && (
        <div className="card-elevated rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Histórico Diário</span>
          </div>
          <div className="divide-y divide-border/40">
            {historico.slice(0, 7).map(h => {
              const val = h.valor_fechado ?? h.valor_estimado;
              const isFechado = h.status === 'fechado';
              return (
                <div key={h.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center shrink-0',
                      isFechado ? 'bg-success/10' : 'bg-primary/10'
                    )}>
                      {isFechado
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        : <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      }
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {format(new Date(h.data_referencia + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">{h.status === 'fechado' ? 'Fechado' : 'Estimado'}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground">{fmtBRL(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
