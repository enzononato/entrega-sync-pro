import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiario } from '@/hooks/useIncentivoDiario';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { useMetas } from '@/hooks/useMetas';
import { usePendingMandatoryFeedback } from '@/hooks/useMandatoryFeedback';
import { MandatoryFeedbackModal } from '@/components/colaborador/MandatoryFeedbackModal';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle, AlertCircle, DollarSign, ClipboardList,
  Trophy, ChevronRight, Zap, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IndicatorStatus } from '@/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusColor: Record<string, string> = {
  acima_meta: 'bg-success',
  dentro_meta: 'bg-success',
  abaixo_meta: 'bg-destructive',
};

export default function ColaboradorHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: desempenho = [], isLoading: loadDes } = useDesempenhoDiario(today, { user_id: user?.id });
  const { data: incentivo } = useIncentivoDiario(user?.id, today);
  const { data: planos = [], isLoading: loadPlan } = usePlanosDoColaborador(user?.id);
  const { data: metas = [] } = useMetas({ vigentes: true, worker_type: user?.worker_type ?? undefined });

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
    ? Math.round(kpis.reduce((s, d) => s + (d.percentual_atingimento ?? 0), 0) / kpis.length)
    : 0;
  const acoesAbertas = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;

  const userMetas = useMemo(() => {
    if (!user) return [];
    return metas.filter(m => {
      if (m.user_id && m.user_id !== user.id) return false;
      if (m.worker_type && m.worker_type !== user.worker_type) return false;
      if (m.unidade_id && m.unidade_id !== user.unidade_id) return false;
      return true;
    });
  }, [metas, user]);

  const todayStr = new Date().toISOString().split('T')[0];
  const recentPlanos = planos.slice(0, 3);

  return (
    <div className="space-y-5 stagger-children">
      {/* Greeting + Date */}
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

      {/* Main performance hero card */}
      <div className="rounded-2xl overflow-hidden shadow-lg">
        <div className="gradient-hero p-5">
          <div className="flex items-center gap-5">
            <CircularProgress value={overallPct} size={90} strokeWidth={7}>
              <div className="text-center">
                <span className="text-2xl font-bold text-white">{overallPct}%</span>
              </div>
            </CircularProgress>
            <div className="flex-1 min-w-0 text-white">
              <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Desempenho Geral</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-3xl font-bold">{okCount}</span>
                <span className="text-sm text-white/70">/{kpis.length} na meta</span>
              </div>
              {user?.routes && (
                <p className="text-xs text-white/50 mt-1.5">🛣️ {user.routes.nome}</p>
              )}
            </div>
          </div>
        </div>
        {/* Quick stats strip */}
        <div className="grid grid-cols-3 divide-x divide-border/40 bg-card">
          <button onClick={() => navigate('/colaborador/indicadores')} className="p-3 text-center hover:bg-muted/30 transition-colors">
            <CheckCircle className="h-4 w-4 text-success mx-auto mb-0.5" />
            <p className="text-lg font-bold text-foreground">{okCount}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Na Meta</p>
          </button>
          <button onClick={() => navigate('/colaborador/incentivo')} className="p-3 text-center hover:bg-muted/30 transition-colors">
            <DollarSign className="h-4 w-4 text-primary mx-auto mb-0.5" />
            <p className="text-sm font-bold text-foreground">{fmtBRL(incentivo?.valor_estimado ?? 0)}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Incentivo</p>
          </button>
          <button onClick={() => navigate('/colaborador/planos-de-acao')} className="p-3 text-center hover:bg-muted/30 transition-colors">
            <ClipboardList className="h-4 w-4 text-warning mx-auto mb-0.5" />
            <p className="text-lg font-bold text-foreground">{acoesAbertas}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Ações</p>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {allOnTarget && (
        <div className="rounded-2xl gradient-hero p-4 shadow-md flex items-center gap-3 text-white animate-fade-up">
          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold">Parabéns! Todas as metas atingidas! 🎉</p>
            <p className="text-xs text-white/70 mt-0.5">Continue assim para maximizar seu incentivo</p>
          </div>
        </div>
      )}

      {/* KPIs do Dia */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" /> KPIs do Dia
          </h2>
          <button onClick={() => navigate('/colaborador/indicadores')} className="text-xs font-semibold text-primary flex items-center gap-0.5">
            Ver todos <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        {loadDes ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : kpis.length === 0 ? (
          <EmptyState titulo="Sem indicadores lançados hoje" icon={<AlertCircle className="h-10 w-10" />} />
        ) : (
          <div className="card-elevated divide-y divide-border/40 overflow-hidden">
            {kpis.map(d => {
              const pct = d.percentual_atingimento ?? 0;
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
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-foreground truncate">{d.indicators?.nome ?? ''}</span>
                      <span className={cn(
                        'text-sm font-bold ml-2 shrink-0',
                        isGood ? 'text-success' : 'text-destructive'
                      )}>{pct.toFixed(0)}%</span>
                    </div>
                    <ProgressBar
                      value={pct}
                      color={isGood ? 'green' : 'red'}
                      className="h-1.5"
                    />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Metas Vigentes */}
      {userMetas.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" /> Suas Metas
          </h2>
          <div className="card-elevated divide-y divide-border/40 overflow-hidden">
            {userMetas.map(m => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.indicators?.nome ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{m.periodo_tipo}</p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0 ml-2">
                  {m.valor_meta} {m.indicators?.unidade_medida ?? ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Últimos Planos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-warning" /> Meus Planos
          </h2>
          {recentPlanos.length > 0 && (
            <button onClick={() => navigate('/colaborador/planos-de-acao')} className="text-xs font-semibold text-primary flex items-center gap-0.5">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {loadPlan ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : recentPlanos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano de ação.</p>
        ) : (
          <div className="card-elevated divide-y divide-border/40 overflow-hidden">
            {recentPlanos.map(p => {
              const atrasado = p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status);
              return (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate font-medium">{p.descricao_acao}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={p.status} />
                      {atrasado && <span className="text-[10px] text-destructive font-bold uppercase tracking-wide">Atrasado</span>}
                    </div>
                  </div>
                  {p.prazo && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {format(new Date(p.prazo + 'T00:00:00'), 'dd/MM')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
