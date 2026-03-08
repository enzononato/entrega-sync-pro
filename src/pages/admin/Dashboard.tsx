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
import { Users, MessageSquare, ClipboardList, DollarSign, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Legend } from 'recharts';
import { cn } from '@/lib/utils';

function DatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full sm:w-44 justify-start text-left font-normal', !value && 'text-muted-foreground')}>
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
  baixa: '#9ca3af', media: '#facc15', alta: '#fb923c', critica: '#ef4444',
};

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

  // Bar chart
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

  // Pie chart
  const pieData = useMemo(() => {
    const byUrg: Record<string, number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
    feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).forEach(f => { byUrg[f.urgencia] = (byUrg[f.urgencia] ?? 0) + 1; });
    return Object.entries(byUrg).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
  }, [feedbacks]);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  // Top critical indicators
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

  // Recent feedbacks
  const recentFeedbacks = useMemo(() =>
    feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).slice(0, 5),
  [feedbacks]);

  // Late plans
  const latePlans = useMemo(() =>
    planos
      .filter(p => p.prazo && p.prazo < todayStr && !['concluido', 'cancelado'].includes(p.status))
      .map(p => ({ ...p, diasAtraso: Math.ceil((Date.now() - new Date(p.prazo + 'T00:00:00').getTime()) / 86400000) }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 5),
  [planos, todayStr]);

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-wrap">
        <DatePick value={dateFilter} onChange={setDateFilter} />
        <Select value={unidadeFilter} onValueChange={v => setUnidadeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{units.filter(u => u.ativo).map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tipoFilter} onValueChange={v => setTipoFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="h-5 w-5 text-blue-600" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{activeUsers.length}</p>
            <p className="text-xs text-muted-foreground">{motoristas} motoristas • {ajudantes} ajudantes</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-orange-600" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{feedbacksAbertos}</p>
            <p className="text-xs text-muted-foreground">{feedbacksCriticos} críticos</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-amber-600" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{planosPendentes}</p>
            <p className="text-xs text-muted-foreground">{planosAtrasados} atrasados</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <p className="text-2xl font-bold text-foreground">{fmtBRL(incentivoMedio)}</p>
            <p className="text-xs text-muted-foreground">Incentivo médio hoje</p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Desempenho por Indicador Hoje</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="indicador" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 120]} />
                <Tooltip formatter={(v: number, _n: string, p: any) => [`${v}%`, p.payload.nome]} />
                <ReferenceLine y={90} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" label={{ value: '90%', position: 'right', fontSize: 10 }} />
                <ReferenceLine y={100} stroke="hsl(160, 84%, 39%)" strokeDasharray="5 5" label={{ value: '100%', position: 'right', fontSize: 10 }} />
                <Bar dataKey="media" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.media >= 100 ? '#22c55e' : entry.media >= 90 ? '#3b82f6' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-8 text-center">Nenhum dado de desempenho para esta data.</p>}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3">Feedbacks por Urgência</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry, i) => <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#9ca3af'} />)}
                </Pie>
                <Legend />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xl font-bold">{pieTotal}</text>
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground py-8 text-center">Nenhum feedback aberto.</p>}
        </div>
      </div>

      {/* Tables row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Critical Indicators */}
        {topCritical.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Top Indicadores Críticos</h3>
              <Button variant="link" size="sm" onClick={() => navigate('/admin/desempenho')}>Ver todos</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left p-2">Indicador</th><th className="text-right p-2">Média%</th><th className="text-right p-2">Meta%</th><th className="text-right p-2">Gap</th><th className="text-right p-2">Afetados</th>
                </tr></thead>
                <tbody>
                  {topCritical.map((c, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2 font-medium text-foreground">{c.nome}</td>
                      <td className="p-2 text-right">{c.media}%</td>
                      <td className="p-2 text-right">{c.meta}%</td>
                      <td className="p-2 text-right text-destructive font-medium">{c.gap}%</td>
                      <td className="p-2 text-right">{c.afetados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Feedbacks */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Feedbacks Recentes</h3>
            <Button variant="link" size="sm" onClick={() => navigate('/admin/feedbacks')}>Ver todos</Button>
          </div>
          {recentFeedbacks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left p-2">Colaborador</th><th className="text-left p-2">Título</th><th className="text-left p-2">Urgência</th><th className="text-left p-2">Status</th><th className="text-right p-2">Tempo</th>
                </tr></thead>
                <tbody>
                  {recentFeedbacks.map(f => (
                    <tr key={f.id} className={cn("border-b last:border-0", f.urgencia === 'critica' && 'bg-destructive/5')}>
                      <td className="p-2 font-medium text-foreground">{f.users?.nome ?? '—'}</td>
                      <td className="p-2 max-w-[140px] truncate">{f.titulo}</td>
                      <td className="p-2"><StatusBadge status={f.urgencia} /></td>
                      <td className="p-2"><StatusBadge status={f.status} /></td>
                      <td className="p-2 text-right text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted-foreground py-4 text-center">Nenhum feedback aberto.</p>}
        </div>
      </div>

      {/* Late Plans */}
      {latePlans.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Planos Atrasados</h3>
            <Button variant="link" size="sm" onClick={() => navigate('/admin/planos-de-acao')}>Ver todos</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-muted-foreground text-xs">
                <th className="text-left p-2">Responsável</th><th className="text-left p-2">Descrição</th><th className="text-left p-2">Prazo</th><th className="text-right p-2">Atraso</th>
              </tr></thead>
              <tbody>
                {latePlans.map(p => (
                  <tr key={p.id} className={cn("border-b last:border-0", p.diasAtraso > 3 && 'bg-destructive/5')}>
                    <td className="p-2 font-medium text-foreground">{p.users?.nome ?? '—'}</td>
                    <td className="p-2 max-w-[200px] truncate">{p.descricao_acao}</td>
                    <td className="p-2 text-muted-foreground">{p.prazo ? format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yy') : '—'}</td>
                    <td className="p-2 text-right text-destructive font-medium">{p.diasAtraso} dias</td>
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
