import { useState, useMemo } from 'react';
import { exportToCsv } from '@/lib/exportCsv';
import { supabase } from '@/integrations/supabase/client';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { useDesempenhoDiario, type DesempenhoRow } from '@/hooks/useDesempenho';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useMetas } from '@/hooks/useMetas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePick } from '@/components/shared/DateRangePick';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Target, TrendingUp, TrendingDown, AlertTriangle,
  Loader2, BarChart3,
  ChevronDown, Download, MapPin, Calculator,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatMinutesHHMM } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { compareIndicators } from '@/lib/indicatorOrder';

export default function Desempenho() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');

  const { data: desempenho = [], isLoading } = useDesempenhoDiario(dateStart, dateEnd, {
    unidade_id: filters.unidade_id,
    worker_type: activeTab !== 'todos' ? activeTab : filters.worker_type,
    user_id: filters.user_id,
    indicator_id: filters.indicator_id,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { allowedUnits } = useAllowedUnits();
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const { data: metas = [] } = useMetas({ vigentes: true });

  const [detailRow, setDetailRow] = useState<DesempenhoRow | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [calcLoading, setCalcLoading] = useState(false);
  const { toast } = useToast();

  const handleCalcMonthlyBonus = async () => {
    setCalcLoading(true);
    try {
      const month = format(new Date(), 'yyyy-MM');
      const { data, error } = await supabase.functions.invoke('calculate-monthly-bonus', {
        body: { month },
      });
      if (error) throw error;
      toast({ title: 'Bônus mensal calculado!', description: `${data?.total_users ?? 0} colaboradores processados` });
    } catch (e: any) {
      toast({ title: 'Erro ao calcular bônus', description: e.message, variant: 'destructive' });
    } finally {
      setCalcLoading(false);
    }
  };

  const activeUnits = allowedUnits;
  const colabs = usuarios.filter(u => u.role === 'colaborador');

  const MAPA_INDICATORS_MOT = ['TML', 'TR', 'TI', 'JL', 'TX_DEVOLUCAO', 'DISP_TEMPO'];
  const MAPA_INDICATORS_AJU = ['TML', 'TR', 'TI', 'JL', 'TX_DEVOLUCAO'];

  const indicatorByCode = useMemo(() => {
    const m = new Map<string, { id: string; nome: string; codigo: string }>();
    for (const ind of indicators) m.set(ind.codigo.toUpperCase(), { id: ind.id, nome: ind.nome, codigo: ind.codigo });
    return m;
  }, [indicators]);

  const metaLookup = useMemo(() => {
    const m = new Map<string, { meta: number; desafio: number }>();
    for (const g of metas) {
      const code = (g as any).indicators?.codigo?.toUpperCase();
      if (!code) continue;
      const wt = g.worker_type || 'default';
      const config = {
        meta: Number(g.valor_meta) || 0,
        desafio: Number(g.valor_desafio) || 0,
      };
      m.set(`${code}|${wt}`, config);
      if (!m.has(`${code}|default`)) m.set(`${code}|default`, config);
    }
    return m;
  }, [metas]);

  const getMetaConfig = (code: string, wt: string) => {
    return metaLookup.get(`${code}|${wt}`) ?? metaLookup.get(`${code}|default`) ?? { meta: 0, desafio: 0 };
  };

  const groupedByUser = useMemo(() => {
    const map = new Map<string, { user: DesempenhoRow['users']; userId: string; mapas: Map<string, DesempenhoRow[]> }>();
    const uniqueDesempenho = Array.from(new Map(desempenho.map(row => [row.id, row])).values());

    for (const d of uniqueDesempenho) {
      if (!map.has(d.user_id)) {
        map.set(d.user_id, { user: d.users, userId: d.user_id, mapas: new Map() });
      }
      const entry = map.get(d.user_id)!;
      const mapaKey = d.mapa_numero ?? 'manual';
      if (!entry.mapas.has(mapaKey)) entry.mapas.set(mapaKey, []);
      entry.mapas.get(mapaKey)!.push(d);
    }

    for (const entry of map.values()) {
      const wt = entry.user?.worker_type ?? 'motorista';
      const expectedCodes = wt === 'ajudante' ? MAPA_INDICATORS_AJU : MAPA_INDICATORS_MOT;

      for (const [mapaKey, rows] of entry.mapas) {
        if (mapaKey !== 'manual') {
          const presentCodes = new Set(rows.map(r => r.indicators?.codigo?.toUpperCase()));
          for (const code of expectedCodes) {
            if (presentCodes.has(code)) continue;
            const ind = indicatorByCode.get(code);
            if (!ind) continue;
            const metaConfig = getMetaConfig(code, wt);
            rows.push({
              id: `placeholder-${entry.userId}-${mapaKey}-${code}`,
              user_id: entry.userId,
              indicator_id: ind.id,
              data_referencia: rows[0]?.data_referencia ?? '',
              valor: 0,
              meta: metaConfig.meta,
              desafio: metaConfig.desafio,
              percentual_atingimento: metaConfig.meta === 0 ? 100 : 0,
              status: metaConfig.meta === 0 ? 'dentro_meta' : 'sem_dados',
              status_desafio: metaConfig.desafio > 0 ? 'nao_atingiu' : 'sem_desafio',
              origem_dado: 'mapa_historico',
              created_at: '',
              updated_at: '',
              mapa_numero: mapaKey,
              users: entry.user,
              indicators: { nome: ind.nome, codigo: ind.codigo },
            } as DesempenhoRow);
          }
        }

        const dedupedRows = Array.from(
          rows.reduce((acc, row) => {
            const dedupeKey = `${row.data_referencia}|${row.mapa_numero ?? 'manual'}|${row.indicators?.codigo?.toUpperCase() ?? row.indicator_id}`;
            const existing = acc.get(dedupeKey);

            if (!existing || (existing.status === 'sem_dados' && row.status !== 'sem_dados')) {
              acc.set(dedupeKey, row);
            }

            return acc;
          }, new Map<string, DesempenhoRow>()).values()
        );

        dedupedRows.sort(compareIndicators(r => r.indicators?.codigo));
        entry.mapas.set(mapaKey, dedupedRows);
      }
    }

    return Array.from(map.values()).sort((a, b) => (a.user?.nome ?? '').localeCompare(b.user?.nome ?? ''));
  }, [desempenho, indicatorByCode, metaLookup]);

  const toggleUser = (uid: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const pg = usePagination(groupedByUser);

  const realDesempenho = desempenho.filter(d => d.status !== 'sem_dados');
  const dentroMeta = realDesempenho.filter(d => d.status === 'dentro_meta' || d.status === 'acima_meta').length;
  const abaixoMeta = realDesempenho.filter(d => d.status === 'abaixo_meta').length;
  const totalMetas = dentroMeta + abaixoMeta;
  const pctAtingidas = totalMetas > 0 ? Math.round((dentroMeta / totalMetas) * 100) : 0;

  const piorIndicador = useMemo(() => {
    if (!realDesempenho.length) return null;
    const byInd: Record<string, { nome: string; total: number; falhas: number }> = {};
    realDesempenho.forEach(d => {
      const key = d.indicator_id;
      if (!byInd[key]) byInd[key] = { nome: d.indicators?.nome ?? '', total: 0, falhas: 0 };
      byInd[key].total++;
      if (d.status === 'abaixo_meta') byInd[key].falhas++;
    });
    let worst = { nome: '', taxaFalha: -1 };
    Object.values(byInd).forEach(v => {
      const taxa = v.falhas / v.total;
      if (taxa > worst.taxaFalha) worst = { nome: v.nome, taxaFalha: taxa };
    });
    return worst.taxaFalha > 0 ? worst : null;
  }, [realDesempenho]);

  const chartData = useMemo(() => {
    const byInd: Record<string, { nome: string; total: number; atingiu: number }> = {};
    realDesempenho.forEach(d => {
      const key = d.indicator_id;
      if (!byInd[key]) byInd[key] = { nome: d.indicators?.codigo ?? '', total: 0, atingiu: 0 };
      byInd[key].total++;
      if (d.status === 'dentro_meta' || d.status === 'acima_meta') byInd[key].atingiu++;
    });
    return Object.values(byInd).map(v => {
      const media = v.total > 0 ? Math.round((v.atingiu / v.total) * 100) : 0;
      return { indicador: v.nome, media };
    }).sort((a, b) => a.media - b.media);
  }, [realDesempenho]);

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const getBarColor = (media: number) => {
    if (media >= 100) return 'hsl(160, 84%, 39%)';
    if (media >= 90) return 'hsl(217, 91%, 60%)';
    return 'hsl(0, 84%, 60%)';
  };

  const kpis = [
    { label: 'Metas Atingidas', value: `${dentroMeta}/${totalMetas}`, icon: Target, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: '% Atingimento', value: `${pctAtingidas}%`, icon: TrendingUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Atingiu', value: dentroMeta, icon: BarChart3, iconBg: 'bg-sky-100', iconColor: 'text-sky-600', borderColor: 'border-l-sky-500' },
    { label: 'Não Atingiu', value: abaixoMeta, icon: TrendingDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
  ];

  const isTimeIndicator = (code: string | undefined) => ['TML', 'TR', 'TI', 'JL'].includes(code?.toUpperCase() ?? '');
  const isPercentIndicator = (code: string | undefined) => ['DISP_TEMPO'].includes(code?.toUpperCase() ?? '');
  const formatVal = (val: number, code: string | undefined) => {
    if (isTimeIndicator(code)) return formatMinutesHHMM(val);
    if (isPercentIndicator(code)) return `${val}%`;
    return String(val);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PageHeader
          title="Desempenho Operacional"
          subtitle={dateStart === dateEnd
            ? `Data: ${format(new Date(dateStart + 'T00:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`
            : `Período: ${format(new Date(dateStart + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} — ${format(new Date(dateEnd + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`
          }
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={handleCalcMonthlyBonus} disabled={calcLoading}>
            {calcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Calcular Bônus Mensal
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => {
            const rows = desempenho.map(d => [
              d.users?.nome ?? '',
              d.indicators?.codigo ?? '',
              d.indicators?.nome ?? '',
              d.valor,
              d.meta ?? '',
              d.desafio ?? '',
              d.percentual_atingimento != null ? `${d.percentual_atingimento}%` : '',
              d.status ?? '',
              d.status_desafio ?? '',
              d.data_referencia,
            ]);
            exportToCsv(
              `desempenho-${dateStart}_${dateEnd}.csv`,
              ['Colaborador', 'Código', 'Indicador', 'Valor', 'Meta', 'Desafio', '% Ating.', 'Status Meta', 'Status Desafio', 'Data'],
              rows,
            );
          }}>
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={cn('rounded-xl border bg-card p-4 shadow-sm border-l-[3px] transition-all hover:shadow-md', k.borderColor)}>
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', k.iconBg)}>
                  <Icon className={cn('h-5 w-5', k.iconColor)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {piorIndicador && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Indicador com mais falhas: <strong>{piorIndicador.nome}</strong> — {Math.round(piorIndicador.taxaFalha * 100)}% não atingiram
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); pg.resetPage(); }}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="motorista" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Motoristas
            </TabsTrigger>
            <TabsTrigger value="ajudante" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Ajudantes
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <DateRangePick
            from={dateStart}
            to={dateEnd}
            onChangeFrom={v => { setDateStart(v); pg.resetPage(); }}
            onChangeTo={v => { setDateEnd(v); pg.resetPage(); }}
            className="w-full sm:w-56"
          />
          <Select value={filters.unidade_id ?? ''} onValueChange={v => { setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v })); pg.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.user_id ?? ''} onValueChange={v => { setFilters(f => ({ ...f, user_id: v === 'all' ? '' : v })); pg.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Colaborador" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.indicator_id ?? ''} onValueChange={v => { setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v })); pg.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Indicador" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">% de Metas Atingidas por Indicador</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="indicador" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number) => `${v}% atingiram`} />
              <ReferenceLine x={90} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" />
              <ReferenceLine x={100} stroke="hsl(160, 84%, 39%)" strokeDasharray="5 5" />
              <Bar dataKey="media" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={getBarColor(entry.media)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : groupedByUser.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum lançamento encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Selecione outra data ou faça um lançamento</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {pg.paginatedItems.map(group => {
              const isMot = group.user?.worker_type === 'motorista';
              const allRows = Array.from(group.mapas.values()).flat();
              const realRows = allRows.filter(r => r.status !== 'sem_dados');
              const metasAtingidas = realRows.filter(r => r.status === 'dentro_meta' || r.status === 'acima_meta').length;
              const totalMetasUser = realRows.length;
              const isExpanded = expandedUsers.has(group.userId);

              return (
                <div key={group.userId} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleUser(group.userId)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className={cn('text-xs font-bold', isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700')}>
                        {getInitials(group.user?.nome ?? '')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">{group.user?.nome}</span>
                        <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700')}>
                          {isMot ? 'Motorista' : 'Ajudante'}
                        </span>
                        {group.user?.matricula && (
                          <span className="text-[10px] text-muted-foreground font-mono">Mat: {group.user.matricula}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">{group.mapas.size} mapa{group.mapas.size > 1 ? 's' : ''}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className={cn('text-xs font-bold', metasAtingidas === totalMetasUser ? 'text-emerald-600' : 'text-red-600')}>
                          {metasAtingidas}/{totalMetasUser} metas atingidas
                        </span>
                      </div>
                    </div>
                    <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border/50">
                      {Array.from(group.mapas.entries()).map(([mapaNum, rows]) => (
                        <div key={mapaNum} className="border-b border-border/30 last:border-b-0">
                          <div className="flex items-center gap-2 px-5 py-2.5 bg-muted/30">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-bold text-foreground">
                              {mapaNum === 'manual' ? 'Lançamento Manual' : `Mapa ${mapaNum}`}
                            </span>
                          </div>
                          <div className="divide-y divide-border/30">
                            {rows.map(d => {
                              const code = d.indicators?.codigo?.toUpperCase();
                              const isPct = isPercentIndicator(code);
                              const isTime = isTimeIndicator(code);
                              const valStr = isPct ? `${d.valor}%` : isTime ? formatMinutesHHMM(d.valor) : String(d.valor);
                              const metaStr = d.meta != null ? (isPct ? `${d.meta}%` : isTime ? formatMinutesHHMM(d.meta) : String(d.meta)) : '—';
                              const wt = group.user?.worker_type ?? 'motorista';
                              const goalDesafio = code ? getMetaConfig(code, wt).desafio : 0;
                              const desafioVal = Number(d.desafio ?? 0) > 0 ? Number(d.desafio) : goalDesafio;
                              const desafioAtivo = desafioVal > 0;
                              const desafioStr = desafioAtivo ? formatVal(desafioVal, code) : null;
                              const atingiuDesafioFromGoal = desafioAtivo && d.valor <= desafioVal;
                              const isSemDados = d.status === 'sem_dados';
                              const atingiu = d.status === 'dentro_meta' || d.status === 'acima_meta';
                              const atingiuDesafio = d.status_desafio === 'atingiu';

                              return (
                                <button
                                  key={d.id}
                                  onClick={() => !isSemDados && setDetailRow(d)}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-5 py-2.5 pl-10 transition-colors text-left',
                                    isSemDados ? 'opacity-50 cursor-default' : 'hover:bg-muted/20 cursor-pointer'
                                  )}
                                >
                                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-mono shrink-0">
                                    {d.indicators?.codigo}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                                      {d.indicators?.nome}
                                    </span>
                                    {desafioAtivo && (
                                      <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                                        🎯 Desafio: {desafioStr}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 ml-auto shrink-0 flex-wrap justify-end">
                                    <span className="text-xs text-muted-foreground">
                                      <strong className="text-foreground">{valStr}</strong> / {metaStr}
                                    </span>
                                    {isSemDados ? (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                        Sem dados
                                      </span>
                                    ) : (
                                      <>
                                        <span className={cn(
                                          'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                          atingiu ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                                        )}>
                                          {atingiu ? 'Atingiu ✓' : 'Não Atingiu ✗'}
                                        </span>
                                        {desafioAtivo && (
                                          <span className={cn(
                                            'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                            atingiuDesafio
                                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                              : 'bg-muted text-muted-foreground'
                                          )}>
                                            {atingiuDesafio ? 'Desafio ✓' : 'Desafio ✗'}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      <Dialog open={!!detailRow} onOpenChange={open => { if (!open) setDetailRow(null); }}>
        <DialogContent className="max-w-sm p-0">
          {detailRow && (() => {
            const code = detailRow.indicators?.codigo?.toUpperCase();
            const isTime = isTimeIndicator(code);
            const valor = isTime ? formatMinutesHHMM(detailRow.valor) : String(detailRow.valor);
            const meta = detailRow.meta != null ? (isTime ? formatMinutesHHMM(detailRow.meta) : String(detailRow.meta)) : '—';
            const desafioAtivo = Number(detailRow.desafio ?? 0) > 0;
            const desafio = desafioAtivo
              ? (isTime ? formatMinutesHHMM(Number(detailRow.desafio)) : String(detailRow.desafio))
              : '—';
            const atingiu = detailRow.status === 'dentro_meta' || detailRow.status === 'acima_meta';
            const atingiuDesafio = detailRow.status_desafio === 'atingiu';
            const pct = detailRow.percentual_atingimento;

            return (
              <>
                <div className="px-6 pt-6 pb-4 border-b border-border/50">
                  <DialogHeader>
                    <DialogTitle className="text-base">Detalhe do Indicador</DialogTitle>
                  </DialogHeader>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary font-mono">
                      {detailRow.indicators?.codigo}
                    </span>
                    <span className="text-sm font-medium text-foreground">{detailRow.indicators?.nome}</span>
                    {desafioAtivo && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        🎯 Com desafio
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {detailRow.users?.nome} • {format(new Date(detailRow.data_referencia + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    {detailRow.mapa_numero && ` • Mapa ${detailRow.mapa_numero}`}
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className={cn('grid gap-4 text-center', desafioAtivo ? 'grid-cols-3' : 'grid-cols-2')}>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Realizado</p>
                        <p className="text-2xl font-bold text-foreground">{valor}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Meta</p>
                        <p className="text-2xl font-bold text-foreground">{meta}</p>
                      </div>
                      {desafioAtivo && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Desafio</p>
                          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{desafio}</p>
                        </div>
                      )}
                    </div>

                    {detailRow.meta != null && detailRow.meta > 0 && (
                      <div className="space-y-1.5">
                        <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', atingiu ? 'bg-emerald-500' : 'bg-red-500')}
                            style={{ width: `${Math.min(pct ?? 0, 150)}%` }}
                          />
                        </div>
                        {pct != null && (
                          <p className="text-xs text-center text-muted-foreground">{pct}% de atingimento</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-sm font-bold px-4 py-1.5 rounded-full',
                      atingiu
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    )}>
                      {atingiu ? '✓ Atingiu a Meta' : '✗ Não Atingiu a Meta'}
                    </span>
                    {desafioAtivo && (
                      <span className={cn(
                        'text-sm font-bold px-4 py-1.5 rounded-full',
                        atingiuDesafio
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {atingiuDesafio ? '🎯 Atingiu o Desafio' : '🎯 Não Atingiu o Desafio'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-6 pb-6 flex justify-end border-t border-border/50 pt-4">
                  <Button variant="outline" onClick={() => setDetailRow(null)}>Fechar</Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
