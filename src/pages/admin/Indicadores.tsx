import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIndicadores, useCreateIndicador, useUpdateIndicador, useToggleIndicadorAtivo, type IndicatorRow } from '@/hooks/useIndicadores';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pencil, Power, Loader2, BarChart3, Clock, Gem, Zap, Truck,
  DollarSign, Heart, Timer, ChevronRight, Search, Plus, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['Tempo', 'Qualidade', 'Eficiência', 'Operação', 'Financeiro', 'Satisfação', 'Jornada'];
const UNIDADES_MEDIDA = ['minutos', 'horas', '%', 'qtd', 'R$', 'nota'];

const CAT_CONFIG: Record<string, { icon: typeof BarChart3; color: string; bg: string }> = {
  Tempo: { icon: Clock, color: 'text-blue-700', bg: 'bg-blue-100' },
  Qualidade: { icon: Gem, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  Eficiência: { icon: Zap, color: 'text-amber-700', bg: 'bg-amber-100' },
  Operação: { icon: Truck, color: 'text-violet-700', bg: 'bg-violet-100' },
  Financeiro: { icon: DollarSign, color: 'text-green-700', bg: 'bg-green-100' },
  Satisfação: { icon: Heart, color: 'text-pink-700', bg: 'bg-pink-100' },
  Jornada: { icon: Timer, color: 'text-orange-700', bg: 'bg-orange-100' },
};

const WORKER_CONFIG: Record<string, { label: string; short: string; bg: string; color: string }> = {
  motorista: { label: 'Motorista', short: 'Mot', bg: 'bg-emerald-100', color: 'text-emerald-700' },
  ajudante: { label: 'Ajudante', short: 'Aj', bg: 'bg-violet-100', color: 'text-violet-700' },
  ambos: { label: 'Ambos', short: 'Amb', bg: 'bg-primary/10', color: 'text-primary' },
};

const emptyForm = { codigo: '', nome: '', categoria: '', unidade_medida: '', descricao: '', applies_to_worker_type: 'ambos', ativo: true };

export default function Indicadores() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: indicators = [], isLoading } = useIndicadores({ ativo: filters.ativo });
  const createMut = useCreateIndicador();
  const updateMut = useUpdateIndicador();
  const toggleMut = useToggleIndicadorAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IndicatorRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<IndicatorRow | null>(null);

  const filtered = useMemo(() => {
    return indicators.filter(i => {
      const s = filters.search?.toLowerCase() ?? '';
      const matchSearch = !s || i.nome.toLowerCase().includes(s) || i.codigo.toLowerCase().includes(s);
      const matchType = activeTab === 'todos' || i.applies_to_worker_type === activeTab;
      const matchCat = !filters.categoria || filters.categoria === 'all' || i.categoria === filters.categoria;
      return matchSearch && matchType && matchCat;
    });
  }, [indicators, filters, activeTab]);
  const pg = usePagination(filtered);

  // KPIs
  const totalAtivos = indicators.filter(i => i.ativo).length;
  const totalInativos = indicators.filter(i => !i.ativo).length;
  const categorias = useMemo(() => {
    const map: Record<string, number> = {};
    indicators.forEach(i => { if (i.categoria) map[i.categoria] = (map[i.categoria] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [indicators]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (i: IndicatorRow) => {
    setEditing(i);
    setForm({ codigo: i.codigo, nome: i.nome, categoria: i.categoria, unidade_medida: i.unidade_medida, descricao: i.descricao, applies_to_worker_type: i.applies_to_worker_type, ativo: i.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, codigo: form.codigo.toUpperCase() };
    if (editing?.id) await updateMut.mutateAsync({ id: editing.id, ...payload });
    else await createMut.mutateAsync(payload);
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false); setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const kpis = [
    { label: 'Total', value: indicators.length, icon: BarChart3, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Ativos', value: totalAtivos, icon: Zap, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Inativos', value: totalInativos, icon: Power, iconBg: 'bg-muted', iconColor: 'text-muted-foreground', borderColor: 'border-l-muted-foreground' },
    { label: 'Categorias', value: categorias.length, icon: Layers, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Indicadores" subtitle="Gerencie os indicadores de desempenho" actionLabel="Novo Indicador" onAction={openCreate} />

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

      {/* Distribution by category */}
      {categorias.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Distribuição por Categoria</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categorias.map(([cat, count]) => {
              const conf = CAT_CONFIG[cat] ?? { icon: BarChart3, color: 'text-muted-foreground', bg: 'bg-muted' };
              const CatIcon = conf.icon;
              return (
                <div key={cat} className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2', conf.bg)}>
                  <CatIcon className={cn('h-4 w-4', conf.color)} />
                  <span className={cn('text-sm font-medium', conf.color)}>{cat}</span>
                  <span className={cn('text-xs font-bold rounded-full px-1.5', conf.color)}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex flex-col gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="motorista" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Motorista
            </TabsTrigger>
            <TabsTrigger value="ajudante" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Ajudante
            </TabsTrigger>
            <TabsTrigger value="ambos" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Ambos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou código..."
              value={filters.search ?? ''}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="pl-9 h-9"
            />
          </div>
          <Select value={filters.categoria ?? ''} onValueChange={v => setFilters(f => ({ ...f, categoria: v }))}>
            <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Ativo</SelectItem>
              <SelectItem value="false">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum indicador encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou crie um novo indicador</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            {pg.paginatedItems.map(ind => {
              const catConf = CAT_CONFIG[ind.categoria] ?? { icon: BarChart3, color: 'text-muted-foreground', bg: 'bg-muted' };
              const CatIcon = catConf.icon;
              const workerConf = WORKER_CONFIG[ind.applies_to_worker_type] ?? WORKER_CONFIG.ambos;
              return (
                <div key={ind.id} className={cn('flex items-center gap-4 px-5 py-4 transition-colors group', !ind.ativo && 'opacity-50')}>
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', catConf.bg)}><CatIcon className={cn('h-5 w-5', catConf.color)} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-mono font-bold">{ind.codigo}</span>
                      <p className="text-sm font-semibold text-foreground truncate">{ind.nome}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', catConf.bg, catConf.color)}><CatIcon className="h-3 w-3" />{ind.categoria || 'Sem categoria'}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium', workerConf.bg, workerConf.color)}>{workerConf.label}</span>
                      {ind.unidade_medida && (<><span className="text-muted-foreground/40">•</span><span className="text-[11px] text-muted-foreground">{ind.unidade_medida}</span></>)}
                      {ind.descricao && (<><span className="text-muted-foreground/40 hidden sm:inline">•</span><span className="text-[11px] text-muted-foreground truncate max-w-[200px] hidden sm:inline">{ind.descricao}</span></>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={ind.ativo ? 'ativo' : 'inativo'} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ind)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setToggleTarget(ind); setConfirmOpen(true); }}><Power className="h-4 w-4 text-muted-foreground" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? 'Editar Indicador' : 'Novo Indicador'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Código *</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} className="h-9 font-mono" placeholder="Ex: TML" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="h-9" placeholder="Ex: Tempo Médio de Loading" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade de Medida</Label>
                <Select value={form.unidade_medida} onValueChange={v => setForm(f => ({ ...f, unidade_medida: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{UNIDADES_MEDIDA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} className="resize-none" placeholder="Descreva o indicador..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aplica-se a *</Label>
              <div className="flex gap-2">
                {[
                  { v: 'motorista', l: 'Motorista', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                  { v: 'ajudante', l: 'Ajudante', bg: 'bg-violet-100 text-violet-700 border-violet-300' },
                  { v: 'ambos', l: 'Ambos', bg: 'bg-primary/10 text-primary border-primary/30' },
                ].map(o => (
                  <button
                    key={o.v}
                    type="button"
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                      form.applies_to_worker_type === o.v
                        ? cn(o.bg, 'border-2 shadow-sm')
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                    )}
                    onClick={() => setForm(f => ({ ...f, applies_to_worker_type: o.v }))}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <Label className="text-sm">Indicador Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.codigo || !form.nome}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar indicador' : 'Ativar indicador'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
