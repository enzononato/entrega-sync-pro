import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useRotas, useCreateRota, useUpdateRota, useToggleRotaAtivo, type RouteWithUnit } from '@/hooks/useRotas';
import { useUnidades } from '@/hooks/useUnidades';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Pencil, Power, Loader2 } from 'lucide-react';

const emptyForm = { unidade_id: '', nome: '', codigo: '', descricao: '', ativo: true };

export default function Rotas() {
  const [filterUnidade, setFilterUnidade] = useState('');
  const [search, setSearch] = useState('');
  const { data: routes = [], isLoading } = useRotas(filterUnidade || undefined);
  const { data: units = [] } = useUnidades();
  const createMut = useCreateRota();
  const updateMut = useUpdateRota();
  const toggleMut = useToggleRotaAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RouteWithUnit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<RouteWithUnit | null>(null);

  const filtered = routes.filter(r =>
    r.nome.toLowerCase().includes(search.toLowerCase()) ||
    r.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const activeUnits = units.filter(u => u.ativo);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: RouteWithUnit) => {
    setEditing(r);
    setForm({ unidade_id: r.unidade_id, nome: r.nome, codigo: r.codigo, descricao: r.descricao, ativo: r.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, codigo: form.codigo.toUpperCase() };
    if (editing?.id) {
      await updateMut.mutateAsync({ id: editing.id, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false);
    setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const columns: Column<RouteWithUnit>[] = [
    { key: 'nome', label: 'Nome' },
    { key: 'codigo', label: 'Código', render: (r) => <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.codigo}</span> },
    { key: 'unidade', label: 'Unidade', render: (r) => r.units?.nome ?? '—' },
    { key: 'descricao', label: 'Descrição', render: (r) => r.descricao.length > 40 ? r.descricao.slice(0, 40) + '…' : (r.descricao || '—') },
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
      <PageHeader title="Rotas" subtitle="Gerencie as rotas de entrega" actionLabel="Nova Rota" onAction={openCreate} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={filterUnidade} onValueChange={setFilterUnidade}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <FilterBar
          filters={[{ key: 'search', label: 'Buscar por nome ou código...', type: 'search' }]}
          values={{ search }}
          onChange={(_, v) => setSearch(v)}
        />
      </div>
      <DataTable columns={columns} data={filtered} loading={isLoading} emptyMessage="Nenhuma rota encontrada" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Unidade *</Label>
              <Select value={form.unidade_id} onValueChange={v => setForm(f => ({ ...f, unidade_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nome || !form.codigo || !form.unidade_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title={toggleTarget?.ativo ? 'Inativar rota' : 'Ativar rota'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} a rota "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'}
        onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }}
        loading={toggleMut.isPending}
      />
    </div>
  );
}
