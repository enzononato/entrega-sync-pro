import { useState, useMemo } from 'react';
import { format, formatDistanceToNow, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useFeedbacks } from '@/hooks/useFeedbacks';
import { usePlanosDeAcao } from '@/hooks/usePlanosDeAcao';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiarioAdmin } from '@/hooks/useIncentivoDiario';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { useMetas } from '@/hooks/useMetas';

import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Users, MessageSquare, ClipboardList, DollarSign, CalendarIcon, TrendingUp,
  TrendingDown, AlertTriangle, ChevronRight, Target, BarChart3, Truck,
  UserCheck, Zap, Clock, ArrowUpRight, MapPin, Package,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

function DatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full sm:w-44 justify-start text-left font-normal h-9', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

const PIE_COLORS: Record<string, string> = {
  baixa: '#94a3b8', media: '#fbbf24', alta: '#f97316', critica: '#ef4444',
};
const PIE_LABELS: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateFilter, setDateFilter] = useState(today);
  const [unidadeFilter, setUnidadeFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  // Data sources
  const { data: usuarios = [] } = useUsuarios();
  const { data: feedbacks = [] } = useFeedbacks({ unidade_id: unidadeFilter || undefined });
  const { data: planos = [] } = usePlanosDeAcao();
  const { data: desempenho = [] } = useDesempenhoDiario(dateFilter, dateFilter, {
    unidade_id: unidadeFilter || undefined,
    worker_type: tipoFilter || undefined,
  });
  const { data: incentivos = [] } = useIncentivoDiarioAdmin(dateFilter);
  const { allowedUnits, allowedUnitIds } = useAllowedUnits();
  const { data: metasAtivas = [] } = useMetas({ ativo: 'true' });

  // Monthly bonus calculation
  const mesAtual = format(new Date(), 'yyyy-MM');
  const mesInicio = mesAtual + '-01';
  const mesFim = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const { data: desempenhoMes = [] } = useDesempenhoDiario(mesInicio, mesFim, {
    unidade_id: unidadeFilter || undefined,
    worker_type: tipoFilter || undefined,
  });

  const bonusMes = useMemo(() => {
    const goalsComBonus = metasAtivas.filter(m => m.valor_bonificacao > 0);
    if (goalsComBonus.length === 0 || desempenhoMes.length === 0) return 0;

    let total = 0;
    for (const d of desempenhoMes) {
      if (d.status !== 'dentro_meta' && d.status !== 'acima_meta') continue;
      // Find matching goal
      const user = usuarios.find(u => u.id === d.user_id);
      const goal = goalsComBonus.find(g => {
        if (g.indicator_id !== d.indicator_id) return false;
        if (g.user_id === d.user_id) return true;
        if (!g.user_id && g.worker_type === user?.worker_type) return true;
        if (!g.user_id && !g.worker_type) return true;
        return false;
      });
      if (goal) total += goal.valor_bonificacao;
    }
    return total;
  }, [metasAtivas, desempenhoMes, usuarios]);

  // Filter usuarios by unidade
  const filteredUsers = useMemo(() => {
    let list = usuarios.filter(u => u.ativo && u.role === 'colaborador');
    // Restrict to allowed units
    list = list.filter(u => !u.unidade_id || allowedUnitIds.has(u.unidade_id));
    if (unidadeFilter) list = list.filter(u => u.unidade_id === unidadeFilter);
    if (tipoFilter) list = list.filter(u => u.worker_type === tipoFilter);
    return list;
  }, [usuarios, unidadeFilter, tipoFilter, allowedUnitIds]);

  const filteredUserIds = useMemo(() => new Set(filteredUsers.map(u => u.id)), [filteredUsers]);

  const filteredDesempenho = desempenho;

  const filteredIncentivos = useMemo(() => {
    if (!unidadeFilter) return incentivos;
    return incentivos.filter(i => filteredUserIds.has(i.user_id));
  }, [incentivos, unidadeFilter, filteredUserIds]);

  const filteredFeedbacks = feedbacks;

  const filteredPlanos = useMemo(() => {
    if (!unidadeFilter) return planos;
    return planos.filter(p => filteredUserIds.has(p.responsavel_user_id));
  }, [planos, unidadeFilter, filteredUserIds]);

  // KPI calculations
  const motoristas = filteredUsers.filter(u => u.worker_type === 'motorista').length;
  const ajudantes = filteredUsers.filter(u => u.worker_type === 'ajudante').length;
  const distribuicao = filteredUsers.filter(u => u.worker_type === 'distribuicao').length;

  const feedbacksAbertos = filteredFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).length;
  const feedbacksCriticos = filteredFeedbacks.filter(f => f.urgencia === 'critica' && ['aberto', 'em_analise'].includes(f.status)).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const planosPendentes = filteredPlanos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const planosAtrasados = filteredPlanos.filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status)).length;

  const incentivoTotal = useMemo(() => filteredIncentivos.reduce((s, i) => s + (i.valor_estimado ?? 0), 0), [filteredIncentivos]);
  const incentivoMedio = filteredIncentivos.length ? Math.round(incentivoTotal / filteredIncentivos.length * 100) / 100 : 0;

  const dentroMeta = filteredDesempenho.filter(d => d.status === 'dentro_meta' || d.status === 'acima_meta').length;
  const abaixoMeta = filteredDesempenho.filter(d => d.status === 'abaixo_meta').length;
  const totalMetasDash = dentroMeta + abaixoMeta;
  const pctAtingidas = totalMetasDash > 0 ? Math.round((dentroMeta / totalMetasDash) * 100) : 0;

  const barData = useMemo(() => {
    const byInd: Record<string, { codigo: string; nome: string; total: number; atingiu: number }> = {};
    filteredDesempenho.forEach(d => {
      if (!byInd[d.indicator_id]) byInd[d.indicator_id] = { codigo: d.indicators?.codigo ?? '', nome: d.indicators?.nome ?? '', total: 0, atingiu: 0 };
      byInd[d.indicator_id].total++;
      if (d.status === 'dentro_meta' || d.status === 'acima_meta') byInd[d.indicator_id].atingiu++;
    });
    return Object.values(byInd).map(v => ({
      indicador: v.codigo, nome: v.nome,
      media: v.total > 0 ? Math.round((v.atingiu / v.total) * 100) : 0,
    })).sort((a, b) => a.media - b.media);
  }, [filteredDesempenho]);

  const pieData = useMemo(() => {
    const byUrg: Record<string, number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
    filteredFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).forEach(f => { byUrg[f.urgencia] = (byUrg[f.urgencia] ?? 0) + 1; });
    return Object.entries(byUrg).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, label: PIE_LABELS[k] ?? k, value: v }));
  }, [filteredFeedbacks]);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const topCritical = useMemo(() => {
    const byInd: Record<string, { nome: string; codigo: string; total: number; falhas: number }> = {};
    filteredDesempenho.forEach(d => {
      if (!byInd[d.indicator_id]) byInd[d.indicator_id] = { nome: d.indicators?.nome ?? '', codigo: d.indicators?.codigo ?? '', total: 0, falhas: 0 };
      byInd[d.indicator_id].total++;
      if (d.status === 'abaixo_meta') byInd[d.indicator_id].falhas++;
    });
    return Object.values(byInd)
      .map(v => ({
        nome: v.nome, codigo: v.codigo,
        media: v.total > 0 ? Math.round((1 - v.falhas / v.total) * 100) : 100,
        gap: v.total > 0 ? -Math.round((v.falhas / v.total) * 100) : 0,
        afetados: v.total,
      }))
      .filter(v => v.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5);
  }, [filteredDesempenho]);

  const recentFeedbacks = useMemo(() =>
    filteredFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).slice(0, 5),
  [filteredFeedbacks]);

  const latePlans = useMemo(() =>
    filteredPlanos
      .filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status))
      .map(p => ({ ...p, diasAtraso: Math.ceil((Date.now() - new Date(p.prazo + 'T00:00:00').getTime()) / 86400000) }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 5),
  [filteredPlanos, todayStr]);

  const getBarColor = (media: number) => {
    if (media >= 100) return 'hsl(160, 84%, 39%)';
    if (media >= 90) return 'hsl(217, 91%, 60%)';
    return 'hsl(0, 84%, 60%)';
  };

  const firstName = user?.nome?.split(' ')[0] ?? 'Admin';
  

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {getGreeting()}, {firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DatePick value={dateFilter} onChange={setDateFilter} />
          <Select value={unidadeFilter} onValueChange={v => { setUnidadeFilter(v === 'all' ? '' : v); }}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{allowedUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={v => setTipoFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem><SelectItem value="distribuicao">Distribuição</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {/* Active filters indicator */}
      {(unidadeFilter || tipoFilter || dateFilter !== today) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Filtros ativos:</span>
          {unidadeFilter && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{allowedUnits.find(u => u.id === unidadeFilter)?.nome}</span>}
          {tipoFilter && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">{tipoFilter === 'distribuicao' ? 'Distribuição' : tipoFilter}</span>}
          {dateFilter !== today && <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{format(new Date(dateFilter + 'T00:00:00'), 'dd/MM/yyyy')}</span>}
          <button onClick={() => { setUnidadeFilter(''); setTipoFilter(''); setDateFilter(today); }} className="text-destructive hover:underline ml-1">Limpar</button>
        </div>
      )}

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Colaboradores Ativos', value: filteredUsers.length, sub: `${motoristas} mot · ${ajudantes} aj · ${distribuicao} dist`, icon: Users, iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-l-blue-500', href: '/admin/colaboradores' },
          { label: 'Metas Atingidas', value: `${dentroMeta}/${totalMetasDash}`, sub: `${pctAtingidas}% atingidas · ${abaixoMeta} não atingiram`, icon: Target, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400', borderColor: 'border-l-emerald-500', href: '/admin/desempenho' },
          { label: 'Feedbacks Abertos', value: feedbacksAbertos, sub: feedbacksCriticos > 0 ? `⚠️ ${feedbacksCriticos} críticos` : 'Nenhum crítico', icon: MessageSquare, iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400', borderColor: 'border-l-amber-500', href: '/admin/feedbacks' },
          { label: 'Incentivo Médio', value: fmtBRL(incentivoMedio), sub: `Total: ${fmtBRL(incentivoTotal)}`, icon: DollarSign, iconBg: 'bg-green-100 dark:bg-green-900/30', iconColor: 'text-green-600 dark:text-green-400', borderColor: 'border-l-green-500', isText: true, href: '/admin/incentivos' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <button
              key={k.label}
              onClick={() => navigate(k.href)}
              className={cn(
                'rounded-xl border bg-card p-4 shadow-sm border-l-[3px] transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] text-left group cursor-pointer',
                k.borderColor
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', k.iconBg)}>
                  <Icon className={cn('h-5 w-5', k.iconColor)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-bold text-foreground leading-none', 'isText' in k ? 'text-lg' : 'text-2xl')}>{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{k.sub}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-wider">{k.label}</p>
            </button>
          );
        })}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Planos Pendentes', value: planosPendentes, icon: ClipboardList, color: 'text-blue-600 dark:text-blue-400', href: '/admin/planos-de-acao' },
          { label: 'Planos Atrasados', value: planosAtrasados, icon: Clock, color: 'text-destructive', href: '/admin/planos-de-acao' },
          { label: 'Motoristas', value: motoristas, icon: Truck, color: 'text-emerald-600 dark:text-emerald-400', href: '/admin/colaboradores' },
          { label: 'Ajudantes', value: ajudantes, icon: UserCheck, color: 'text-violet-600 dark:text-violet-400', href: '/admin/colaboradores' },
          { label: 'Distribuição', value: distribuicao, icon: Package, color: 'text-blue-600 dark:text-blue-400', href: '/admin/colaboradores' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => navigate(s.href)}
              className="rounded-xl border bg-card p-3 shadow-sm flex items-center gap-3 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all text-left group cursor-pointer"
            >
              <Icon className={cn('h-4 w-4 shrink-0 transition-transform group-hover:scale-110', s.color)} />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Desempenho por Indicador</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/desempenho')}>
              Ver tudo <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="indicador" tick={{ fontSize: 11 }} width={55} />
                <Tooltip formatter={(v: number, _n: string, p: any) => [`${v}% atingiram`, p.payload.nome]} contentStyle={{ borderRadius: 12, border: '1px solid hsl(214 20% 92%)' }} />
                <ReferenceLine x={90} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" />
                <ReferenceLine x={100} stroke="hsl(160, 84%, 39%)" strokeDasharray="5 5" />
                <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={18}>
                  {barData.map((entry, i) => <Cell key={i} fill={getBarColor(entry.media)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <BarChart3 className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sem dados para esta data</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Feedbacks por Urgência</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/feedbacks')}>
              Ver <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#94a3b8'} />)}
                  </Pie>
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-2xl font-bold">{pieTotal}</text>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[d.name] }} />
                    <span className="text-[11px] text-muted-foreground">{d.label} ({d.value})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum feedback aberto</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {topCritical.length > 0 && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <h3 className="text-sm font-bold text-foreground">Indicadores Críticos</h3>
              </div>
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/desempenho')}>
                Ver <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-3">
              {topCritical.map((c, i) => (
                <div key={i} onClick={() => navigate('/admin/desempenho')} className="flex items-center gap-3 cursor-pointer hover:bg-muted/30 rounded-lg p-1 -mx-1 transition-colors active:scale-[0.98]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono">{c.codigo}</span>
                      <span className="text-xs font-medium text-foreground truncate">{c.nome}</span>
                    </div>
                    <ProgressBar value={c.media} color="red" className="h-1.5" />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-destructive">{c.media}%</p>
                    <p className="text-[10px] text-muted-foreground">{c.afetados} col.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-foreground">Feedbacks Recentes</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/feedbacks')}>
              Ver <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {recentFeedbacks.length > 0 ? (
            <div className="space-y-3">
              {recentFeedbacks.map(f => (
                <div
                  key={f.id}
                  onClick={() => navigate('/admin/feedbacks')}
                  className={cn(
                    'rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm active:scale-[0.98]',
                    f.urgencia === 'critica' ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate max-w-[150px]">{f.users?.nome ?? '—'}</span>
                    <StatusBadge status={f.urgencia} />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{f.titulo}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <MessageSquare className="h-6 w-6 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum feedback aberto</p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-bold text-foreground">Planos Atrasados</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary" onClick={() => navigate('/admin/planos-de-acao')}>
              Ver <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
          {latePlans.length > 0 ? (
            <div className="space-y-3">
              {latePlans.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate('/admin/planos-de-acao')}
                  className={cn(
                    'rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm active:scale-[0.98]',
                    p.diasAtraso > 3 ? 'border-destructive/30 bg-destructive/5' : 'border-border/50 hover:border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate max-w-[150px]">{p.users?.nome ?? '—'}</span>
                    <span className="inline-flex items-center rounded-md bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-bold">
                      {p.diasAtraso}d atraso
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{p.descricao_acao}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Prazo: {p.prazo ? format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yy') : '—'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <Zap className="h-6 w-6 text-emerald-400 mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum plano atrasado 🎉</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
