import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiario } from '@/hooks/useIncentivoDiario';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { KpiCard } from '@/components/shared/KpiCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, DollarSign, ClipboardList, AlertTriangle, MessageSquare, CalendarIcon, Clock, Loader2 } from 'lucide-react';
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
  const { data: incentivo, isLoading: loadInc } = useIncentivoDiario(user?.id, today);
  const { data: planos = [], isLoading: loadPlan } = usePlanosDoColaborador(user?.id);

  const kpis = useMemo(() => desempenho.filter(d => {
    if (!user?.worker_type || !d.indicators) return true;
    const cat = d.indicators.codigo?.toLowerCase() ?? '';
    if (user.worker_type === 'motorista' && cat.includes('refugo')) return false;
    if (user.worker_type === 'ajudante' && cat.includes('repos')) return false;
    return true;
  }), [desempenho, user?.worker_type]);

  const okCount = kpis.filter(d => d.status === 'acima_meta' || d.status === 'dentro_meta').length;
  const badCount = kpis.filter(d => d.status === 'abaixo_meta').length;
  const acoesAbertas = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const recentPlanos = planos.slice(0, 3);

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {greeting()}, {user?.nome?.split(' ')[0]}!
        </h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {user?.worker_type && (
            <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
              user.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
            )}>{user.worker_type === 'motorista' ? 'Motorista' : 'Ajudante'}</span>
          )}
          {user?.units && <span className="text-xs text-muted-foreground">Unidade: {user.units.nome}</span>}
          {user?.routes && <span className="text-xs text-muted-foreground">• Rota: {user.routes.nome}</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Mini cards 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
          <div><p className="text-lg font-bold text-foreground">{okCount}</p><p className="text-[11px] text-muted-foreground">Indicadores OK</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div><p className="text-lg font-bold text-foreground">{badCount}</p><p className="text-[11px] text-muted-foreground">Fora da Meta</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-blue-500 shrink-0" />
          <div><p className="text-lg font-bold text-foreground">{fmtBRL(incentivo?.valor_estimado ?? 0)}</p><p className="text-[11px] text-muted-foreground">Incentivo Hoje</p></div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center gap-3">
          <ClipboardList className="h-5 w-5 text-amber-500 shrink-0" />
          <div><p className="text-lg font-bold text-foreground">{acoesAbertas}</p><p className="text-[11px] text-muted-foreground">Ações Abertas</p></div>
        </div>
      </div>

      {/* KPIs de Hoje */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Meus KPIs de Hoje</h2>
        {loadDes ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
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
      </div>

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Ações Rápidas</h2>
        <div className="space-y-2">
          <Button className="w-full justify-start gap-2" onClick={() => navigate('/colaborador/causa-raiz')}>
            <AlertTriangle className="h-4 w-4" />Registrar Problema
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate('/colaborador/feedbacks')}>
            <MessageSquare className="h-4 w-4" />Enviar Feedback
          </Button>
        </div>
      </div>

      {/* Últimos Planos */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Meus Últimos Planos</h2>
        {loadPlan ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : recentPlanos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum plano de ação.</p>
        ) : (
          <div className="space-y-2">
            {recentPlanos.map(p => {
              const atrasado = p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status);
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{p.descricao_acao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StatusBadge status={p.status} />
                      {atrasado && <span className="text-[10px] text-destructive font-semibold">ATRASADO</span>}
                    </div>
                  </div>
                  {p.prazo && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />{format(new Date(p.prazo + 'T00:00:00'), 'dd/MM')}
                    </span>
                  )}
                </div>
              );
            })}
            <Button variant="link" size="sm" className="w-full" onClick={() => navigate('/colaborador/planos-de-acao')}>
              Ver todos os planos
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
