import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
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
import { Pencil, Power, Loader2 } from 'lucide-react';

const CATEGORIAS = ['Tempo', 'Qualidade', 'Eficiência', 'Operação', 'Financeiro', 'Satisfação', 'Jornada'];
const UNIDADES_MEDIDA = ['minutos', 'horas', '%', 'qtd', 'R$', 'nota'];

const emptyForm = { codigo: '', nome: '', categoria: '', unidade_medida: '', descricao: '', applies_to_worker_type: 'ambos', ativo: true };

const workerBadge = (t: string) => {
  if (t === 'motorista') return <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Motorista</span>;
  if (t === 'ajudante') return <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">Ajudante</span>;
  return <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">Ambos</span>;
};

export default function Indicadores() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: indicators = [], isLoading } = useIndicadores({ ativo: filters.ativo });
  const createMut = useCreateIndicador();
  const updateMut = useUpdateIndicador();
  const toggleMut = useToggleIndicadorAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<IndicatorRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<IndicatorRow | null>(null);

  const filtered = indicators.filter(i => {
    const s = filters.search?.toLowerCase() ?? '';
    const matchSearch = !s || i.nome.toLowerCase().includes(s) || i.codigo.toLowerCase().includes(s);
    const matchType = !filters.applies_to || filters.applies_to === 'all' || i.applies_to_worker_type === filters.applies_to;
    const matchCat = !filters.categoria || filters.categoria === 'all' || i.categoria === filters.categoria;
    return matchSearch && matchType && matchCat;
  });

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

  const columns: Column<IndicatorRow>[] = [
    { key: 'codigo', label: 'Código', render: (i) => <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{i.codigo}</span> },
    { key: 'nome', label: 'Nome' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'applies_to_worker_type', label: 'Aplica-se a', render: (i) => workerBadge(i.applies_to_worker_type) },
    { key: 'unidade_medida', label: 'Unidade' },
    { key: 'ativo', label: 'Status', render: (i) => <StatusBadge status={i.ativo ? 'ativo' : 'inativo'} /> },
    {
      key: 'acoes', label: 'Ações', render: (i) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setToggleTarget(i); setConfirmOpen(true); }}><Power className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader title="Indicadores" subtitle="Gerencie os indicadores de desempenho" actionLabel="Novo Indicador" onAction={openCreate} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <Input placeholder="Buscar nome ou código..." value={filters.search ?? ''} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} className="flex-1 min-w-[200px]" />
        <Select value={filters.applies_to ?? ''} onValueChange={v => setFilters(f => ({ ...f, applies_to: v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Aplica-se a" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="motorista">Motorista</SelectItem>
            <SelectItem value="ajudante">Ajudante</SelectItem>
            <SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.categoria ?? ''} onValueChange={v => setFilters(f => ({ ...f, categoria: v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} loading={isLoading} emptyMessage="Nenhum indicador encontrado" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Indicador' : 'Novo Indicador'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Código *</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unidade de Medida</Label>
                <Select value={form.unidade_medida} onValueChange={v => setForm(f => ({ ...f, unidade_medida: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{UNIDADES_MEDIDA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1">
              <Label>Aplica-se a *</Label>
              <div className="flex gap-2">
                {[{ v: 'motorista', l: 'Motorista' }, { v: 'ajudante', l: 'Ajudante' }, { v: 'ambos', l: 'Ambos' }].map(o => (
                  <Button key={o.v} type="button" variant={form.applies_to_worker_type === o.v ? 'default' : 'outline'} size="sm"
                    onClick={() => setForm(f => ({ ...f, applies_to_worker_type: o.v }))}>{o.l}</Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.codigo || !form.nome}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar indicador' : 'Ativar indicador'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
