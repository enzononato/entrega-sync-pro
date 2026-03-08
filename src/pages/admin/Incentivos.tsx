import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useIncentivos, useCreateIncentivo, useUpdateIncentivo, useToggleIncentivoAtivo, type IncentiveRuleWithRelations } from '@/hooks/useIncentivos';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useUnidades } from '@/hooks/useUnidades';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pencil, Power, Loader2, CalendarIcon } from 'lucide-react';
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

const emptyForm = {
  indicator_id: '', worker_type: 'motorista', unidade_id: '' as string | null,
  peso: 1, meta: 0, valor_minimo: 0, valor_maximo: 0,
  descricao_regra: '', vigencia_inicio: format(new Date(), 'yyyy-MM-dd'),
  vigencia_fim: '' as string | null, ativo: true,
};

export default function Incentivos() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: regras = [], isLoading } = useIncentivos({
    worker_type: filters.worker_type, indicator_id: filters.indicator_id,
    unidade_id: filters.unidade_id, ativo: filters.ativo,
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

  // Simulation
  const simulate = useMemo(() => {
    if (!form.meta || !form.valor_maximo) return null;
    const range = form.valor_maximo - form.valor_minimo;
    return {
      abaixo: Math.max(form.valor_minimo, form.valor_minimo + range * 0.3).toFixed(2),
      meta: ((form.valor_minimo + form.valor_maximo) / 2).toFixed(2),
      acima: form.valor_maximo.toFixed(2),
    };
  }, [form.meta, form.valor_minimo, form.valor_maximo]);

  const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const columns: Column<IncentiveRuleWithRelations>[] = [
    { key: 'indicador', label: 'Indicador', render: (r) => r.indicators?.nome ?? '—' },
    {
      key: 'worker_type', label: 'Tipo', render: (r) =>
        r.worker_type === 'motorista' ? <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Motorista</span>
          : <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">Ajudante</span>
    },
    { key: 'peso', label: 'Peso' },
    { key: 'meta', label: 'Meta' },
    { key: 'valor_minimo', label: 'Mín', render: (r) => fmtBRL(r.valor_minimo) },
    { key: 'valor_maximo', label: 'Máx', render: (r) => fmtBRL(r.valor_maximo) },
    {
      key: 'vigencia', label: 'Vigência', render: (r) => {
        const ini = format(new Date(r.vigencia_inicio + 'T00:00:00'), 'dd/MM/yy');
        const fim = r.vigencia_fim ? format(new Date(r.vigencia_fim + 'T00:00:00'), 'dd/MM/yy') : '∞';
        return `${ini} → ${fim}`;
      }
    },
    { key: 'ativo', label: 'Status', render: (r) => <StatusBadge status={r.ativo ? 'ativo' : 'inativo'} /> },
    {
      key: 'acoes', label: 'Ações', render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setToggleTarget(r); setConfirmOpen(true); }}><Power className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader title="Regras de Incentivo" subtitle="Configure as regras de bonificação" actionLabel="Nova Regra" onAction={openCreate} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <Select value={filters.worker_type ?? ''} onValueChange={v => setFilters(f => ({ ...f, worker_type: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
        </Select>
        <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Indicador" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="true">Ativo</SelectItem><SelectItem value="false">Inativo</SelectItem></SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={regras} loading={isLoading} emptyMessage="Nenhuma regra encontrada" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Regra' : 'Nova Regra'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-2">
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Indicador *</Label>
                  <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo *</Label>
                  <Select value={form.worker_type} onValueChange={v => setForm(f => ({ ...f, worker_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="motorista">Motorista</SelectItem><SelectItem value="ajudante">Ajudante</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Peso</Label><Input type="number" min={0.1} step={0.1} value={form.peso} onChange={e => setForm(f => ({ ...f, peso: Number(e.target.value) }))} /></div>
                <div className="space-y-1"><Label>Meta Ref.</Label><Input type="number" value={form.meta} onChange={e => setForm(f => ({ ...f, meta: Number(e.target.value) }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Valor Mínimo (R$)</Label><Input type="number" min={0} step={0.01} value={form.valor_minimo} onChange={e => setForm(f => ({ ...f, valor_minimo: Number(e.target.value) }))} /></div>
                <div className="space-y-1"><Label>Valor Máximo (R$)</Label><Input type="number" min={0} step={0.01} value={form.valor_maximo} onChange={e => setForm(f => ({ ...f, valor_maximo: Number(e.target.value) }))} /></div>
              </div>
              <div className="space-y-1"><Label>Descrição da Regra</Label><Textarea value={form.descricao_regra} onChange={e => setForm(f => ({ ...f, descricao_regra: e.target.value }))} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Início *</Label><DatePick value={form.vigencia_inicio} onChange={v => setForm(f => ({ ...f, vigencia_inicio: v }))} placeholder="Selecione" /></div>
                <div className="space-y-1"><Label>Fim</Label><DatePick value={form.vigencia_fim ?? ''} onChange={v => setForm(f => ({ ...f, vigencia_fim: v || null }))} placeholder="Sem fim" /></div>
              </div>
              <div className="flex items-center gap-3"><Label>Ativo</Label><Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} /></div>
            </div>
            {/* Simulation card */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Simulação</h4>
              {simulate ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm"><span className="text-red-600">Abaixo da meta</span><span className="font-mono">R$ {simulate.abaixo}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-primary">Na meta</span><span className="font-mono">R$ {simulate.meta}</span></div>
                    <div className="flex items-center justify-between text-sm"><span className="text-emerald-600">Acima da meta</span><span className="font-mono">R$ {simulate.acima}</span></div>
                  </div>
                </>
              ) : <p className="text-xs text-muted-foreground">Preencha meta e valores para ver a simulação.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.indicator_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar regra' : 'Ativar regra'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} esta regra?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
