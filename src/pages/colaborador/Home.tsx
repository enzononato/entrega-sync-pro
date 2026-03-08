import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiario } from '@/hooks/useIncentivoDiario';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { useMetas } from '@/hooks/useMetas';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, DollarSign, ClipboardList, AlertTriangle, MessageSquare, CalendarIcon, Trophy, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IndicatorStatus } from '@/types';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

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
  const acoesAbertas = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const recentPlanos = planos.slice(0, 3);

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const todayStr = new Date().toISOString().split('T')[0];

  const userMetas = useMemo(() => {
    if (!user) return [];
    return metas.filter(m => {
      if (m.user_id && m.user_id !== user.id) return false;
      if (m.worker_type && m.worker_type !== user.worker_type) return false;
      if (m.unidade_id && m.unidade_id !== user.unidade_id) return false;
      return true;
    });
  }, [metas, user]);

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Hero Header */}
      <div className="gradient-hero rounded-2xl p-5 text-white shadow-elevated -mx-4 -mt-4 mb-2">
        <h1 className="text-xl font-bold">
          {greeting()}, {user?.nome?.split(' ')[0]}! 👋
        </h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {user?.worker_type && (
            <span className={cn('inline-flex rounded-lg px-2.5 py-0.5 text-xs font-semibold',
              user.worker_type === 'motorista' ? 'bg-white/20' : 'bg-white/20'
            )}>{user.worker_type === 'motorista' ? '🚛 Motorista' : '📦 Ajudante'}</span>
          )}
          {user?.units && <span className="text-xs text-white/80">📍 {user.units.nome}</span>}
          {user?.routes && <span className="text-xs text-white/80">• 🛣️ {user.routes.nome}</span>}
        </div>
        <p className="text-xs text-white/60 mt-2">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>

      {/* Mini KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: CheckCircle, iconClass: 'text-emerald-500', bg: 'bg-emerald-50', value: okCount, label: 'Indicadores OK' },
          { icon: AlertCircle, iconClass: 'text-destructive', bg: 'bg-red-50', value: badCount, label: 'Fora da Meta' },
          { icon: DollarSign, iconClass: 'text-primary', bg: 'bg-primary-light', value: fmtBRL(incentivo?.valor_estimado ?? 0), label: 'Incentivo Hoje' },
          { icon: ClipboardList, iconClass: 'text-warning', bg: 'bg-amber-50', value: acoesAbertas, label: 'Ações Abertas' },
        ].map((item, i) => (
          <div key={i} className="card-elevated p-3.5 flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center shrink-0', item.bg)}>
              <item.icon className={cn('h-4.5 w-4.5', item.iconClass)} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground leading-tight">{item.value}</p>
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Success Banner */}
      {allOnTarget && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 p-4 shadow-sm flex items-center gap-3 text-white">
          <Trophy className="h-6 w-6 shrink-0" />
          <p className="text-sm font-semibold">Parabéns! Você atingiu todas as metas hoje! 🎉</p>
        </div>
      )}

      {/* Metas Vigentes */}
      {userMetas.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-foreground mb-3">Suas Metas Vigentes</h2>
          <div className="card-elevated p-4 space-y-3">
            {userMetas.map(m => (
              <div key={m.id} className="flex items-center justify-between text-sm border-b border-border/40 pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{m.indicators?.nome ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{m.periodo_tipo}</p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0 ml-2">
                  {m.valor_meta} {m.indicators?.unidade_medida ?? ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* KPIs de Hoje */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Meus KPIs de Hoje</h2>
        {loadDes ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : kpis.length === 0 ? (
          <EmptyState titulo="Sem indicadores lançados hoje" icon={<AlertCircle className="h-10 w-10" />} />
        ) : (
          <div className="space-y-3">
            {kpis.map(d => (
              <KpiCard
                key={d.id}
                titulo={d.indicators?.nome ?? ''}
                valor={d.valor}
                meta={d.meta ?? undefined}
                percentual={d.percentual_atingimento ?? undefined}
                status={d.status as IndicatorStatus | undefined}
                unidade={d.indicators?.unidade_medida}
              />
            ))}
          </div>
        )}
      </section>

      {/* Ações Rápidas */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Ações Rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/colaborador/causa-raiz')} className="card-elevated p-4 flex flex-col items-center gap-2 hover:shadow-card-hover active:scale-[0.98] transition-all">
            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <span className="text-xs font-medium text-foreground">Registrar Problema</span>
          </button>
          <button onClick={() => navigate('/colaborador/feedbacks')} className="card-elevated p-4 flex flex-col items-center gap-2 hover:shadow-card-hover active:scale-[0.98] transition-all">
            <div className="h-10 w-10 rounded-xl bg-primary-light flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">Enviar Feedback</span>
          </button>
        </div>
      </section>

      {/* Últimos Planos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Meus Últimos Planos</h2>
          {recentPlanos.length > 0 && (
            <button onClick={() => navigate('/colaborador/planos-de-acao')} className="text-xs font-medium text-primary flex items-center gap-0.5">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
        {loadPlan ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : recentPlanos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum plano de ação.</p>
        ) : (
          <div className="space-y-2">
            {recentPlanos.map(p => {
              const atrasado = p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status);
              return (
                <div key={p.id} className="card-elevated p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate font-medium">{p.descricao_acao}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={p.status} />
                      {atrasado && <span className="text-[10px] text-destructive font-bold uppercase tracking-wide">Atrasado</span>}
                    </div>
                  </div>
                  {p.prazo && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 shrink-0">
                      <CalendarIcon className="h-3 w-3" />{format(new Date(p.prazo + 'T00:00:00'), 'dd/MM')}
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
