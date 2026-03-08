import { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useFeedbacks, type FeedbackWithRelations } from '@/hooks/useFeedbacks';
import { usePlanosDeAcao, type ActionPlanWithRelations } from '@/hooks/usePlanosDeAcao';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { useIncentivoDiarioAdmin } from '@/hooks/useIncentivoDiario';
import { useUnidades } from '@/hooks/useUnidades';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, MessageSquare, ClipboardList, DollarSign, CalendarIcon, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '@/lib/utils';

function DatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full sm:w-44 justify-start text-left font-normal rounded-xl h-10', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Data'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-xl" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

const PIE_COLORS: Record<string, string> = {
  baixa: '#94a3b8', media: '#fbbf24', alta: '#f97316', critica: '#ef4444',
};

const kpiConfigs = [
  { key: 'users', icon: Users, bg: 'bg-primary-light', iconClass: 'text-primary' },
  { key: 'feedbacks', icon: MessageSquare, bg: 'bg-amber-50', iconClass: 'text-warning' },
  { key: 'plans', icon: ClipboardList, bg: 'bg-orange-50', iconClass: 'text-orange-500' },
  { key: 'incentive', icon: DollarSign, bg: 'bg-emerald-50', iconClass: 'text-emerald-600' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateFilter, setDateFilter] = useState(today);
  const [unidadeFilter, setUnidadeFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');

  const { data: usuarios = [] } = useUsuarios();
  const { data: feedbacks = [] } = useFeedbacks();
  const { data: planos = [] } = usePlanosDeAcao();
  const { data: desempenho = [] } = useDesempenhoDiario(dateFilter, {
    unidade_id: unidadeFilter || undefined,
    worker_type: tipoFilter || undefined,
  });
  const { data: incentivos = [] } = useIncentivoDiarioAdmin(dateFilter);
  const { data: units = [] } = useUnidades();

  const activeUsers = usuarios.filter(u => u.ativo && u.role === 'colaborador');
  const motoristas = activeUsers.filter(u => u.worker_type === 'motorista').length;
  const ajudantes = activeUsers.filter(u => u.worker_type === 'ajudante').length;

  const feedbacksAbertos = feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).length;
  const feedbacksCriticos = feedbacks.filter(f => f.urgencia === 'critica' && ['aberto', 'em_analise'].includes(f.status)).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const planosPendentes = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status)).length;
  const planosAtrasados = planos.filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status)).length;

  const incentivoMedio = useMemo(() => {
    if (!incentivos.length) return 0;
    const total = incentivos.reduce((s, i) => s + (i.valor_estimado ?? 0), 0);
    return Math.round(total / incentivos.length * 100) / 100;
  }, [incentivos]);

  const barData = useMemo(() => {
    const byInd: Record<string, { codigo: string; nome: string; vals: number[] }> = {};
    desempenho.forEach(d => {
      if (!byInd[d.indicator_id]) byInd[d.indicator_id] = { codigo: d.indicators?.codigo ?? '', nome: d.indicators?.nome ?? '', vals: [] };
      if (d.percentual_atingimento != null) byInd[d.indicator_id].vals.push(d.percentual_atingimento);
    });
    return Object.values(byInd).map(v => ({
      indicador: v.codigo,
      nome: v.nome,
      media: Math.round(v.vals.reduce((a, b) => a + b, 0) / v.vals.length * 10) / 10,
    }));
  }, [desempenho]);

  const pieData = useMemo(() => {
    const byUrg: Record<string, number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
    feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).forEach(f => { byUrg[f.urgencia] = (byUrg[f.urgencia] ?? 0) + 1; });
    return Object.entries(byUrg).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
  }, [feedbacks]);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const topCritical = useMemo(() => {
    const byInd: Record<string, { nome: string; vals: number[] }> = {};
    desempenho.forEach(d => {
      if (!byInd[d.indicator_id]) byInd[d.indicator_id] = { nome: d.indicators?.nome ?? '', vals: [] };
      if (d.percentual_atingimento != null) byInd[d.indicator_id].vals.push(d.percentual_atingimento);
    });
    return Object.values(byInd)
      .map(v => {
        const avg = v.vals.reduce((a, b) => a + b, 0) / v.vals.length;
        return { nome: v.nome, media: Math.round(avg * 10) / 10, meta: 100, gap: Math.round((avg - 100) * 10) / 10, afetados: v.vals.length };
      })
      .filter(v => v.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5);
  }, [desempenho]);

  const recentFeedbacks = useMemo(() =>
    feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).slice(0, 5),
  [feedbacks]);

  const latePlans = useMemo(() =>
    planos
      .filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status))
      .map(p => ({ ...p, diasAtraso: Math.ceil((Date.now() - new Date(p.prazo + 'T00:00:00').getTime()) / 86400000) }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 5),
  [planos, todayStr]);

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const kpiData = [
    { title: activeUsers.length.toString(), sub: `${motoristas} motoristas • ${ajudantes} ajudantes` },
    { title: feedbacksAbertos.toString(), sub: `${feedbacksCriticos} críticos` },
    { title: planosPendentes.toString(), sub: `${planosAtrasados} atrasados` },
    { title: fmtBRL(incentivoMedio), sub: 'Incentivo médio hoje' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <DatePick value={dateFilter} onChange={setDateFilter} />
        <Select value={unidadeFilter} onValueChange={v => setUnidadeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44 rounded-xl h-10"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent className="rounded-xl"><SelectItem value="all">Todas</SelectItem>{units.filter(u => u.ativo).map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-40 rounded-xl h-10"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="rounded-xl"><SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiConfigs.map((cfg, i) => (
          <div key={cfg.key} className="card-elevated p-4 flex items-center gap-4">
            <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', cfg.bg)}>
              <cfg.icon className={cn('h-5 w-5', cfg.iconClass)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tracking-tight">{kpiData[i].title}</p>
              <p className="text-xs text-muted-foreground">{kpiData[i].sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Desempenho por Indicador Hoje</h3>
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 20% 92%)" />
                <XAxis dataKey="indicador" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 120]} />
                <Tooltip formatter={(v: number, _n: string, p: any) => [`${v}%`, p.payload.nome]} contentStyle={{ borderRadius: 12, border: '1px solid hsl(214 20% 92%)' }} />
                <ReferenceLine y={90} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" label={{ value: '90%', position: 'right', fontSize: 10 }} />
                <ReferenceLine y={100} stroke="hsl(160, 84%, 39%)" strokeDasharray="5 5" label={{ value: '100%', position: 'right', fontSize: 10 }} />
                <Bar dataKey="media" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.media >= 100 ? '#22c55e' : entry.media >= 90 ? '#3b82f6' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-12 text-center">Nenhum dado de desempenho para esta data.</p>}
        </div>

        <div className="card-elevated p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">Feedbacks por Urgência</h3>
          </div>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#94a3b8'} />)}
                </Pie>
                <Legend />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xl font-bold">{pieTotal}</text>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-12 text-center">Nenhum feedback aberto.</p>}
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {topCritical.length > 0 && (
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Top Indicadores Críticos</h3>
              <button onClick={() => navigate('/admin/desempenho')} className="text-xs font-medium text-primary flex items-center gap-0.5">
                Ver todos <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/60 text-muted-foreground text-xs">
                  <th className="text-left p-2.5">Indicador</th><th className="text-right p-2.5">Média</th><th className="text-right p-2.5">Gap</th><th className="text-right p-2.5">Afetados</th>
                </tr></thead>
                <tbody>
                  {topCritical.map((c, i) => (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="p-2.5 font-medium text-foreground">{c.nome}</td>
                      <td className="p-2.5 text-right">{c.media}%</td>
                      <td className="p-2.5 text-right text-destructive font-semibold">{c.gap}%</td>
                      <td className="p-2.5 text-right">{c.afetados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Feedbacks Recentes</h3>
            <button onClick={() => navigate('/admin/feedbacks')} className="text-xs font-medium text-primary flex items-center gap-0.5">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {recentFeedbacks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/60 text-muted-foreground text-xs">
                  <th className="text-left p-2.5">Colaborador</th><th className="text-left p-2.5">Título</th><th className="text-left p-2.5">Urgência</th><th className="text-right p-2.5">Tempo</th>
                </tr></thead>
                <tbody>
                  {recentFeedbacks.map(f => (
                    <tr key={f.id} className={cn("border-b border-border/40 last:border-0", f.urgencia === 'critica' && 'bg-destructive/5')}>
                      <td className="p-2.5 font-medium text-foreground">{f.users?.nome ?? '—'}</td>
                      <td className="p-2.5 max-w-[140px] truncate">{f.titulo}</td>
                      <td className="p-2.5"><StatusBadge status={f.urgencia} /></td>
                      <td className="p-2.5 text-right text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground py-6 text-center">Nenhum feedback aberto.</p>}
        </div>
      </div>

      {/* Late Plans */}
      {latePlans.length > 0 && (
        <div className="card-elevated p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Planos Atrasados</h3>
            <button onClick={() => navigate('/admin/planos-de-acao')} className="text-xs font-medium text-primary flex items-center gap-0.5">
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/60 text-muted-foreground text-xs">
                <th className="text-left p-2.5">Responsável</th><th className="text-left p-2.5">Descrição</th><th className="text-left p-2.5">Prazo</th><th className="text-right p-2.5">Atraso</th>
              </tr></thead>
              <tbody>
                {latePlans.map(p => (
                  <tr key={p.id} className={cn("border-b border-border/40 last:border-0", p.diasAtraso > 3 && 'bg-destructive/5')}>
                    <td className="p-2.5 font-medium text-foreground">{p.users?.nome ?? '—'}</td>
                    <td className="p-2.5 max-w-[200px] truncate">{p.descricao_acao}</td>
                    <td className="p-2.5 text-muted-foreground">{p.prazo ? format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yy') : '—'}</td>
                    <td className="p-2.5 text-right text-destructive font-semibold">{p.diasAtraso}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
