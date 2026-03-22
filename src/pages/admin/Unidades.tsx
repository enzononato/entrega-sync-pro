import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useUnidades, useCreateUnidade, useUpdateUnidade, useToggleUnidadeAtivo } from '@/hooks/useUnidades';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pencil, Power, Loader2, Building2, MapPin, Users, CheckCircle2, XCircle, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Unit } from '@/types';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const emptyUnit = { nome: '', codigo: '', cidade: '', estado: '', ativo: true };

export default function Unidades() {
  const { data: units = [], isLoading } = useUnidades();
  const { data: allUsers = [] } = useUsuarios();
  const createMut = useCreateUnidade();
  const updateMut = useUpdateUnidade();
  const toggleMut = useToggleUnidadeAtivo();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<Unit> | null>(null);
  const [form, setForm] = useState(emptyUnit);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<Unit | null>(null);

  // Count users per unit
  const userCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allUsers.forEach(u => {
      if (u.unidade_id) map[u.unidade_id] = (map[u.unidade_id] || 0) + 1;
    });
    return map;
  }, [allUsers]);

  const totalUsers = allUsers.length;
  const totalAtivas = units.filter(u => u.ativo).length;
  const totalInativas = units.filter(u => !u.ativo).length;
  const estados = new Set(units.map(u => u.estado).filter(Boolean));

  const filtered = units.filter(u => {
    const matchSearch = !search || u.nome.toLowerCase().includes(search.toLowerCase()) || u.codigo.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'todos' || (activeTab === 'ativas' && u.ativo) || (activeTab === 'inativas' && !u.ativo);
    return matchSearch && matchTab;
  });
  const pg = usePagination(filtered);

  const openCreate = () => { setEditingUnit(null); setForm(emptyUnit); setDialogOpen(true); };
  const openEdit = (u: Unit) => {
    setEditingUnit(u);
    setForm({ nome: u.nome, codigo: u.codigo, cidade: u.cidade, estado: u.estado, ativo: u.ativo });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, codigo: form.codigo.toUpperCase() };
    if (editingUnit?.id) await updateMut.mutateAsync({ id: editingUnit.id, ...payload });
    else await createMut.mutateAsync(payload);
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false); setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const kpis = [
    { label: 'Total de Unidades', value: units.length, icon: Layers, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Ativas', value: totalAtivas, icon: CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Inativas', value: totalInativas, icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
    { label: 'Estados', value: estados.size, icon: MapPin, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderColor: 'border-l-amber-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Unidades" subtitle="Gerencie as unidades de operação" actionLabel="Nova Unidade" onAction={openCreate} />

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

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="ativas" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ativas
            </TabsTrigger>
            <TabsTrigger value="inativas" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Inativas
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 w-full sm:w-64 text-xs"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma unidade encontrada</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            {pg.paginatedItems.map(u => {
              const count = userCountMap[u.id] || 0;
              return (
                <div key={u.id} className={cn('flex items-center gap-4 px-5 py-4 transition-colors group', !u.ativo && 'opacity-50')}>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-5 w-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-foreground truncate">{u.nome}</span>
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary font-mono">{u.codigo}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {u.cidade && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" />{u.cidade}{u.estado ? `, ${u.estado}` : ''}</span>}
                      <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium', count > 0 ? 'text-emerald-600' : 'text-muted-foreground')}><Users className="h-3 w-3" />{count} colaborador{count !== 1 ? 'es' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={u.ativo ? 'ativo' : 'inativo'} />
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Pencil className="h-4 w-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setToggleTarget(u); setConfirmOpen(true); }}><Power className="h-4 w-4 text-muted-foreground" /></Button>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUnit ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Código *</Label>
              <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} className="h-9 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <Label className="text-sm">Unidade Ativa</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nome || !form.codigo}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar unidade' : 'Ativar unidade'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} a unidade "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
