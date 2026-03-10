import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useRotas, useCreateRota, useUpdateRota, useToggleRotaAtivo, type RouteWithUnit } from '@/hooks/useRotas';
import { useUnidades } from '@/hooks/useUnidades';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pencil, Power, Loader2, Route, Building2, Users, CheckCircle2,
  XCircle, Layers, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const emptyForm = { unidade_id: '', nome: '', codigo: '', descricao: '', ativo: true };

export default function Rotas() {
  const [filterUnidade, setFilterUnidade] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('todos');
  const { data: routes = [], isLoading } = useRotas(filterUnidade || undefined);
  const { data: units = [] } = useUnidades();
  const { data: allUsers = [] } = useUsuarios();
  const createMut = useCreateRota();
  const updateMut = useUpdateRota();
  const toggleMut = useToggleRotaAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RouteWithUnit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<RouteWithUnit | null>(null);

  const activeUnits = units.filter(u => u.ativo);

  // Count users per route
  const userCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allUsers.forEach(u => {
      if (u.rota_id) map[u.rota_id] = (map[u.rota_id] || 0) + 1;
    });
    return map;
  }, [allUsers]);

  // Use all routes for KPIs (unfiltered)
  const { data: allRoutes = [] } = useRotas();
  const totalAtivas = allRoutes.filter(r => r.ativo).length;
  const totalInativas = allRoutes.filter(r => !r.ativo).length;
  const unidadesComRotas = new Set(allRoutes.map(r => r.unidade_id)).size;

  const filtered = routes.filter(r => {
    const matchSearch = !search || r.nome.toLowerCase().includes(search.toLowerCase()) || r.codigo.toLowerCase().includes(search.toLowerCase());
    const matchTab = activeTab === 'todos' || (activeTab === 'ativas' && r.ativo) || (activeTab === 'inativas' && !r.ativo);
    return matchSearch && matchTab;
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: RouteWithUnit) => {
    setEditing(r);
    setForm({ unidade_id: r.unidade_id, nome: r.nome, codigo: r.codigo, descricao: r.descricao, ativo: r.ativo });
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
    { label: 'Total de Rotas', value: allRoutes.length, icon: Layers, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Ativas', value: totalAtivas, icon: CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Inativas', value: totalInativas, icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
    { label: 'Unidades c/ Rotas', value: unidadesComRotas, icon: Building2, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderColor: 'border-l-amber-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Rotas" subtitle="Gerencie as rotas de entrega" actionLabel="Nova Rota" onAction={openCreate} />

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

      {/* Tabs + Filters */}
      <div className="flex flex-col gap-3">
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
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterUnidade} onValueChange={v => setFilterUnidade(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-52 h-9 text-xs"><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full sm:w-64 text-xs"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Route className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma rota encontrada</p>
        </div>
      ) : (
        <RotasListPaginated filtered={filtered} userCountMap={userCountMap} openEdit={openEdit} setToggleTarget={setToggleTarget} setConfirmOpen={setConfirmOpen} />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Unidade *</Label>
              <Select value={form.unidade_id} onValueChange={v => setForm(f => ({ ...f, unidade_id: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código *</Label>
                <Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} className="h-9 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} className="resize-none" />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <Label className="text-sm">Rota Ativa</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.nome || !form.codigo || !form.unidade_id}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar rota' : 'Ativar rota'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} a rota "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
