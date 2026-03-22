import { useState, useMemo, useCallback } from 'react';
import { exportToCsv } from '@/lib/exportCsv';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useDesempenhoDiario, useCreateLancamento, useUpdateLancamento, useDeleteLancamento, useBatchCreateLancamentos, type DesempenhoRow } from '@/hooks/useDesempenho';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useUnidades } from '@/hooks/useUnidades';
import { useUsuarios, type UserWithRelations } from '@/hooks/useUsuarios';
import { useMetas } from '@/hooks/useMetas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Target, TrendingUp, TrendingDown, AlertTriangle, Pencil, Trash2,
  Loader2, CalendarIcon, Users, Truck, UserCheck, BarChart3, Layers,
  ChevronRight, Download, Upload,
} from 'lucide-react';
import { ImportDesempenhoDialog } from '@/components/admin/ImportDesempenhoDialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { cn } from '@/lib/utils';

function DatePick({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-9', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default function Desempenho() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateFilter, setDateFilter] = useState(today);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');

  const { data: desempenho = [], isLoading } = useDesempenhoDiario(dateFilter, {
    unidade_id: filters.unidade_id,
    worker_type: activeTab !== 'todos' ? activeTab : filters.worker_type,
    user_id: filters.user_id, indicator_id: filters.indicator_id,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { data: units = [] } = useUnidades();
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const { data: metas = [] } = useMetas({ vigentes: true });

  const createMut = useCreateLancamento();
  const updateMut = useUpdateLancamento();
  const deleteMut = useDeleteLancamento();
  const batchMut = useBatchCreateLancamentos();

  const [singleOpen, setSingleOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DesempenhoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DesempenhoRow | null>(null);

  const [sForm, setSForm] = useState({ user_id: '', indicator_id: '', data_referencia: today, valor: 0, meta: 0, origem_dado: 'manual' });
  const [selectedUser, setSelectedUser] = useState<UserWithRelations | null>(null);

  const [batchIndicator, setBatchIndicator] = useState('');
  const [batchDate, setBatchDate] = useState(today);
  const [batchRows, setBatchRows] = useState<{ user_id: string; nome: string; valor: number; meta: number }[]>([]);

  const activeUnits = units.filter(u => u.ativo);
  const colabs = usuarios.filter(u => u.role === 'colaborador');

  const pg = usePagination(desempenho);

  // KPIs
  const avgAtingimento = useMemo(() => {
    if (!desempenho.length) return 0;
    const vals = desempenho.filter(d => d.percentual_atingimento != null).map(d => d.percentual_atingimento!);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
  }, [desempenho]);

  const acimaMeta = desempenho.filter(d => d.status === 'acima_meta').length;
  const dentroMeta = desempenho.filter(d => d.status === 'dentro_meta').length;
  const abaixoMeta = desempenho.filter(d => d.status === 'abaixo_meta').length;

  const piorIndicador = useMemo(() => {
    if (!desempenho.length) return null;
    const byInd: Record<string, { nome: string; vals: number[] }> = {};
    desempenho.forEach(d => {
      const key = d.indicator_id;
      if (!byInd[key]) byInd[key] = { nome: d.indicators?.nome ?? '', vals: [] };
      if (d.percentual_atingimento != null) byInd[key].vals.push(d.percentual_atingimento);
    });
    let worst = { nome: '', avg: Infinity };
    Object.values(byInd).forEach(v => {
      const avg = v.vals.reduce((a, b) => a + b, 0) / v.vals.length;
      if (avg < worst.avg) worst = { nome: v.nome, avg };
    });
    return worst.avg < Infinity ? worst : null;
  }, [desempenho]);

  // Chart data
  const chartData = useMemo(() => {
    const byInd: Record<string, { nome: string; vals: number[] }> = {};
    desempenho.forEach(d => {
      const key = d.indicator_id;
      if (!byInd[key]) byInd[key] = { nome: d.indicators?.codigo ?? '', vals: [] };
      if (d.percentual_atingimento != null) byInd[key].vals.push(d.percentual_atingimento);
    });
    return Object.values(byInd).map(v => {
      const media = Math.round(v.vals.reduce((a, b) => a + b, 0) / v.vals.length * 10) / 10;
      return { indicador: v.nome, media };
    }).sort((a, b) => a.media - b.media);
  }, [desempenho]);

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const findMeta = (userId: string, indicatorId: string) => {
    const user = colabs.find(u => u.id === userId);
    const m = metas.find(g =>
      g.indicator_id === indicatorId &&
      (g.user_id === userId || (!g.user_id && (!g.worker_type || g.worker_type === user?.worker_type)))
    );
    return m?.valor_meta ?? 0;
  };

  const openSingle = (row?: DesempenhoRow) => {
    if (row) {
      setEditingRow(row);
      setSForm({ user_id: row.user_id, indicator_id: row.indicator_id, data_referencia: row.data_referencia, valor: row.valor, meta: row.meta ?? 0, origem_dado: row.origem_dado });
      setSelectedUser(colabs.find(u => u.id === row.user_id) ?? null);
    } else {
      setEditingRow(null);
      setSForm({ user_id: '', indicator_id: '', data_referencia: today, valor: 0, meta: 0, origem_dado: 'manual' });
      setSelectedUser(null);
    }
    setSingleOpen(true);
  };

  const handleSelectUser = (userId: string) => {
    const u = colabs.find(c => c.id === userId) ?? null;
    setSelectedUser(u);
    setSForm(f => ({ ...f, user_id: userId, indicator_id: '', meta: 0 }));
  };

  const handleSelectIndicator = (indId: string) => {
    const metaVal = findMeta(sForm.user_id, indId);
    setSForm(f => ({ ...f, indicator_id: indId, meta: metaVal }));
  };

  const saveSingle = async () => {
    if (editingRow) {
      await updateMut.mutateAsync({ id: editingRow.id, valor: sForm.valor, meta: sForm.meta });
    } else {
      await createMut.mutateAsync(sForm);
    }
    setSingleOpen(false);
  };

  const openBatch = () => { setBatchIndicator(''); setBatchDate(today); setBatchRows([]); setBatchOpen(true); };

  const handleBatchIndicator = (indId: string) => {
    setBatchIndicator(indId);
    const ind = indicators.find(i => i.id === indId);
    const compatible = colabs.filter(u => ind?.applies_to_worker_type === 'ambos' || u.worker_type === ind?.applies_to_worker_type);
    setBatchRows(compatible.map(u => ({ user_id: u.id, nome: u.nome, valor: 0, meta: findMeta(u.id, indId) })));
  };

  const saveBatch = async () => {
    const rows = batchRows.filter(r => r.valor > 0).map(r => ({
      user_id: r.user_id, indicator_id: batchIndicator, data_referencia: batchDate,
      valor: r.valor, meta: r.meta, origem_dado: 'manual',
    }));
    if (rows.length) await batchMut.mutateAsync(rows);
    setBatchOpen(false);
  };

  const confirmDelete = async () => {
    if (deleteTarget) await deleteMut.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  const previewPct = sForm.meta > 0 ? Math.round((sForm.valor / sForm.meta) * 1000) / 10 : 0;
  const previewStatus = previewPct >= 100 ? 'acima_meta' : previewPct >= 90 ? 'dentro_meta' : 'abaixo_meta';

  const userIndicators = useMemo(() => {
    if (!selectedUser?.worker_type) return indicators;
    return indicators.filter(i => i.applies_to_worker_type === 'ambos' || i.applies_to_worker_type === selectedUser.worker_type);
  }, [selectedUser, indicators]);

  const saving = createMut.isPending || updateMut.isPending;

  const getBarColor = (media: number) => {
    if (media >= 100) return 'hsl(160, 84%, 39%)';
    if (media >= 90) return 'hsl(217, 91%, 60%)';
    return 'hsl(0, 84%, 60%)';
  };

  const kpis = [
    { label: 'Média Geral', value: `${avgAtingimento}%`, icon: Target, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Acima da Meta', value: acimaMeta, icon: TrendingUp, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Na Meta', value: dentroMeta, icon: BarChart3, iconBg: 'bg-sky-100', iconColor: 'text-sky-600', borderColor: 'border-l-sky-500' },
    { label: 'Abaixo da Meta', value: abaixoMeta, icon: TrendingDown, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PageHeader
          title="Desempenho Operacional"
          subtitle={`Data: ${format(new Date(dateFilter + 'T00:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
        />
        <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => {
          const rows = desempenho.map(d => [
            d.users?.nome ?? '', d.indicators?.codigo ?? '', d.indicators?.nome ?? '',
            d.valor, d.meta ?? '', d.percentual_atingimento != null ? `${d.percentual_atingimento}%` : '',
            d.status ?? '', d.data_referencia,
          ]);
          exportToCsv(`desempenho-${dateFilter}.csv`, ['Colaborador', 'Código', 'Indicador', 'Valor', 'Meta', '% Ating.', 'Status', 'Data'], rows);
        }}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={() => openSingle()} className="gap-2">
          <Target className="h-4 w-4" /> Lançar Indicador
        </Button>
        <Button variant="outline" onClick={openBatch} className="gap-2">
          <Layers className="h-4 w-4" /> Lançamento em Lote
        </Button>
      </div>

      {/* KPI Cards */}
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

      {/* Worst indicator callout */}
      {piorIndicador && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Indicador com pior desempenho: <strong>{piorIndicador.nome}</strong> — média de {piorIndicador.avg.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Tabs + Filters */}
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
          <div className="w-full sm:w-44">
            <DatePick value={dateFilter} onChange={v => { setDateFilter(v); pg.resetPage(); }} placeholder="Data" />
          </div>
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

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">Média de Atingimento por Indicador</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
              <YAxis type="category" dataKey="indicador" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number) => `${v}%`} />
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

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : desempenho.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum lançamento encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Selecione outra data ou faça um lançamento</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            {pg.paginatedItems.map(d => {
              const isMot = d.users?.worker_type === 'motorista';
              const pct = d.percentual_atingimento ?? 0;
              const statusColor = d.status === 'acima_meta' ? 'text-emerald-600' : d.status === 'dentro_meta' ? 'text-blue-600' : 'text-red-600';
              const barColor = d.status === 'acima_meta' ? 'green' : d.status === 'dentro_meta' ? 'blue' : 'red';

              return (
                <div key={d.id} className="flex items-center gap-4 px-5 py-4 transition-colors group hover:bg-muted/30">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={cn('text-xs font-bold', isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700')}>
                      {getInitials(d.users?.nome ?? '')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-foreground truncate">{d.users?.nome}</span>
                      <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700')}>
                        {isMot ? 'Mot' : 'Aj'}
                      </span>
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary font-mono">
                        {d.indicators?.codigo}
                      </span>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">{d.indicators?.nome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        <strong className="text-foreground">{d.valor}</strong> / {d.meta ?? '—'} {d.indicators?.unidade_medida}
                      </span>
                      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <ProgressBar value={pct} color={barColor} className="flex-1" />
                        <span className={cn('text-xs font-bold w-12 text-right', statusColor)}>
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={d.status ?? 'abaixo_meta'} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSingle(d)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(d)}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Single modal */}
      <Dialog open={singleOpen} onOpenChange={setSingleOpen}>
        <DialogContent className="max-w-md p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">{editingRow ? 'Editar Lançamento' : 'Lançar Indicador'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Colaborador *</Label>
              <Select value={sForm.user_id} onValueChange={handleSelectUser} disabled={!!editingRow}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Indicador *</Label>
              <Select value={sForm.indicator_id} onValueChange={handleSelectIndicator} disabled={!!editingRow}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{userIndicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <DatePick value={sForm.data_referencia} onChange={v => setSForm(f => ({ ...f, data_referencia: v }))} placeholder="Hoje" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor *</Label>
                <Input type="number" className="h-9" value={sForm.valor} onChange={e => setSForm(f => ({ ...f, valor: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Meta</Label>
                <Input type="number" className="h-9" value={sForm.meta} onChange={e => setSForm(f => ({ ...f, meta: Number(e.target.value) }))} />
              </div>
            </div>

            {/* Preview */}
            {sForm.valor > 0 && sForm.meta > 0 && (
              <div className={cn(
                'rounded-lg border p-3 flex items-center justify-between',
                previewStatus === 'acima_meta' ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20' :
                previewStatus === 'dentro_meta' ? 'border-blue-200 bg-blue-50 dark:bg-blue-950/20' :
                'border-red-200 bg-red-50 dark:bg-red-950/20'
              )}>
                <div className="flex items-center gap-2">
                  <ProgressBar value={previewPct} color={previewStatus === 'acima_meta' ? 'green' : previewStatus === 'dentro_meta' ? 'blue' : 'red'} className="w-20" />
                  <span className="text-sm font-bold">{previewPct}%</span>
                </div>
                <StatusBadge status={previewStatus} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Origem</Label>
              <Select value={sForm.origem_dado} onValueChange={v => setSForm(f => ({ ...f, origem_dado: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="sistema">Sistema</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setSingleOpen(false)}>Cancelar</Button>
            <Button onClick={saveSingle} disabled={saving || !sForm.user_id || !sForm.indicator_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch modal */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">Lançamento em Lote</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Indicador *</Label>
                <Select value={batchIndicator} onValueChange={handleBatchIndicator}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <DatePick value={batchDate} onChange={setBatchDate} placeholder="Hoje" />
              </div>
            </div>
            {batchRows.length > 0 && (
              <ScrollArea className="max-h-[400px]">
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 text-xs font-bold text-muted-foreground">Colaborador</th>
                        <th className="text-left p-3 w-28 text-xs font-bold text-muted-foreground">Valor</th>
                        <th className="text-left p-3 w-28 text-xs font-bold text-muted-foreground">Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((r, i) => (
                        <tr key={r.user_id} className="border-t border-border/50 hover:bg-muted/20">
                          <td className="p-3 text-sm font-medium">{r.nome}</td>
                          <td className="p-3">
                            <Input type="number" className="h-8 text-xs" value={r.valor} onChange={e => {
                              const v = Number(e.target.value);
                              setBatchRows(rows => rows.map((row, j) => j === i ? { ...row, valor: v } : row));
                            }} />
                          </td>
                          <td className="p-3">
                            <Input type="number" className="h-8 text-xs" value={r.meta} onChange={e => {
                              const v = Number(e.target.value);
                              setBatchRows(rows => rows.map((row, j) => j === i ? { ...row, meta: v } : row));
                            }} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            )}
          </div>
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancelar</Button>
            <Button onClick={saveBatch} disabled={batchMut.isPending || !batchIndicator || !batchRows.some(r => r.valor > 0)}>
              {batchMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Todos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="Excluir lançamento"
        description="Deseja excluir este lançamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir" onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)} loading={deleteMut.isPending} />
    </div>
  );
}
