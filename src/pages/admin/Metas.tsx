import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useMetas, useCreateMeta, useUpdateMeta, useToggleMetaAtivo, type GoalWithRelations } from '@/hooks/useMetas';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useUnidades } from '@/hooks/useUnidades';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil, Power, Loader2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

const PERIODOS = [
  { value: 'diario', label: 'Diário' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
];

const emptyForm = {
  indicator_id: '', unidade_id: '' as string | null, worker_type: '' as string | null,
  user_id: '' as string | null, valor_meta: 0, periodo_tipo: 'diario',
  vigencia_inicio: format(new Date(), 'yyyy-MM-dd'), vigencia_fim: '' as string | null, ativo: true,
};

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
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default function Metas() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [vigentes, setVigentes] = useState(false);
  const { data: metas = [], isLoading } = useMetas({
    indicator_id: filters.indicator_id, worker_type: filters.worker_type,
    unidade_id: filters.unidade_id, ativo: filters.ativo, vigentes,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { data: units = [] } = useUnidades();
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const createMut = useCreateMeta();
  const updateMut = useUpdateMeta();
  const toggleMut = useToggleMetaAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState('tipo');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<GoalWithRelations | null>(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setTab('tipo'); setDialogOpen(true); };
  const openEdit = (g: GoalWithRelations) => {
    setEditing(g);
    setForm({
      indicator_id: g.indicator_id, unidade_id: g.unidade_id ?? '',
      worker_type: g.worker_type ?? '', user_id: g.user_id ?? '',
      valor_meta: g.valor_meta, periodo_tipo: g.periodo_tipo,
      vigencia_inicio: g.vigencia_inicio, vigencia_fim: g.vigencia_fim ?? '', ativo: g.ativo,
    });
    setTab(g.user_id ? 'individual' : 'tipo');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const isIndividual = tab === 'individual';
    const payload = {
      indicator_id: form.indicator_id,
      unidade_id: form.unidade_id || null,
      worker_type: isIndividual ? null : (form.worker_type || null),
      user_id: isIndividual ? (form.user_id || null) : null,
      valor_meta: form.valor_meta,
      periodo_tipo: form.periodo_tipo,
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

  const columns: Column<GoalWithRelations>[] = [
    { key: 'indicador', label: 'Indicador', render: (g) => g.indicators?.nome ?? '—' },
    {
      key: 'tipo', label: 'Aplica-se a', render: (g) => {
        if (g.user_id) return <span className="inline-flex items-center rounded-md bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">Individual</span>;
        if (g.worker_type === 'motorista') return <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Motorista</span>;
        if (g.worker_type === 'ajudante') return <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">Ajudante</span>;
        return <span className="text-muted-foreground text-xs">Geral</span>;
      }
    },
    { key: 'unidade', label: 'Unidade', render: (g) => g.units?.nome ?? '—' },
    { key: 'colaborador', label: 'Colaborador', render: (g) => g.users?.nome ?? '—' },
    { key: 'valor_meta', label: 'Meta', render: (g) => `${g.valor_meta} ${g.indicators?.unidade_medida ?? ''}` },
    { key: 'periodo', label: 'Período', render: (g) => PERIODOS.find(p => p.value === g.periodo_tipo)?.label ?? g.periodo_tipo },
    {
      key: 'vigencia', label: 'Vigência', render: (g) => {
        const ini = format(new Date(g.vigencia_inicio + 'T00:00:00'), 'dd/MM/yy');
        const fim = g.vigencia_fim ? format(new Date(g.vigencia_fim + 'T00:00:00'), 'dd/MM/yy') : '∞';
        return `${ini} → ${fim}`;
      }
    },
    { key: 'ativo', label: 'Status', render: (g) => <StatusBadge status={g.ativo ? 'ativo' : 'inativo'} /> },
    {
      key: 'acoes', label: 'Ações', render: (g) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setToggleTarget(g); setConfirmOpen(true); }}><Power className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  const activeUnits = units.filter(u => u.ativo);
  const activeColabs = usuarios.filter(u => u.role === 'colaborador');

  return (
    <div>
      <PageHeader title="Metas" subtitle="Defina metas para indicadores" actionLabel="Nova Meta" onAction={openCreate} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap items-end">
        <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Indicador" /></SelectTrigger>
          <SelectContent>{[<SelectItem key="all" value="all">Todos</SelectItem>, ...indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)]}</SelectContent>
        </Select>
        <Select value={filters.worker_type ?? ''} onValueChange={v => setFilters(f => ({ ...f, worker_type: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="true">Ativo</SelectItem><SelectItem value="false">Inativo</SelectItem></SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="vigentes" checked={vigentes} onCheckedChange={v => setVigentes(!!v)} />
          <Label htmlFor="vigentes" className="text-sm">Apenas vigentes</Label>
        </div>
      </div>

      <DataTable columns={columns} data={metas} loading={isLoading} emptyMessage="Nenhuma meta encontrada" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Meta' : 'Nova Meta'}</DialogTitle></DialogHeader>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tipo">Por Tipo</TabsTrigger>
              <TabsTrigger value="individual">Individual</TabsTrigger>
            </TabsList>
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label>Indicador *</Label>
                <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <TabsContent value="tipo" className="mt-0 space-y-4">
                <div className="space-y-1">
                  <Label>Tipo de Colaborador</Label>
                  <Select value={form.worker_type ?? ''} onValueChange={v => setForm(f => ({ ...f, worker_type: v === 'none' ? null : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="individual" className="mt-0 space-y-4">
                <div className="space-y-1">
                  <Label>Colaborador *</Label>
                  <Select value={form.user_id ?? ''} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{activeColabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Valor da Meta *</Label>
                  <Input type="number" min={0} value={form.valor_meta} onChange={e => setForm(f => ({ ...f, valor_meta: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label>Período</Label>
                  <Select value={form.periodo_tipo} onValueChange={v => setForm(f => ({ ...f, periodo_tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Início *</Label>
                  <DatePick value={form.vigencia_inicio} onChange={v => setForm(f => ({ ...f, vigencia_inicio: v }))} placeholder="Selecione" />
                </div>
                <div className="space-y-1">
                  <Label>Fim</Label>
                  <DatePick value={form.vigencia_fim ?? ''} onChange={v => setForm(f => ({ ...f, vigencia_fim: v || null }))} placeholder="Sem fim" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label>Ativo</Label>
                <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              </div>
            </div>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.indicator_id || (tab === 'individual' && !form.user_id)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar meta' : 'Ativar meta'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} esta meta?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
