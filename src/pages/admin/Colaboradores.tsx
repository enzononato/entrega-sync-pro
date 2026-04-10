import { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { validateCpf, formatCpf } from '@/lib/formatters';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useUsuarios, useUsuariosPaginated, useCreateUsuario, useUpdateUsuario, useToggleUsuarioAtivo, DEFAULT_PAGE_SIZE, type UserWithRelations } from '@/hooks/useUsuarios';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';

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
  Eye, EyeOff, Building2, MapPin, Hash, Shield,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, Upload, Package, KeyRound,
} from 'lucide-react';
import { ImportColaboradoresDialog } from '@/components/admin/ImportColaboradoresDialog';
import { ImportMatriculasDialog } from '@/components/admin/ImportMatriculasDialog';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { formatMinutesHHMM } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const emptyForm = {
  nome: '', matricula: '', cpf: '', password: '',
  worker_type: 'motorista' as string | null, unidade_id: '' as string | null,
  ativo: true, unit_ids: [] as string[],
};

export default function Colaboradores() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const [page, setPage] = useState(0);
  const { data: paginatedResult, isLoading } = useUsuariosPaginated({
    nome: filters.search, worker_type: activeTab !== 'todos' ? activeTab : filters.worker_type,
    unidade_id: filters.unidade_id, ativo: filters.ativo, page, pageSize: DEFAULT_PAGE_SIZE,
  });
  const usuarios = paginatedResult?.data ?? [];
  const totalCount = paginatedResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / DEFAULT_PAGE_SIZE);
  
  const { allowedUnits } = useAllowedUnits();

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
  const [importOpen, setImportOpen] = useState(false);
  const [importMatriculasOpen, setImportMatriculasOpen] = useState(false);
  const [resetPwTarget, setResetPwTarget] = useState<UserWithRelations | null>(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);


  // KPIs from all users (unfiltered)
  const { data: allUsers = [] } = useUsuarios();
  // Exclude admins from collaborator lists
  const colaboradores = allUsers.filter(u => u.role !== 'administrador');
  const totalAtivos = colaboradores.filter(u => u.ativo).length;
  const totalInativos = colaboradores.filter(u => !u.ativo).length;
  const motoristas = colaboradores.filter(u => u.ativo && u.worker_type === 'motorista').length;
  const ajudantes = colaboradores.filter(u => u.ativo && u.worker_type === 'ajudante').length;

  // Filter out admins from paginated results
  const filteredByTab = useMemo(() => {
    return usuarios.filter(u => u.role !== 'administrador');
  }, [usuarios]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowPassword(false); setDialogOpen(true); };
  const openEdit = (u: UserWithRelations) => {
    setEditing(u);
    setForm({
      nome: u.nome, matricula: u.matricula, cpf: u.cpf || '', password: '',
      worker_type: u.worker_type, unidade_id: u.unidade_id,
      ativo: u.ativo,
      unit_ids: u.user_units?.map(uu => uu.unit_id) ?? (u.unidade_id ? [u.unidade_id] : []),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const primaryUnit = form.unit_ids.length > 0 ? form.unit_ids[0] : null;
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id, nome: form.nome, email: editing.email, matricula: form.matricula.toUpperCase(),
        cpf: form.cpf || null,
        role: 'colaborador', worker_type: form.worker_type,
        unidade_id: primaryUnit, rota_id: null, ativo: form.ativo,
        unit_ids: form.unit_ids,
      });
    } else {
      const emailToUse = `${form.matricula.toLowerCase()}.${Date.now()}@app.local`;
      await createMut.mutateAsync({
        email: emailToUse, password: form.password, nome: form.nome,
        matricula: form.matricula.toUpperCase(),
        cpf: form.cpf || null,
        role: 'colaborador',
        worker_type: form.worker_type,
        unidade_id: primaryUnit, rota_id: null,
        unit_ids: form.unit_ids,
      });
    }
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false); setToggleTarget(null);
  };

  const { toast } = useToast();

  const handleResetPassword = async () => {
    if (!resetPwTarget || newPassword.length < 6) return;
    setResetPwLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-password', {
        body: { auth_user_id: resetPwTarget.auth_user_id, new_password: newPassword },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: 'Senha redefinida com sucesso' });
      setResetPwOpen(false);
      setNewPassword('');
      setResetPwTarget(null);
    } catch (e: any) {
      toast({ title: 'Erro ao redefinir senha', description: e.message, variant: 'destructive' });
    } finally {
      setResetPwLoading(false);
    }
  };

  const cpfValid = !form.cpf || validateCpf(form.cpf);
  const canSave = form.nome.length >= 3 && form.matricula.length >= 1 && (editing || form.password.length >= 6) && cpfValid && form.unit_ids.length > 0;
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const kpis = [
    { label: 'Total Ativos', value: totalAtivos, icon: CheckCircle2, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Motoristas', value: motoristas, icon: Truck, iconBg: 'bg-green-100', iconColor: 'text-green-600', borderColor: 'border-l-green-500' },
    { label: 'Ajudantes', value: ajudantes, icon: UserCheck, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
    { label: 'Inativos', value: totalInativos, icon: XCircle, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PageHeader title="Colaboradores" subtitle="Gerencie a equipe de entrega" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setImportMatriculasOpen(true)}>
            <Hash className="h-4 w-4" /> Matrículas
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button onClick={openCreate} className="rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-all hover:shadow-lg gap-2">
            <Users className="h-4 w-4" /> Novo Colaborador
          </Button>
        </div>
      </div>

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
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setPage(0); }}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="motorista" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Motoristas
            </TabsTrigger>
            <TabsTrigger value="ajudante" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Ajudantes
            </TabsTrigger>
            <TabsTrigger value="distribuicao" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Distribuição
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar nome, CPF ou matrícula..."
            value={filters.search ?? ''}
            onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(0); }}
            className="h-9 w-full sm:w-64 text-xs"
          />
          <Select value={filters.unidade_id ?? ''} onValueChange={v => { setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v })); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {allowedUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.ativo ?? ''} onValueChange={v => { setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v })); setPage(0); }}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredByTab.map(u => {
            const isMot = u.worker_type === 'motorista';
            const isDist = u.worker_type === 'distribuicao';
            const unitNames = u.user_units?.map(uu => uu.units?.nome).filter(Boolean).join(', ') || u.units?.nome || '';
            const borderTop = isMot ? 'border-t-emerald-400' : isDist ? 'border-t-blue-400' : 'border-t-violet-400';
            const badgeBg = isMot ? 'bg-emerald-100 text-emerald-700' : isDist ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700';
            const typeLabel = isMot ? 'Motorista' : isDist ? 'Distribuição' : 'Ajudante';
            const TypeIcon = isMot ? Truck : isDist ? Package : UserCheck;
            return (
              <div
                key={u.id}
                className={cn(
                  'rounded-xl border bg-card shadow-sm overflow-hidden transition-all hover:shadow-md',
                  !u.ativo && 'opacity-50',
                  'border-t-[3px]', borderTop
                )}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0 ring-2 ring-background shadow-sm">
                      <AvatarFallback className={cn('text-xs font-bold', badgeBg)}>
                        {getInitials(u.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{u.nome}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          badgeBg
                        )}>
                          <TypeIcon className="h-3 w-3" />
                          {typeLabel}
                        </span>
                        <StatusBadge status={u.ativo ? 'ativo' : 'inativo'} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3 space-y-1.5">
                  {u.matricula && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span className="font-mono font-medium">{u.matricula}</span>
                    </div>
                  )}
                  {unitNames && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{unitNames}</span>
                    </div>
                  )}
                  {u.cpf && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Shield className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{u.cpf}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-border/50 bg-muted/20">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => setPerfDrawer(u)}>
                    <BarChart2 className="h-3.5 w-3.5" /> Desempenho
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setToggleTarget(u); setConfirmOpen(true); }}>
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {page * DEFAULT_PAGE_SIZE + 1}–{Math.min((page + 1) * DEFAULT_PAGE_SIZE, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
                    <Label className="text-xs">Matrícula *</Label>
                    <Input value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value.toUpperCase() }))} className="h-9 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF</Label>
                    <Input
                      placeholder="000.000.000-00"
                      value={form.cpf}
                      onChange={e => setForm(f => ({ ...f, cpf: formatCpf(e.target.value) }))}
                      className="h-9 font-mono"
                    />
                    {form.cpf && !cpfValid && <p className="text-[10px] text-destructive">CPF inválido — verifique os dígitos</p>}
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
                  <Label className="text-xs">Tipo de Colaborador</Label>
                    <div className="flex gap-2">
                      {[
                        { v: 'motorista', l: 'Motorista', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                        { v: 'ajudante', l: 'Ajudante', bg: 'bg-violet-100 text-violet-700 border-violet-300' },
                        { v: 'distribuicao', l: 'Distribuição', bg: 'bg-blue-100 text-blue-700 border-blue-300' },
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

                <div className="space-y-1.5">
                  <Label className="text-xs">Revenda *</Label>
                  <Select value={form.unit_ids[0] ?? ''} onValueChange={v => setForm(f => ({ ...f, unit_ids: v ? [v] : [] }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a revenda" /></SelectTrigger>
                    <SelectContent>
                      {allowedUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {editing && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <Label className="text-sm">Colaborador Ativo</Label>
                    <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                  </div>
                )}
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
          {perfDrawer && <PerfDrawerContent user={perfDrawer} getInitials={getInitials} />}
        </SheetContent>
      </Sheet>

      <ImportColaboradoresDialog open={importOpen} onOpenChange={setImportOpen} />
      <ImportMatriculasDialog open={importMatriculasOpen} onOpenChange={setImportMatriculasOpen} />
    </div>
  );
}

/* ── Performance Drawer Content ── */
function PerfDrawerContent({ user, getInitials }: { user: UserWithRelations; getInitials: (n: string) => string }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const { data: desempenho = [], isLoading } = useDesempenhoDiario(dateStart, dateEnd, { user_id: user.id });

  // Group by mapa
  const groupedByMapa = useMemo(() => {
    const map = new Map<string, typeof desempenho>();
    desempenho.forEach(d => {
      const key = d.mapa_numero ?? 'manual';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [desempenho]);

  const okCount = desempenho.filter(d => d.status === 'dentro_meta' || d.status === 'acima_meta').length;
  const isMot = user.worker_type === 'motorista';

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className={cn('text-xs font-bold', isMot ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700')}>
            {getInitials(user.nome)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{user.nome}</p>
          <p className="text-sm text-muted-foreground capitalize">{user.worker_type ?? user.role}</p>
          {user.matricula && <p className="text-xs text-muted-foreground font-mono">Mat: {user.matricula}</p>}
        </div>
      </div>

      {/* Date range */}
      <div className="flex gap-2">
        <Input type="date" value={dateStart} onChange={e => { setDateStart(e.target.value); if (e.target.value > dateEnd) setDateEnd(e.target.value); }} className="h-8 text-xs flex-1" />
        <Input type="date" value={dateEnd} onChange={e => { setDateEnd(e.target.value); if (e.target.value < dateStart) setDateStart(e.target.value); }} className="h-8 text-xs flex-1" />
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-muted/40 p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Metas atingidas</span>
        <span className={cn('text-sm font-bold', okCount === desempenho.length && desempenho.length > 0 ? 'text-emerald-600' : 'text-foreground')}>
          {okCount}/{desempenho.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : desempenho.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Sem lançamentos para este período.</p>
      ) : (
        <div className="space-y-3">
          {groupedByMapa.map(([mapaKey, rows]) => {
            const mapaOk = rows.filter(r => r.status === 'dentro_meta' || r.status === 'acima_meta').length;
            return (
              <div key={mapaKey} className="rounded-lg border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/40">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-bold text-foreground flex-1">
                    {mapaKey === 'manual' ? 'Manual' : `Mapa ${mapaKey}`}
                  </span>
                  <span className={cn('text-xs font-bold', mapaOk === rows.length ? 'text-emerald-600' : 'text-red-600')}>
                    {mapaOk}/{rows.length}
                  </span>
                </div>
                <div className="divide-y divide-border/30">
                  {rows.map(d => {
                    const isTime = ['TML', 'TR', 'TI', 'JL'].includes(d.indicators?.codigo?.toUpperCase() ?? '');
                    const valStr = isTime ? formatMinutesHHMM(d.valor) : String(d.valor);
                    const metaStr = d.meta != null ? (isTime ? formatMinutesHHMM(d.meta) : String(d.meta)) : '—';
                    const atingiu = d.status === 'dentro_meta' || d.status === 'acima_meta';
                    return (
                      <div key={d.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-[10px] font-bold font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">
                          {d.indicators?.codigo}
                        </span>
                        <span className="text-xs text-muted-foreground flex-1 truncate">{d.indicators?.nome}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          <strong className="text-foreground">{valStr}</strong> / {metaStr}
                        </span>
                        <span className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0',
                          atingiu ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        )}>
                          {atingiu ? '✓' : '✗'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
