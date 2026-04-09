import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { exportToCsv } from '@/lib/exportCsv';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIncentivos, useCreateIncentivo, useUpdateIncentivo, useToggleIncentivoAtivo, type IncentiveRuleWithRelations } from '@/hooks/useIncentivos';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Pencil, Power, Loader2, CalendarIcon, DollarSign, Plus, Download, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWorkerConfig, WORKER_TYPES } from '@/lib/workerTypes';

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
  indicator_id: '',
  worker_type: 'motorista',
  unidade_id: '' as string | null,
  valor: 0,
  vigencia_inicio: format(new Date(), 'yyyy-MM-dd'),
  vigencia_fim: '' as string | null,
  ativo: true,
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
  const { allowedUnits: activeUnits } = useAllowedUnits();

  const createMut = useCreateIncentivo();
  const updateMut = useUpdateIncentivo();
  const toggleMut = useToggleIncentivoAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IncentiveRuleWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<IncentiveRuleWithRelations | null>(null);
  const pg = usePagination(regras);

  // KPIs by worker type
  const { data: allRegras = [] } = useIncentivos({});
  const ativas = allRegras.filter(r => r.ativo);
  const totalByType = useMemo(() => {
    return WORKER_TYPES.map(wt => ({
      ...wt,
      total: ativas.filter(r => r.worker_type === wt.value).reduce((s, r) => s + r.valor_maximo, 0),
      count: ativas.filter(r => r.worker_type === wt.value).length,
    }));
  }, [ativas]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: IncentiveRuleWithRelations) => {
    setEditing(r);
    setForm({
      indicator_id: r.indicator_id,
      worker_type: r.worker_type,
      unidade_id: r.unidade_id,
      valor: r.valor_maximo,
      vigencia_inicio: r.vigencia_inicio,
      vigencia_fim: r.vigencia_fim,
      ativo: r.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      indicator_id: form.indicator_id,
      worker_type: form.worker_type,
      unidade_id: form.unidade_id || null,
      peso: 1,
      meta: 0,
      valor_minimo: 0,
      valor_maximo: form.valor,
      regra_json: {},
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: form.vigencia_fim || null,
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

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PageHeader title="Incentivos" subtitle="Defina o valor de bonificação para cada meta atingida" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => {
            const rows = regras.map(r => [
              r.indicators?.nome ?? '', r.worker_type,
              r.units?.nome ?? 'Todas', fmtBRL(r.valor_maximo),
              r.vigencia_inicio, r.vigencia_fim ?? '∞',
              r.ativo ? 'Ativo' : 'Inativo',
            ]);
            exportToCsv('incentivos.csv', ['Meta', 'Tipo', 'Unidade', 'Valor', 'Início', 'Fim', 'Status'], rows);
          }}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button onClick={openCreate} className="rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-all hover:shadow-lg gap-2">
            <Plus className="h-4 w-4" /> Novo Incentivo
          </Button>
        </div>
      </div>

      {/* KPI Cards per worker type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {totalByType.map(wt => {
          const Icon = wt.icon;
          return (
            <div key={wt.value} className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', wt.bgClass)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{fmtBRL(wt.total)}</p>
                  <p className="text-[11px] text-muted-foreground">{wt.label} · {wt.count} {wt.count === 1 ? 'meta' : 'metas'}</p>
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
            {WORKER_TYPES.map(wt => (
              <TabsTrigger key={wt.value} value={wt.value} className="gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', wt.dotClass)} /> {wt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Meta" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
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
          <p className="text-sm font-medium text-muted-foreground">Nenhum incentivo encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Adicione um valor de bonificação por meta</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pg.paginatedItems.map(r => {
              const wt = getWorkerConfig(r.worker_type);
              const Icon = wt.icon;

              return (
                <div
                  key={r.id}
                  className={cn(
                    'group relative rounded-xl border bg-card shadow-sm transition-all hover:shadow-md overflow-hidden',
                    !r.ativo && 'opacity-60'
                  )}
                >
                  <div className={cn('h-1.5', wt.dotClass)} />

                  <div className="p-4 space-y-3">
                    {/* Header: indicator name + worker type + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', wt.bgClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{r.indicators?.nome ?? '—'}</p>
                          <span className={cn('text-[10px] font-medium', wt.bgClass.split(' ')[1])}>
                            {wt.label}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={r.ativo ? 'ativo' : 'inativo'} />
                    </div>

                    {/* Value */}
                    <div className="bg-muted/40 rounded-lg px-3 py-3 flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Valor por meta batida</p>
                        <p className="text-xl font-bold text-foreground">{fmtBRL(r.valor_maximo)}</p>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {r.units?.nome && (
                        <p>Unidade: <strong className="text-foreground">{r.units.nome}</strong></p>
                      )}
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {format(new Date(r.vigencia_inicio + 'T00:00:00'), 'dd/MM/yy')}
                          {' → '}
                          {r.vigencia_fim ? format(new Date(r.vigencia_fim + 'T00:00:00'), 'dd/MM/yy') : 'Sem fim'}
                        </span>
                      </div>
                    </div>

                    <Separator />
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setToggleTarget(r); setConfirmOpen(true); }}>
                        <Power className="h-3.5 w-3.5" /> {r.ativo ? 'Inativar' : 'Ativar'}
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

      {/* Create/Edit Dialog — Simplified */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Incentivo' : 'Novo Incentivo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Indicator */}
            <div className="space-y-1.5">
              <Label className="text-xs">Meta / Indicador *</Label>
              <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Worker type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Colaborador *</Label>
              <div className="flex gap-2">
                {WORKER_TYPES.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                      form.worker_type === o.value
                        ? cn(o.bgClass, 'border-2', o.borderClass, 'shadow-sm')
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                    )}
                    onClick={() => setForm(f => ({ ...f, worker_type: o.value }))}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Unit (optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade (opcional)</Label>
              <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {/* Value */}
            <div className="space-y-1.5">
              <Label className="text-xs">Valor da Bonificação (R$) *</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={form.valor || ''}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                  setForm(f => ({ ...f, valor: v === '' ? 0 : Number(v) }));
                }}
                className="h-9 text-lg font-semibold"
              />
              <p className="text-[10px] text-muted-foreground">Valor pago ao colaborador que atingir esta meta</p>
            </div>

            {/* Validity */}
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

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <Label className="text-sm">Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.indicator_id || !form.valor}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar incentivo' : 'Ativar incentivo'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} este incentivo?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
