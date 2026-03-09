import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useToggleUsuarioAtivo, type UserWithRelations } from '@/hooks/useUsuarios';
import { useUnidades } from '@/hooks/useUnidades';
import { useRotas } from '@/hooks/useRotas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Pencil, Power, Loader2, Users, Truck, UserCheck, BarChart2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const emptyForm = {
  nome: '', email: '', matricula: '', password: '', role: 'colaborador' as string,
  worker_type: 'motorista' as string | null, unidade_id: '' as string | null,
  rota_id: '' as string | null, ativo: true,
};

export default function Colaboradores() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: usuarios = [], isLoading } = useUsuarios({
    nome: filters.search, worker_type: filters.worker_type,
    unidade_id: filters.unidade_id, ativo: filters.ativo,
  });
  const { data: units = [] } = useUnidades();
  const activeUnits = units.filter(u => u.ativo);

  const createMut = useCreateUsuario();
  const updateMut = useUpdateUsuario();
  const toggleMut = useToggleUsuarioAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<UserWithRelations | null>(null);
  const [perfDrawer, setPerfDrawer] = useState<UserWithRelations | null>(null);

  // Routes for selected unit
  const { data: rotasForUnit = [] } = useRotas(form.unidade_id || undefined);
  const activeRoutes = rotasForUnit.filter(r => r.ativo);

  // Summary cards
  const ativos = usuarios.filter(u => u.ativo && u.role === 'colaborador');
  const motoristas = ativos.filter(u => u.worker_type === 'motorista').length;
  const ajudantes = ativos.filter(u => u.worker_type === 'ajudante').length;

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowPassword(false); setDialogOpen(true); };
  const openEdit = (u: UserWithRelations) => {
    setEditing(u);
    setForm({
      nome: u.nome, email: u.email, matricula: u.matricula, password: '',
      role: u.role, worker_type: u.worker_type, unidade_id: u.unidade_id,
      rota_id: u.rota_id, ativo: u.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id, nome: form.nome, email: form.email, matricula: form.matricula.toUpperCase(),
        role: form.role, worker_type: form.role === 'colaborador' ? form.worker_type : null,
        unidade_id: form.unidade_id || null, rota_id: form.rota_id || null, ativo: form.ativo,
      });
    } else {
      await createMut.mutateAsync({
        email: form.email, password: form.password, nome: form.nome,
        matricula: form.matricula.toUpperCase(), role: form.role,
        worker_type: form.role === 'colaborador' ? form.worker_type : null,
        unidade_id: form.unidade_id || null, rota_id: form.rota_id || null,
      });
    }
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false);
    setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const columns: Column<UserWithRelations>[] = [
    {
      key: 'nome', label: 'Colaborador', render: (u) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">{getInitials(u.nome)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{u.nome}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'matricula', label: 'Matrícula', render: (u) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{u.matricula || '—'}</span>
      ),
    },
    {
      key: 'worker_type', label: 'Tipo', render: (u) => {
        if (u.role === 'administrador') return <span className="inline-flex items-center rounded-md bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">Admin</span>;
        if (u.worker_type === 'motorista') return <span className="inline-flex items-center rounded-md bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Motorista</span>;
        return <span className="inline-flex items-center rounded-md bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-medium">Ajudante</span>;
      },
    },
    { key: 'unidade', label: 'Unidade', render: (u) => u.units?.nome ?? '—' },
    { key: 'rota', label: 'Rota', render: (u) => u.routes?.nome ?? '—' },
    { key: 'ativo', label: 'Status', render: (u) => <StatusBadge status={u.ativo ? 'ativo' : 'inativo'} /> },
    {
      key: 'acoes', label: 'Ações', render: (u) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => { setToggleTarget(u); setConfirmOpen(true); }}><Power className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setPerfDrawer(u)}><BarChart2 className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  const canSave = form.nome.length >= 3 && (editing || form.password.length >= 6);

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Colaboradores Ativos', value: ativos.length, icon: Users, color: 'text-primary bg-primary/10' },
          { label: 'Motoristas Ativos', value: motoristas, icon: Truck, color: 'text-emerald-600 bg-emerald-100' },
          { label: 'Ajudantes Ativos', value: ajudantes, icon: UserCheck, color: 'text-purple-600 bg-purple-100' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', card.color)}>
              <card.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <PageHeader title="Colaboradores" subtitle="Gerencie a equipe de entrega" actionLabel="Novo Colaborador" onAction={openCreate} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar nome ou matrícula..."
            value={filters.search ?? ''}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="pl-3"
          />
        </div>
        <Select value={filters.worker_type ?? ''} onValueChange={v => setFilters(f => ({ ...f, worker_type: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="motorista">Motorista</SelectItem>
            <SelectItem value="ajudante">Ajudante</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades</SelectItem>
            {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={usuarios} loading={isLoading} emptyMessage="Nenhum colaborador encontrado" />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Dados Pessoais</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome completo *</Label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} minLength={3} />
                </div>
                <div className="space-y-1">
                  <Label>E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input type="email" placeholder="Deixe vazio para gerar automaticamente" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Matrícula <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} />
                </div>
                {!editing && (
                  <div className="space-y-1">
                    <Label>Senha *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        minLength={6}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Configuração</h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Tipo de Acesso</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="administrador">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.role === 'colaborador' && (
                  <div className="space-y-1">
                    <Label>Tipo de Colaborador</Label>
                    <Select value={form.worker_type ?? 'motorista'} onValueChange={v => setForm(f => ({ ...f, worker_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorista">Motorista</SelectItem>
                        <SelectItem value="ajudante">Ajudante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Unidade</Label>
                  <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v, rota_id: null }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.unidade_id && (
                  <div className="space-y-1">
                    <Label>Rota</Label>
                    <Select value={form.rota_id ?? ''} onValueChange={v => setForm(f => ({ ...f, rota_id: v === 'none' ? null : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {activeRoutes.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Label>Ativo</Label>
                  <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title={toggleTarget?.ativo ? 'Inativar colaborador' : 'Ativar colaborador'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'}
        onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }}
        loading={toggleMut.isPending}
      />

      {/* Performance Drawer */}
      <Sheet open={!!perfDrawer} onOpenChange={o => !o && setPerfDrawer(null)}>
        <SheetContent className="w-full sm:w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Desempenho</SheetTitle>
          </SheetHeader>
          {perfDrawer && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary">{getInitials(perfDrawer.nome)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{perfDrawer.nome}</p>
                  <p className="text-sm text-muted-foreground capitalize">{perfDrawer.worker_type ?? perfDrawer.role}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Dados de indicadores não disponíveis ainda. Implemente o módulo de indicadores para visualizar o desempenho.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
