import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIncentivos, useCreateIncentivo, useUpdateIncentivo, useToggleIncentivoAtivo, type IncentiveRuleWithRelations } from '@/hooks/useIncentivos';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useUnidades } from '@/hooks/useUnidades';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Pencil, Power, Loader2, CalendarIcon, DollarSign, Truck, Users,
  Target, ArrowRight, TrendingUp, Weight, Building2, Layers, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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

const emptyForm = {
  indicator_id: '', worker_type: 'motorista', unidade_id: '' as string | null,
  peso: 1, meta: 0, valor_minimo: 0, valor_maximo: 0,
  descricao_regra: '', vigencia_inicio: format(new Date(), 'yyyy-MM-dd'),
  vigencia_fim: '' as string | null, ativo: true,
};

export default function Incentivos() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: regras = [], isLoading } = useIncentivos({
    worker_type: activeTab !== 'todos' ? activeTab : filters.worker_type,
    indicator_id: filters.indicator_id,
    unidade_id: filters.unidade_id,
    ativo: filters.ativo,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { data: units = [] } = useUnidades();
  const activeUnits = units.filter(u => u.ativo);

  const createMut = useCreateIncentivo();
  const updateMut = useUpdateIncentivo();
  const toggleMut = useToggleIncentivoAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncentiveRuleWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<IncentiveRuleWithRelations | null>(null);

  // KPIs
  const { data: allRegras = [] } = useIncentivos({});
  const totalRegras = allRegras.length;
  const totalAtivas = allRegras.filter(r => r.ativo).length;
  const totalMotorista = allRegras.filter(r => r.worker_type === 'motorista').length;
  const totalAjudante = allRegras.filter(r => r.worker_type === 'ajudante').length;
  const maxBonus = useMemo(() => {
    const mot = allRegras.filter(r => r.ativo && r.worker_type === 'motorista').reduce((s, r) => s + r.valor_maximo, 0);
    const aj = allRegras.filter(r => r.ativo && r.worker_type === 'ajudante').reduce((s, r) => s + r.valor_maximo, 0);
    return { mot, aj };
  }, [allRegras]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: IncentiveRuleWithRelations) => {
    setEditing(r);
    setForm({
      indicator_id: r.indicator_id, worker_type: r.worker_type, unidade_id: r.unidade_id,
      peso: r.peso, meta: r.meta, valor_minimo: r.valor_minimo, valor_maximo: r.valor_maximo,
      descricao_regra: (r.regra_json?.descricao as string) ?? '',
      vigencia_inicio: r.vigencia_inicio, vigencia_fim: r.vigencia_fim, ativo: r.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      indicator_id: form.indicator_id, worker_type: form.worker_type,
      unidade_id: form.unidade_id || null, peso: form.peso, meta: form.meta,
      valor_minimo: form.valor_minimo, valor_maximo: form.valor_maximo,
      regra_json: { descricao: form.descricao_regra },
      vigencia_inicio: form.vigencia_inicio, vigencia_fim: form.vigencia_fim || null,
      ativo: form.ativo,
    };
    if (editing?.id) await updateMut.mutateAsync({ id: editing.id, ...payload });
    else await createMut.mutateAsync(payload);
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false); setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const simulate = useMemo(() => {
    if (!form.meta || !form.valor_maximo) return null;
    const range = form.valor_maximo - form.valor_minimo;
    return {
      abaixo: Math.max(form.valor_minimo, form.valor_minimo + range * 0.3).toFixed(2),
      meta: ((form.valor_minimo + form.valor_maximo) / 2).toFixed(2),
      acima: form.valor_maximo.toFixed(2),
    };
  }, [form.meta, form.valor_minimo, form.valor_maximo]);

  const kpis = [
    { label: 'Total de Regras', value: totalRegras, icon: Layers, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Ativas', value: totalAtivas, icon: Zap, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Bônus Máx Mot.', value: fmtBRL(maxBonus.mot), icon: Truck, iconBg: 'bg-green-100', iconColor: 'text-green-600', borderColor: 'border-l-green-500', isText: true },
    { label: 'Bônus Máx Aj.', value: fmtBRL(maxBonus.aj), icon: Users, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500', isText: true },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Regras de Incentivo" subtitle="Configure as regras de bonificação por indicador" actionLabel="Nova Regra" onAction={openCreate} />

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
                  <p className={cn('font-bold text-foreground leading-none', 'isText' in k ? 'text-lg' : 'text-2xl')}>{k.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Indicador" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="true">Ativo</SelectItem><SelectItem value="false">Inativo</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : regras.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <DollarSign className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma regra encontrada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Crie uma nova regra de incentivo</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
          {regras.map(r => {
            const isMot = r.worker_type === 'motorista';
            return (
              <div
                key={r.id}
                className={cn(
                  'flex items-center gap-4 px-5 py-4 transition-colors group',
                  !r.ativo && 'opacity-50'
                )}
              >
                {/* Type icon */}
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                  isMot ? 'bg-emerald-100' : 'bg-violet-100'
                )}>
                  {isMot
                    ? <Truck className="h-5 w-5 text-emerald-600" />
                    : <Users className="h-5 w-5 text-violet-600" />
                  }
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-bold">
                      {r.indicators?.nome ?? '—'}
                    </span>
                    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                    )}>
                      {isMot ? 'Motorista' : 'Ajudante'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Valores */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <DollarSign className="h-3 w-3" />
                      {fmtBRL(r.valor_minimo)} → {fmtBRL(r.valor_maximo)}
                    </span>

                    {/* Peso */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Weight className="h-3 w-3" />
                      Peso {r.peso}
                    </span>

                    {/* Meta */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Target className="h-3 w-3" />
                      Meta {r.meta}
                    </span>

                    {/* Unidade */}
                    {r.units?.nome && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" />{r.units.nome}
                      </span>
                    )}

                    {/* Vigência */}
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hidden sm:inline-flex">
                      <CalendarIcon className="h-3 w-3" />
                      {format(new Date(r.vigencia_inicio + 'T00:00:00'), 'dd/MM/yy')}
                      <ArrowRight className="h-3 w-3" />
                      {r.vigencia_fim ? format(new Date(r.vigencia_fim + 'T00:00:00'), 'dd/MM/yy') : '∞'}
                    </span>
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={r.ativo ? 'ativo' : 'inativo'} />
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setToggleTarget(r); setConfirmOpen(true); }}>
                      <Power className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? 'Editar Regra' : 'Nova Regra'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Indicador *</Label>
                    <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo *</Label>
                    <div className="flex gap-2">
                      {[
                        { v: 'motorista', l: 'Motorista', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                        { v: 'ajudante', l: 'Ajudante', bg: 'bg-violet-100 text-violet-700 border-violet-300' },
                      ].map(o => (
                        <button
                          key={o.v}
                          type="button"
                          className={cn(
                            'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                            form.worker_type === o.v
                              ? cn(o.bg, 'border-2 shadow-sm')
                              : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                          )}
                          onClick={() => setForm(f => ({ ...f, worker_type: o.v }))}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Peso</Label>
                    <Input type="number" min={0.1} step={0.1} value={form.peso} onChange={e => setForm(f => ({ ...f, peso: Number(e.target.value) }))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta Ref.</Label>
                    <Input type="number" value={form.meta} onChange={e => setForm(f => ({ ...f, meta: Number(e.target.value) }))} className="h-9" />
                  </div>
                  <div />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Mínimo (R$)</Label>
                    <Input type="number" min={0} step={0.01} value={form.valor_minimo} onChange={e => setForm(f => ({ ...f, valor_minimo: Number(e.target.value) }))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor Máximo (R$)</Label>
                    <Input type="number" min={0} step={0.01} value={form.valor_maximo} onChange={e => setForm(f => ({ ...f, valor_maximo: Number(e.target.value) }))} className="h-9" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição da Regra</Label>
                  <Textarea value={form.descricao_regra} onChange={e => setForm(f => ({ ...f, descricao_regra: e.target.value }))} rows={2} className="resize-none" placeholder="Descreva a regra..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Início *</Label>
                    <DatePick value={form.vigencia_inicio} onChange={v => setForm(f => ({ ...f, vigencia_inicio: v }))} placeholder="Selecione" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fim</Label>
                    <DatePick value={form.vigencia_fim ?? ''} onChange={v => setForm(f => ({ ...f, vigencia_fim: v || null }))} placeholder="Sem fim" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <Label className="text-sm">Regra Ativa</Label>
                  <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                </div>
              </div>

              {/* Simulation card */}
              <div className="rounded-xl border bg-muted/20 p-4 space-y-4 h-fit">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-bold text-foreground">Simulação</h4>
                </div>
                {simulate ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3">
                      <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Abaixo da meta</span>
                      <p className="text-lg font-bold text-red-700 dark:text-red-400 font-mono mt-0.5">R$ {simulate.abaixo}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Na meta</span>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-400 font-mono mt-0.5">R$ {simulate.meta}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Acima da meta</span>
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">R$ {simulate.acima}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/40 p-4 text-center">
                    <DollarSign className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Preencha meta e valores para ver a simulação</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.indicator_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar regra' : 'Ativar regra'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} esta regra?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
