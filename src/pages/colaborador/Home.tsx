import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiario } from '@/hooks/useIncentivoDiario';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { usePendingMandatoryFeedback } from '@/hooks/useMandatoryFeedback';
import { MandatoryFeedbackModal } from '@/components/colaborador/MandatoryFeedbackModal';
import { EvolutionCharts } from '@/components/colaborador/EvolutionCharts';
import { MiniRanking } from '@/components/colaborador/MiniRanking';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle, AlertCircle, DollarSign, ClipboardList,
  Trophy, ChevronRight, Zap, Flame, Target, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutesHHMM } from '@/lib/formatters';
import type { IndicatorStatus } from '@/types';

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

/* ── component ───────────────────────────────────── */
export default function ColaboradorHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: desempenho = [], isLoading: loadDes } = useDesempenhoDiario(today, today, { user_id: user?.id });
  const { data: incentivo } = useIncentivoDiario(user?.id, today);
  const { data: planos = [], isLoading: loadPlan } = usePlanosDoColaborador(user?.id);
  const { data: pendingFeedback = [] } = usePendingMandatoryFeedback(user?.id);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);

  const showMandatoryModal = pendingFeedback.length > 0 && !feedbackDismissed;

  const kpis = useMemo(() => desempenho.filter(d => {
    if (!user?.worker_type || !d.indicators) return true;
    const cat = d.indicators.codigo?.toLowerCase() ?? '';
    if (user.worker_type === 'motorista' && cat.includes('refugo')) return false;
    if (user.worker_type === 'ajudante' && cat.includes('repos')) return false;
    return true;
  }), [desempenho, user?.worker_type]);

  const okCount = kpis.filter(d => d.status === 'acima_meta' || d.status === 'dentro_meta').length;
  const badCount = kpis.filter(d => d.status === 'abaixo_meta').length;
  const allOnTarget = kpis.length > 0 && badCount === 0;
  const overallPct = kpis.length > 0
    ? Math.round((okCount / kpis.length) * 100)
    : 0;
  const acoesAbertas = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const recentPlanos = planos.slice(0, 3);

  const pctColor = overallPct >= 100 ? 'text-success' : overallPct >= 80 ? 'text-warning' : 'text-destructive';
  const ringColor = overallPct >= 100 ? 'border-success' : overallPct >= 80 ? 'border-warning' : 'border-destructive';

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

      {/* ── Hero Score ────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-5">
            {/* Ring progress */}
            <div className={cn(
              'relative h-[88px] w-[88px] rounded-full border-[6px] flex items-center justify-center shrink-0 transition-colors',
              ringColor
            )}>
              <div className="text-center">
                <span className="text-3xl font-extrabold text-white leading-none">{overallPct}</span>
                <span className="text-[10px] text-white/60 block -mt-0.5">%</span>
              </div>
              {allOnTarget && (
                <div className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-success flex items-center justify-center shadow-md">
                  <Flame className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-white">
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Desempenho Geral</p>
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

        {/* Quick stats */}
        <div className="grid grid-cols-3 divide-x divide-white/10 bg-white/[0.06] backdrop-blur-sm">
          <button onClick={() => navigate('/colaborador/indicadores')} className="py-3 text-center hover:bg-white/5 transition-colors">
            <CheckCircle className="h-3.5 w-3.5 text-success mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{okCount}</p>
            <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider">Na Meta</p>
          </button>
          <button onClick={() => navigate('/colaborador/incentivo')} className="py-3 text-center hover:bg-white/5 transition-colors">
            <DollarSign className="h-3.5 w-3.5 text-warning mx-auto mb-1" />
            <p className="text-sm font-bold text-white">{fmtBRL(incentivo?.valor_estimado ?? 0)}</p>
            <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider">Incentivo</p>
          </button>
          <button onClick={() => navigate('/colaborador/planos-de-acao')} className="py-3 text-center hover:bg-white/5 transition-colors">
            <ClipboardList className="h-3.5 w-3.5 text-secondary mx-auto mb-1" />
            <p className="text-lg font-bold text-white">{acoesAbertas}</p>
            <p className="text-[8px] text-white/50 font-medium uppercase tracking-wider">Ações</p>
          </button>
        </div>
      </div>

      {/* ── Success Banner ────────────────────────── */}
      {allOnTarget && (
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

      {/* ── KPIs do Dia ──────────────────────────── */}
      <section>
        <SectionHeader icon={<Zap className="h-4 w-4 text-primary" />} title="KPIs do Dia" action={() => navigate('/colaborador/indicadores')} />
        {loadDes ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
        ) : kpis.length === 0 ? (
          <div className="card-elevated p-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sem indicadores lançados hoje</p>
          </div>
        ) : (
          <div className="card-elevated divide-y divide-border/40 overflow-hidden">
            {kpis.map(d => {
              const status = d.status as IndicatorStatus | undefined;
              const isGood = status === 'acima_meta' || status === 'dentro_meta';
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors active:bg-muted/50"
                  onClick={() => navigate('/colaborador/indicadores')}
                >
                  <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', statusColor[status ?? ''] ?? 'bg-muted')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      {(() => {
                        const isTime = ['TML','TR','TI','JL'].includes(d.indicators?.codigo?.toUpperCase() ?? '');
                        const valStr = isTime ? formatMinutesHHMM(d.valor) : '';
                        const metaStr = d.meta != null && isTime ? formatMinutesHHMM(d.meta) : '';
                        return (
                          <span className="text-sm font-medium text-foreground truncate">
                            {d.indicators?.nome ?? ''}
                            {isTime && <span className="text-[10px] text-muted-foreground ml-1.5">{valStr} / {metaStr}</span>}
                          </span>
                        );
                      })()}
                      <span className={cn(
                        'text-[10px] font-bold ml-2 shrink-0 px-2 py-0.5 rounded-full',
                        isGood ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                      )}>
                        {isGood ? 'Atingiu ✓' : 'Não Atingiu ✗'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Evolução ─────────────────────────────── */}
      <EvolutionCharts userId={user?.id} />

      {/* ── Rankings ──────────────────────────────── */}
      <section>
        <SectionHeader icon={<Trophy className="h-4 w-4 text-warning" />} title="🚛 Ranking Motoristas" />
        <MiniRanking workerType="motorista" userId={user?.id} />
      </section>

      <section>
        <SectionHeader icon={<Trophy className="h-4 w-4 text-warning" />} title="📦 Ranking Ajudantes" />
        <MiniRanking workerType="ajudante" userId={user?.id} />
      </section>

      <div className="h-2" />

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
