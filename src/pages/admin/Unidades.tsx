import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { FilterBar } from '@/components/shared/FilterBar';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useUnidades, useCreateUnidade, useUpdateUnidade, useToggleUnidadeAtivo } from '@/hooks/useUnidades';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Pencil, Power, Loader2 } from 'lucide-react';
import type { Unit } from '@/types';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const emptyUnit = { nome: '', codigo: '', cidade: '', estado: '', ativo: true };

export default function Unidades() {
  const { data: units = [], isLoading } = useUnidades();
  const createMut = useCreateUnidade();
  const updateMut = useUpdateUnidade();
  const toggleMut = useToggleUnidadeAtivo();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<Unit> | null>(null);
  const [form, setForm] = useState(emptyUnit);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Unit | null>(null);

  const filtered = units.filter(u =>
    u.nome.toLowerCase().includes(search.toLowerCase()) ||
    u.codigo.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingUnit(null);
    setForm(emptyUnit);
    setDialogOpen(true);
  };

  const openEdit = (u: Unit) => {
    setEditingUnit(u);
    setForm({ nome: u.nome, codigo: u.codigo, cidade: u.cidade, estado: u.estado, ativo: u.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, codigo: form.codigo.toUpperCase() };
    if (editingUnit?.id) {
      await updateMut.mutateAsync({ id: editingUnit.id, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const handleToggle = (u: Unit) => {
    setToggleTarget(u);
    setConfirmOpen(true);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false);
    setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const columns: Column<Unit>[] = [
    { key: 'nome', label: 'Nome' },
    { key: 'codigo', label: 'Código', render: (u) => <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{u.codigo}</span> },
    { key: 'cidade', label: 'Cidade' },
    { key: 'estado', label: 'Estado' },
    { key: 'ativo', label: 'Status', render: (u) => <StatusBadge status={u.ativo ? 'ativo' : 'inativo'} /> },
    {
      key: 'acoes', label: 'Ações', render: (u) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleToggle(u)}><Power className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader title="Unidades" subtitle="Gerencie as unidades de operação" actionLabel="Nova Unidade" onAction={openCreate} />
      <FilterBar
        filters={[{ key: 'search', label: 'Buscar por nome ou código...', type: 'search' }]}
        values={{ search }}
        onChange={(_, v) => setSearch(v)}
      />
      <DataTable columns={columns} data={filtered as unknown as Record<string, unknown>[]} loading={isLoading} emptyMessage="Nenhuma unidade encontrada" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} minLength={2} required />
            </div>
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} required />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nome || !form.codigo}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title={toggleTarget?.ativo ? 'Inativar unidade' : 'Ativar unidade'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} a unidade "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'}
        onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }}
        loading={toggleMut.isPending}
      />
    </div>
  );
}
