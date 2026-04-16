import { useMemo, useState } from 'react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiario } from '@/hooks/useIncentivoDiario';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { usePendingMandatoryFeedback } from '@/hooks/useMandatoryFeedback';
import { useCausaRaizPorColaborador, type CausaRaizRow } from '@/hooks/useCausaRaiz';
import { MandatoryFeedbackModal } from '@/components/colaborador/MandatoryFeedbackModal';
import { EvolutionCharts } from '@/components/colaborador/EvolutionCharts';
import { ReportCausaRaizSheet } from '@/components/colaborador/ReportCausaRaizSheet';
import { ViewCausaRaizSheet } from '@/components/colaborador/ViewCausaRaizSheet';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  CheckCircle, XCircle, DollarSign, ClipboardList,
  Trophy, ChevronRight, ChevronDown, Zap, Flame, Target, MapPin,
  CalendarIcon, TrendingUp, TrendingDown, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { compareIndicators } from '@/lib/indicatorOrder';
import { formatMinutesHHMM } from '@/lib/formatters';
import type { IndicatorStatus } from '@/types';
import type { DesempenhoRow } from '@/hooks/useDesempenho';


/* ── helpers ─────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusColor: Record<string, string> = {
  acima_meta: 'bg-success',
  dentro_meta: 'bg-success',
  abaixo_meta: 'bg-destructive',
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  acima_meta: { label: 'Acima', color: 'text-success', bg: 'bg-success/10', icon: TrendingUp },
  dentro_meta: { label: 'Na meta', color: 'text-primary', bg: 'bg-primary/10', icon: CheckCircle },
  abaixo_meta: { label: 'Abaixo', color: 'text-destructive', bg: 'bg-destructive/10', icon: TrendingDown },
};

type PeriodType = 'hoje' | 'semana' | 'mes' | 'custom';

function getDateRange(period: PeriodType, customStart?: Date, customEnd?: Date) {
  const today = new Date();
  switch (period) {
    case 'hoje':
      return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    case 'semana': {
      const ws = startOfWeek(today, { weekStartsOn: 1 });
      return { start: format(ws, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    }
    case 'mes': {
      const ms = startOfMonth(today);
      return { start: format(ms, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') };
    }
    case 'custom':
      return {
        start: customStart ? format(customStart, 'yyyy-MM-dd') : format(today, 'yyyy-MM-dd'),
        end: customEnd ? format(customEnd, 'yyyy-MM-dd') : format(today, 'yyyy-MM-dd'),
      };
  }
}

const periodLabels: Record<PeriodType, string> = {
  hoje: 'Hoje',
  semana: 'Semana',
  mes: 'Mês',
  custom: 'Período',
};

/* ── component ───────────────────────────────────── */
export default function ColaboradorHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const [period, setPeriod] = useState<PeriodType>('hoje');
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const dateRange = useMemo(() =>
    getDateRange(period, customRange.from, customRange.to),
    [period, customRange]
  );

  const { data: desempenho = [], isLoading: loadDes } = useDesempenhoDiario(dateRange.start, dateRange.end, { user_id: user?.id });
  const { data: incentivo } = useIncentivoDiario(user?.id, today);
  const { data: planos = [], isLoading: loadPlan } = usePlanosDoColaborador(user?.id);
  const { data: pendingFeedback = [] } = usePendingMandatoryFeedback(user?.id);
  const { data: causasRaiz = [] } = useCausaRaizPorColaborador(user?.id);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);


  const showMandatoryModal = pendingFeedback.length > 0 && !feedbackDismissed;

  const [expandedMapas, setExpandedMapas] = useState<Set<string>>(new Set());
  const [reportTarget, setReportTarget] = useState<{ indicatorId: string; indicatorNome: string; dataReferencia: string } | null>(null);
  const [viewCausa, setViewCausa] = useState<CausaRaizRow | null>(null);

  // Build a lookup: "indicatorId|dataReferencia" -> CausaRaizRow
  const causaLookup = useMemo(() => {
    const map = new Map<string, CausaRaizRow>();
    for (const c of causasRaiz) {
      map.set(`${c.indicator_id}|${c.data_referencia}`, c);
    }
    return map;
  }, [causasRaiz]);


  const kpis = useMemo(() => desempenho.filter(d => {
    if (!user?.worker_type || !d.indicators) return true;
    const cat = d.indicators.codigo?.toLowerCase() ?? '';
    if (user.worker_type === 'motorista' && cat.includes('refugo')) return false;
    if (user.worker_type === 'ajudante' && cat.includes('repos')) return false;
    return true;
  }), [desempenho, user?.worker_type]);

  // Group by mapa
  const groupedByMapa = useMemo(() => {
    const map = new Map<string, typeof kpis>();
    for (const d of kpis) {
      const key = d.mapa_numero ?? 'manual';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Sort indicators within each mapa
    for (const [, rows] of map) {
      rows.sort(compareIndicators(r => r.indicators?.codigo));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [kpis]);

  const okCount = kpis.filter(d => d.status === 'acima_meta' || d.status === 'dentro_meta').length;
  const badCount = kpis.filter(d => d.status === 'abaixo_meta').length;

  // Challenge stats
  const desafioStats = useMemo(() => {
    const withDesafio = kpis.filter(d => d.desafio != null && Number(d.desafio) > 0);
    const atingidos = withDesafio.filter(d => d.status_desafio === 'atingiu_desafio');
    return { total: withDesafio.length, atingidos: atingidos.length };
  }, [kpis]);
  const allOnTarget = kpis.length > 0 && badCount === 0;
  const overallPct = kpis.length > 0 ? Math.round((okCount / kpis.length) * 100) : 0;
  const acoesAbertas = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const recentPlanos = planos.slice(0, 3);

  const ringColor = overallPct >= 100 ? 'border-success' : overallPct >= 80 ? 'border-warning' : 'border-destructive';

  const toggleMapa = (key: string) => {
    setExpandedMapas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };


  return (
    <div className="space-y-5 stagger-children pb-2">
      {/* Mandatory Feedback Modal */}
      {showMandatoryModal && (
        <MandatoryFeedbackModal
          pendingIndicators={pendingFeedback}
          onComplete={() => setFeedbackDismissed(true)}
        />
      )}

      {/* ── Header ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {greeting()}, {user?.nome?.split(' ')[0]}! 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        {user?.units && (
          <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2.5 py-1 font-medium">
            📍 {user.units.nome}
          </span>
        )}
      </div>

      {/* ── Period Filter ─────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {(['hoje', 'semana', 'mes'] as PeriodType[]).map(p => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            className={cn('rounded-full h-8 text-xs px-4', period === p && 'shadow-md')}
            onClick={() => setPeriod(p)}
          >
            {periodLabels[p]}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={period === 'custom' ? 'default' : 'outline'}
              size="sm"
              className={cn('rounded-full h-8 text-xs px-3', period === 'custom' && 'shadow-md')}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
              {period === 'custom' && customRange.from
                ? `${format(customRange.from, 'dd/MM')} - ${customRange.to ? format(customRange.to, 'dd/MM') : '...'}`
                : 'Período'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: customRange.from, to: customRange.to }}
              onSelect={(range) => {
                setCustomRange({ from: range?.from, to: range?.to });
                if (range?.from) setPeriod('custom');
              }}
              className="p-3 pointer-events-auto"
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Hero Score ────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-5">
            <div className={cn(
              'relative h-[88px] w-[88px] rounded-full border-[6px] flex items-center justify-center shrink-0 transition-colors',
              ringColor
            )}>
              <div className="text-center">
                <span className="text-3xl font-extrabold text-white leading-none">{overallPct}</span>
                <span className="text-[10px] text-white/60 block -mt-0.5">%</span>
              </div>
              {allOnTarget && kpis.length > 0 && (
                <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-success flex items-center justify-center shadow-md">
                  <Flame className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-white">
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Desempenho {periodLabels[period]}</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-extrabold">{okCount}</span>
                <span className="text-sm text-white/60 font-medium">de {kpis.length} na meta</span>
              </div>
              {user?.routes && (
                <p className="text-[11px] text-white/40 mt-1.5 truncate">🛣️ {user.routes.nome}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/10 bg-white/[0.06] backdrop-blur-sm">
          <div className="py-3 text-center">
            <CheckCircle className="h-3.5 w-3.5 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{okCount}</p>
            <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider">Na Meta</p>
          </div>
          <div className="py-3 text-center">
            <XCircle className="h-3.5 w-3.5 text-destructive mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{badCount}</p>
            <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider">Abaixo</p>
          </div>
          <div className="py-3 text-center">
            <Target className="h-3.5 w-3.5 text-white/40 mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{groupedByMapa.length}</p>
            <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider">Mapa{groupedByMapa.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* ── Success Banner ────────────────────────── */}
      {allOnTarget && kpis.length > 0 && (
        <div className="rounded-2xl bg-success/10 border border-success/20 p-4 flex items-center gap-3 animate-fade-up">
          <div className="h-10 w-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5 text-success" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Todas as metas atingidas! 🎉</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Continue assim para maximizar seu incentivo</p>
          </div>
        </div>
      )}

      {/* ── Resumo Desafios ─────────────────────── */}
      {desafioStats.total > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <span className="text-base">🎯</span>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Desafios do Período</p>
              <p className="text-[10px] text-muted-foreground">{periodLabels[period]}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center rounded-xl bg-muted/40 py-2.5">
              <p className="text-lg font-extrabold text-foreground">{desafioStats.total}</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">Total</p>
            </div>
            <div className="text-center rounded-xl bg-success/10 py-2.5">
              <p className="text-lg font-extrabold text-success">{desafioStats.atingidos}</p>
              <p className="text-[9px] text-success font-medium uppercase tracking-wider">Atingidos</p>
            </div>
            <div className="text-center rounded-xl bg-destructive/10 py-2.5">
              <p className="text-lg font-extrabold text-destructive">{desafioStats.total - desafioStats.atingidos}</p>
              <p className="text-[9px] text-destructive font-medium uppercase tracking-wider">Pendentes</p>
            </div>
          </div>
          {desafioStats.atingidos > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-success/5 border border-success/10 px-3 py-2">
              <Trophy className="h-4 w-4 text-success shrink-0" />
              <p className="text-xs text-success font-medium">
                {desafioStats.atingidos === desafioStats.total
                  ? 'Todos os desafios atingidos! 🔥'
                  : `${desafioStats.atingidos} de ${desafioStats.total} desafios conquistados!`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── KPIs por Mapa ─────────────────────────── */}
      <section>
        <SectionHeader icon={<Zap className="h-4 w-4 text-primary" />} title="KPIs por Mapa" />
        {loadDes ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
        ) : kpis.length === 0 ? (
          <div className="card-elevated p-6 text-center">
            <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sem indicadores para este período</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedByMapa.map(([mapaKey, rows]) => {
              const mapaOk = rows.filter(r => r.status === 'dentro_meta' || r.status === 'acima_meta').length;
              const isMapaExpanded = expandedMapas.has(mapaKey) || groupedByMapa.length === 1;

              return (
                <div key={mapaKey} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleMapa(mapaKey)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 text-left">
                      <span className="text-sm font-bold text-foreground">
                        {mapaKey === 'manual' ? 'Lançamento Manual' : `Mapa ${mapaKey}`}
                      </span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold',
                      mapaOk === rows.length ? 'text-emerald-600' : 'text-red-600'
                    )}>
                      {mapaOk}/{rows.length}
                    </span>
                    {groupedByMapa.length > 1 && (
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isMapaExpanded && 'rotate-180')} />
                    )}
                  </button>

                  {isMapaExpanded && (
                    <div className="border-t border-border/50 divide-y divide-border/30">
                      {rows.map(d => {
                        const status = (d.status as IndicatorStatus | undefined) ?? 'abaixo_meta';
                        const cfg = statusConfig[status] ?? statusConfig.abaixo_meta;
                        const StatusIcon = cfg.icon;
                        const atingiu = status === 'acima_meta' || status === 'dentro_meta';
                        const isTime = ['TML', 'TR', 'TI', 'JL'].includes(d.indicators?.codigo?.toUpperCase() ?? '');
                        const valStr = isTime ? formatMinutesHHMM(d.valor) : String(d.valor);
                        const metaStr = d.meta != null ? (isTime ? formatMinutesHHMM(d.meta) : String(d.meta)) : '—';
                        return (
                          <div key={d.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                                  <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{d.indicators?.nome ?? ''}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {valStr} / {metaStr}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={cn(
                                  'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                  atingiu ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                                )}>
                                  {atingiu ? 'Atingiu ✓' : 'Não Atingiu ✗'}
                                </span>
                                {!atingiu && d.indicator_id && (() => {
                                  const existingCausa = causaLookup.get(`${d.indicator_id}|${d.data_referencia}`);
                                  if (existingCausa) {
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewCausa(existingCausa);
                                        }}
                                        className="h-7 px-2 rounded-lg bg-success/10 text-success text-[10px] font-bold flex items-center gap-1 hover:bg-success/20 transition-colors"
                                      >
                                        <CheckCircle className="h-3 w-3" />
                                        Reportado
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReportTarget({
                                          indicatorId: d.indicator_id,
                                          indicatorNome: d.indicators?.nome ?? '',
                                          dataReferencia: d.data_referencia,
                                        });
                                      }}
                                      className="h-7 px-2 rounded-lg bg-destructive/10 text-destructive text-[10px] font-bold flex items-center gap-1 hover:bg-destructive/20 transition-colors"
                                    >
                                      <AlertTriangle className="h-3 w-3" />
                                      Reportar
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Evolução ─────────────────────────────── */}
      <EvolutionCharts userId={user?.id} />


      {/* ── Planos de Ação ────────────────────────── */}
      {(recentPlanos.length > 0 || loadPlan) && (
        <section>
          <SectionHeader
            icon={<ClipboardList className="h-4 w-4 text-primary" />}
            title="Meus Planos"
            action={recentPlanos.length > 0 ? () => navigate('/colaborador/planos-de-acao') : undefined}
          />
          {loadPlan ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : (
            <div className="space-y-2.5">
              {recentPlanos.map(p => {
                const atrasado = p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status);
                const isOpen = p.status === 'aberto';
                const isInProgress = p.status === 'em_andamento';
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate('/colaborador/planos-de-acao')}
                    className={cn(
                      'rounded-xl border bg-card shadow-sm px-4 py-3 cursor-pointer active:scale-[0.98] transition-all',
                      atrasado && 'border-destructive/30'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        'h-2.5 w-2.5 rounded-full mt-1.5 shrink-0',
                        isOpen ? 'bg-primary' : isInProgress ? 'bg-warning' : 'bg-success'
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.descricao_acao}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <StatusBadge status={p.status} />
                          {atrasado && (
                            <span className="text-[9px] text-destructive font-bold uppercase tracking-wide bg-destructive/10 rounded-full px-2 py-0.5">
                              Atrasado
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {p.prazo && (
                          <span className={cn(
                            'text-[11px] font-medium',
                            atrasado ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {format(new Date(p.prazo + 'T00:00:00'), 'dd/MM')}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto mt-0.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="h-2" />

      {/* ── Report Sheet ─────────────────────────── */}
      {user?.id && reportTarget && (
        <ReportCausaRaizSheet
          open={!!reportTarget}
          onClose={() => setReportTarget(null)}
          userId={user.id}
          indicatorId={reportTarget.indicatorId}
          dataReferencia={reportTarget.dataReferencia}
          indicatorNome={reportTarget.indicatorNome}
        />
      )}

      {/* ── View Causa Raiz Sheet ─────────────────── */}
      {viewCausa && (
        <ViewCausaRaizSheet
          open={!!viewCausa}
          onClose={() => setViewCausa(null)}
          causa={viewCausa}
        />
      )}
    </div>
  );
}

/* ── Section Header helper ───────────────────────── */
function SectionHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        {icon} {title}
      </h2>
      {action && (
        <button onClick={action} className="text-xs font-semibold text-primary flex items-center gap-0.5">
          Ver todos <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
