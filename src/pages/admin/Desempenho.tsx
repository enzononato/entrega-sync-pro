import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useDesempenhoDiario, useCreateLancamento, useUpdateLancamento, useDeleteLancamento, useBatchCreateLancamentos, type DesempenhoRow } from '@/hooks/useDesempenho';
import { useIndicadores, useIndicadoresByWorkerType } from '@/hooks/useIndicadores';
import { useUnidades } from '@/hooks/useUnidades';
import { useUsuarios, type UserWithRelations } from '@/hooks/useUsuarios';
import { useMetas } from '@/hooks/useMetas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Target, TrendingUp, TrendingDown, AlertTriangle, Pencil, Trash2, Loader2, CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';

function DatePick({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
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

  const { data: desempenho = [], isLoading } = useDesempenhoDiario(dateFilter, {
    unidade_id: filters.unidade_id, worker_type: filters.worker_type,
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
  const [editingRow, setEditingRow] = useState<DesempenhoRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DesempenhoRow | null>(null);

  // Single form
  const [sForm, setSForm] = useState({ user_id: '', indicator_id: '', data_referencia: today, valor: 0, meta: 0, origem_dado: 'manual' });
  const [selectedUser, setSelectedUser] = useState<UserWithRelations | null>(null);

  // Batch form
  const [batchIndicator, setBatchIndicator] = useState('');
  const [batchDate, setBatchDate] = useState(today);
  const [batchRows, setBatchRows] = useState<{ user_id: string; nome: string; valor: number; meta: number }[]>([]);

  const activeUnits = units.filter(u => u.ativo);
  const colabs = usuarios.filter(u => u.role === 'colaborador');

  // Summary cards
  const avgAtingimento = useMemo(() => {
    if (!desempenho.length) return 0;
    const vals = desempenho.filter(d => d.percentual_atingimento != null).map(d => d.percentual_atingimento!);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
  }, [desempenho]);

  const acimaMeta = desempenho.filter(d => d.status === 'acima_meta').length;
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
    return Object.values(byInd).map(v => ({
      indicador: v.nome,
      media: Math.round(v.vals.reduce((a, b) => a + b, 0) / v.vals.length * 10) / 10,
    }));
  }, [desempenho]);

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Find meta for user + indicator
  const findMeta = (userId: string, indicatorId: string) => {
    const user = colabs.find(u => u.id === userId);
    const m = metas.find(g =>
      g.indicator_id === indicatorId &&
      (g.user_id === userId || (!g.user_id && (!g.worker_type || g.worker_type === user?.worker_type)))
    );
    return m?.valor_meta ?? 0;
  };

  // Open single form
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

  // Open batch
  const openBatch = () => {
    setBatchIndicator('');
    setBatchDate(today);
    setBatchRows([]);
    setBatchOpen(true);
  };

  const handleBatchIndicator = (indId: string) => {
    setBatchIndicator(indId);
    const ind = indicators.find(i => i.id === indId);
    const compatible = colabs.filter(u =>
      ind?.applies_to_worker_type === 'ambos' || u.worker_type === ind?.applies_to_worker_type
    );
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

  // Preview calc
  const previewPct = sForm.meta > 0 ? Math.round((sForm.valor / sForm.meta) * 1000) / 10 : 0;
  const previewStatus = previewPct >= 100 ? 'acima_meta' : previewPct >= 90 ? 'dentro_meta' : 'abaixo_meta';

  // Filtered indicators for selected user
  const userIndicators = useMemo(() => {
    if (!selectedUser?.worker_type) return indicators;
    return indicators.filter(i => i.applies_to_worker_type === 'ambos' || i.applies_to_worker_type === selectedUser.worker_type);
  }, [selectedUser, indicators]);

  const saving = createMut.isPending || updateMut.isPending;

  const columns: Column<DesempenhoRow>[] = [
    {
      key: 'colaborador', label: 'Colaborador', render: (d) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-[10px]">{getInitials(d.users?.nome ?? '')}</AvatarFallback></Avatar>
          <div><p className="text-sm font-medium">{d.users?.nome}</p><p className="text-[10px] text-muted-foreground">{d.users?.matricula}</p></div>
        </div>
      ),
    },
    {
      key: 'tipo', label: 'Tipo', render: (d) =>
        d.users?.worker_type === 'motorista' ? <span className="inline-flex rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Mot</span>
          : <span className="inline-flex rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">Aj</span>
    },
    { key: 'indicador', label: 'Indicador', render: (d) => <span><span className="font-mono text-xs text-primary">{d.indicators?.codigo}</span> {d.indicators?.nome}</span> },
    { key: 'valor', label: 'Valor', render: (d) => `${d.valor} ${d.indicators?.unidade_medida ?? ''}` },
    { key: 'meta', label: 'Meta', render: (d) => d.meta != null ? `${d.meta} ${d.indicators?.unidade_medida ?? ''}` : '—' },
    {
      key: 'atingimento', label: '% Ating.', render: (d) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <ProgressBar value={d.percentual_atingimento ?? 0} color={d.status === 'acima_meta' ? 'green' : d.status === 'dentro_meta' ? 'blue' : 'red'} className="flex-1" />
          <span className="text-xs font-medium w-12 text-right">{d.percentual_atingimento?.toFixed(1)}%</span>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (d) => d.status ? <StatusBadge status={d.status} /> : '—' },
    {
      key: 'acoes', label: 'Ações', render: (d) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openSingle(d)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(d)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Target className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{avgAtingimento}%</p><p className="text-xs text-muted-foreground">Média Geral</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold">{acimaMeta}</p><p className="text-xs text-muted-foreground">Acima da Meta</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-red-600" /></div>
          <div><p className="text-2xl font-bold">{abaixoMeta}</p><p className="text-xs text-muted-foreground">Abaixo da Meta</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-lg font-bold truncate max-w-[120px]">{piorIndicador?.nome ?? '—'}</p><p className="text-xs text-muted-foreground">{piorIndicador ? `${piorIndicador.avg.toFixed(1)}%` : 'Pior Indicador'}</p></div>
        </div>
      </div>

      <PageHeader title="Desempenho Operacional" subtitle={`Data: ${format(new Date(dateFilter + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`} />
      <div className="flex gap-2 mb-4">
        <Button onClick={() => openSingle()}>Lançar Indicador</Button>
        <Button variant="outline" onClick={openBatch}>Lançamento em Lote</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="w-full sm:w-44"><DatePick value={dateFilter} onChange={setDateFilter} placeholder="Data" /></div>
        <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.worker_type ?? ''} onValueChange={v => setFilters(f => ({ ...f, worker_type: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
        </Select>
        <Select value={filters.user_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, user_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Indicador" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm mb-6">
          <h3 className="text-sm font-semibold mb-3">Média de Atingimento por Indicador</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="indicador" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <ReferenceLine y={90} stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" label={{ value: '90%', position: 'right', fontSize: 10 }} />
              <ReferenceLine y={100} stroke="hsl(160, 84%, 39%)" strokeDasharray="5 5" label={{ value: '100%', position: 'right', fontSize: 10 }} />
              <Bar dataKey="media" fill="hsl(224, 76%, 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <DataTable columns={columns} data={desempenho} loading={isLoading} emptyMessage="Nenhum lançamento encontrado" />

      {/* Single modal */}
      <Dialog open={singleOpen} onOpenChange={setSingleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRow ? 'Editar Lançamento' : 'Lançar Indicador'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Colaborador *</Label>
              <Select value={sForm.user_id} onValueChange={handleSelectUser} disabled={!!editingRow}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Indicador *</Label>
              <Select value={sForm.indicator_id} onValueChange={handleSelectIndicator} disabled={!!editingRow}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{userIndicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <DatePick value={sForm.data_referencia} onChange={v => setSForm(f => ({ ...f, data_referencia: v }))} placeholder="Hoje" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Valor *</Label><Input type="number" value={sForm.valor} onChange={e => setSForm(f => ({ ...f, valor: Number(e.target.value) }))} /></div>
              <div className="space-y-1"><Label>Meta</Label><Input type="number" value={sForm.meta} onChange={e => setSForm(f => ({ ...f, meta: Number(e.target.value) }))} /></div>
            </div>
            {sForm.valor > 0 && sForm.meta > 0 && (
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <span className="text-sm">Atingimento: <strong>{previewPct}%</strong></span>
                <StatusBadge status={previewStatus} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select value={sForm.origem_dado} onValueChange={v => setSForm(f => ({ ...f, origem_dado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="sistema">Sistema</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleOpen(false)}>Cancelar</Button>
            <Button onClick={saveSingle} disabled={saving || !sForm.user_id || !sForm.indicator_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch modal */}
      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lançamento em Lote</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Indicador *</Label>
                <Select value={batchIndicator} onValueChange={handleBatchIndicator}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <DatePick value={batchDate} onChange={setBatchDate} placeholder="Hoje" />
              </div>
            </div>
            {batchRows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted"><tr><th className="text-left p-2">Colaborador</th><th className="text-left p-2 w-24">Valor</th><th className="text-left p-2 w-24">Meta</th></tr></thead>
                  <tbody>
                    {batchRows.map((r, i) => (
                      <tr key={r.user_id} className="border-t">
                        <td className="p-2">{r.nome}</td>
                        <td className="p-2"><Input type="number" className="h-8" value={r.valor} onChange={e => {
                          const v = Number(e.target.value);
                          setBatchRows(rows => rows.map((row, j) => j === i ? { ...row, valor: v } : row));
                        }} /></td>
                        <td className="p-2"><Input type="number" className="h-8" value={r.meta} onChange={e => {
                          const v = Number(e.target.value);
                          setBatchRows(rows => rows.map((row, j) => j === i ? { ...row, meta: v } : row));
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(false)}>Cancelar</Button>
            <Button onClick={saveBatch} disabled={batchMut.isPending || !batchIndicator || !batchRows.some(r => r.valor > 0)}>
              {batchMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog open={!!deleteTarget} title="Excluir lançamento"
        description="Deseja excluir este lançamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir" onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)} loading={deleteMut.isPending} />
    </div>
  );
}
