import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useToggleUsuarioAtivo, type UserWithRelations } from '@/hooks/useUsuarios';
import { useUnidades } from '@/hooks/useUnidades';
import { useRotas } from '@/hooks/useRotas';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Pencil, Power, Loader2, Users, Truck, UserCheck, BarChart2,
  Eye, EyeOff, Building2, MapPin, Mail, Hash, Shield, Layers,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const emptyForm = {
  nome: '', email: '', matricula: '', password: '', role: 'colaborador' as string,
  worker_type: 'motorista' as string | null, unidade_id: '' as string | null,
  rota_id: '' as string | null, ativo: true, unit_ids: [] as string[],
};

export default function Colaboradores() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: usuarios = [], isLoading } = useUsuarios({
    nome: filters.search, worker_type: activeTab !== 'todos' && activeTab !== 'admins' ? activeTab : filters.worker_type,
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

  const primaryUnitId = form.unit_ids.length > 0 ? form.unit_ids[0] : undefined;
  const { data: rotasForUnit = [] } = useRotas(primaryUnitId);
  const activeRoutes = rotasForUnit.filter(r => r.ativo);

  // KPIs from all users (unfiltered)
  const { data: allUsers = [] } = useUsuarios();
  const totalAtivos = allUsers.filter(u => u.ativo).length;
  const totalInativos = allUsers.filter(u => !u.ativo).length;
  const motoristas = allUsers.filter(u => u.ativo && u.worker_type === 'motorista').length;
  const ajudantes = allUsers.filter(u => u.ativo && u.worker_type === 'ajudante').length;
  const admins = allUsers.filter(u => u.role === 'administrador').length;

  // Filter by tab
  const filteredByTab = useMemo(() => {
    if (activeTab === 'admins') return usuarios.filter(u => u.role === 'administrador');
    return usuarios;
  }, [usuarios, activeTab]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowPassword(false); setDialogOpen(true); };
  const openEdit = (u: UserWithRelations) => {
    setEditing(u);
    setForm({
      nome: u.nome, email: u.email, matricula: u.matricula, password: '',
      role: u.role, worker_type: u.worker_type, unidade_id: u.unidade_id,
      rota_id: u.rota_id, ativo: u.ativo,
      unit_ids: u.user_units?.map(uu => uu.unit_id) ?? (u.unidade_id ? [u.unidade_id] : []),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const primaryUnit = form.unit_ids.length > 0 ? form.unit_ids[0] : null;
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id, nome: form.nome, email: form.email, matricula: form.matricula.toUpperCase(),
        role: form.role, worker_type: form.role === 'colaborador' ? form.worker_type : null,
        unidade_id: primaryUnit, rota_id: form.rota_id || null, ativo: form.ativo,
        unit_ids: form.unit_ids,
      });
    } else {
      const emailToUse = form.email.trim() || `${form.nome.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@app.local`;
      await createMut.mutateAsync({
        email: emailToUse, password: form.password, nome: form.nome,
        matricula: form.matricula.toUpperCase(), role: form.role,
        worker_type: form.role === 'colaborador' ? form.worker_type : null,
        unidade_id: primaryUnit, rota_id: form.rota_id || null,
        unit_ids: form.unit_ids,
      });
    }
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false); setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;
  const canSave = form.nome.length >= 3 && (editing || form.password.length >= 6);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const kpis = [
    { label: 'Total Ativos', value: totalAtivos, icon: CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Motoristas', value: motoristas, icon: Truck, iconBg: 'bg-green-100', iconColor: 'text-green-600', borderColor: 'border-l-green-500' },
    { label: 'Ajudantes', value: ajudantes, icon: UserCheck, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
    { label: 'Inativos', value: totalInativos, icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Colaboradores" subtitle="Gerencie a equipe de entrega" actionLabel="Novo Colaborador" onAction={openCreate} />

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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="motorista" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Motoristas
            </TabsTrigger>
            <TabsTrigger value="ajudante" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Ajudantes
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Admins
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar nome ou matrícula..."
            value={filters.search ?? ''}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="h-9 w-full sm:w-64 text-xs"
          />
          <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Ativo</SelectItem>
              <SelectItem value="false">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredByTab.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum colaborador encontrado</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
          {filteredByTab.map(u => {
            const isMot = u.worker_type === 'motorista';
            const isAdmin = u.role === 'administrador';
            return (
              <div key={u.id} className={cn('flex items-center gap-4 px-5 py-4 transition-colors group', !u.ativo && 'opacity-50')}>
                {/* Avatar */}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className={cn(
                    'text-xs font-bold',
                    isAdmin ? 'bg-amber-100 text-amber-700' : isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                  )}>
                    {getInitials(u.nome)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm text-foreground truncate">{u.nome}</span>
                    {u.matricula && (
                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold font-mono text-muted-foreground">
                        {u.matricula}
                      </span>
                    )}
                    <span className={cn(
                      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      isAdmin ? 'bg-amber-100 text-amber-700' : isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                    )}>
                      {isAdmin ? 'Admin' : isMot ? 'Motorista' : 'Ajudante'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Mail className="h-3 w-3" />{u.email}
                    </span>
                    {(u.user_units && u.user_units.length > 0) ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {u.user_units.map(uu => uu.units?.nome).filter(Boolean).join(', ')}
                      </span>
                    ) : u.units?.nome ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Building2 className="h-3 w-3" />{u.units.nome}
                      </span>
                    ) : null}
                    {u.routes?.nome && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hidden sm:inline-flex">
                        <MapPin className="h-3 w-3" />{u.routes.nome}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={u.ativo ? 'ativo' : 'inativo'} />
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setToggleTarget(u); setConfirmOpen(true); }}>
                      <Power className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPerfDrawer(u)}>
                      <BarChart2 className="h-4 w-4 text-muted-foreground" />
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-6">
            {/* Dados Pessoais */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Dados Pessoais</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail</Label>
                    <Input type="email" placeholder="Gerar auto" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Matrícula</Label>
                    <Input value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} className="h-9 font-mono" />
                  </div>
                </div>
                {!editing && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Senha *</Label>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="h-9 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Mínimo de 6 caracteres</p>
                  </div>
                )}
              </div>
            </div>

            {/* Configuração */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Configuração</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Acesso</Label>
                  <div className="flex gap-2">
                    {[
                      { v: 'colaborador', l: 'Colaborador', bg: 'bg-primary/10 text-primary border-primary/30' },
                      { v: 'administrador', l: 'Administrador', bg: 'bg-amber-100 text-amber-700 border-amber-300' },
                    ].map(o => (
                      <button key={o.v} type="button"
                        className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                          form.role === o.v ? cn(o.bg, 'border-2 shadow-sm') : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        )}
                        onClick={() => setForm(f => ({ ...f, role: o.v }))}
                      >{o.l}</button>
                    ))}
                  </div>
                </div>

                {form.role === 'colaborador' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Colaborador</Label>
                    <div className="flex gap-2">
                      {[
                        { v: 'motorista', l: 'Motorista', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                        { v: 'ajudante', l: 'Ajudante', bg: 'bg-violet-100 text-violet-700 border-violet-300' },
                      ].map(o => (
                        <button key={o.v} type="button"
                          className={cn('flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                            form.worker_type === o.v ? cn(o.bg, 'border-2 shadow-sm') : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                          )}
                          onClick={() => setForm(f => ({ ...f, worker_type: o.v }))}
                        >{o.l}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unidade</Label>
                    <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v, rota_id: null }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.unidade_id && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Rota</Label>
                      <Select value={form.rota_id ?? ''} onValueChange={v => setForm(f => ({ ...f, rota_id: v === 'none' ? null : v }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhuma</SelectItem>
                          {activeRoutes.map(r => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <Label className="text-sm">Colaborador Ativo</Label>
                  <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                </div>
              </div>
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar colaborador' : 'Ativar colaborador'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />

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
              <p className="text-sm text-muted-foreground">Dados de indicadores não disponíveis ainda.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
