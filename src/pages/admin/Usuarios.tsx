import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useUsuarios, useCreateUsuario, useUpdateUsuario, useToggleUsuarioAtivo, type UserWithRelations } from '@/hooks/useUsuarios';
import { useUnidades } from '@/hooks/useUnidades';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Pencil, Power, Loader2, UserCog, Building2, Mail, Hash,
  Shield, Eye, EyeOff, Plus, Search, KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const emptyForm = {
  nome: '', email: '', matricula: '', password: '', ativo: true, unit_ids: [] as string[],
};

export default function Usuarios() {
  const { data: allUsers = [], isLoading } = useUsuarios();
  const { data: units = [] } = useUnidades();
  const activeUnits = units.filter(u => u.ativo);

  const createMut = useCreateUsuario();
  const updateMut = useUpdateUsuario();
  const toggleMut = useToggleUsuarioAtivo();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<UserWithRelations | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<UserWithRelations | null>(null);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const { toast } = useToast();

  // Filter only admin users
  const adminUsers = useMemo(() => {
    return allUsers.filter(u => u.role === 'administrador').filter(u => {
      if (!search) return true;
      const s = search.toLowerCase();
      return u.nome.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    });
  }, [allUsers, search]);

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowPassword(false); setDialogOpen(true); };
  const openEdit = (u: UserWithRelations) => {
    setEditing(u);
    setForm({
      nome: u.nome, email: u.email, matricula: u.matricula, password: '', ativo: u.ativo,
      unit_ids: u.user_units?.map(uu => uu.unit_id) ?? (u.unidade_id ? [u.unidade_id] : []),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const primaryUnit = form.unit_ids.length > 0 ? form.unit_ids[0] : null;
    if (editing) {
      await updateMut.mutateAsync({
        id: editing.id, nome: form.nome, email: form.email, matricula: form.matricula.toUpperCase(),
        cpf: null, role: 'administrador', worker_type: null,
        unidade_id: primaryUnit, rota_id: null, ativo: form.ativo,
        unit_ids: form.unit_ids,
      });
    } else {
      await createMut.mutateAsync({
        email: form.email, password: form.password, nome: form.nome,
        matricula: form.matricula.toUpperCase(), cpf: null,
        role: 'administrador', worker_type: null,
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

  const saving = createMut.isPending || updateMut.isPending;
  const canSave = form.nome.length >= 3 && form.email.includes('@') && (editing || form.password.length >= 6);

  const totalAtivos = adminUsers.filter(u => u.ativo).length;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <PageHeader title="Usuários do Sistema" subtitle="Gerencie os administradores e suas revendas" />
        <Button onClick={openCreate} className="rounded-xl gradient-primary text-white shadow-glow-primary hover:opacity-90 transition-all hover:shadow-lg gap-2">
          <Plus className="h-4 w-4" /> Novo Usuário
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Usuários', value: adminUsers.length, icon: UserCog, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
          { label: 'Ativos', value: totalAtivos, icon: Shield, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
          { label: 'Unidades Cadastradas', value: activeUnits.length, icon: Building2, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
        ].map(k => {
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : adminUsers.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <UserCog className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {adminUsers.map(u => {
            const unitNames = u.user_units?.map(uu => uu.units?.nome).filter(Boolean) ?? [];
            return (
              <div
                key={u.id}
                className={cn(
                  'rounded-xl border bg-card shadow-sm overflow-hidden transition-all hover:shadow-md',
                  !u.ativo && 'opacity-50',
                  'border-t-[3px] border-t-amber-400'
                )}
              >
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0 ring-2 ring-background shadow-sm">
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-xs font-bold">
                        {getInitials(u.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{u.nome}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">
                          <Shield className="h-3 w-3" /> Administrador
                        </span>
                        <StatusBadge status={u.ativo ? 'ativo' : 'inativo'} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                  {u.matricula && (
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Hash className="h-3 w-3 shrink-0" />
                      <span className="font-mono font-medium">{u.matricula}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="truncate">
                      {unitNames.length > 0 ? unitNames.join(', ') : <span className="italic text-muted-foreground/50">Todas as revendas</span>}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-border/50 bg-muted/20">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-5">
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Dados do Usuário</h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9" />
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

            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Revendas Liberadas</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                Selecione as revendas que este usuário poderá gerenciar. Se nenhuma for selecionada, terá acesso a todas.
              </p>
              <div className="rounded-lg border border-border bg-card p-3 max-h-48 overflow-y-auto space-y-2">
                {activeUnits.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma unidade cadastrada</p>}
                {activeUnits.map(u => (
                  <label key={u.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 transition-colors">
                    <Checkbox
                      checked={form.unit_ids.includes(u.id)}
                      onCheckedChange={(checked) => {
                        setForm(f => ({
                          ...f,
                          unit_ids: checked
                            ? [...f.unit_ids, u.id]
                            : f.unit_ids.filter(id => id !== u.id),
                        }));
                      }}
                    />
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{u.nome}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{u.codigo}</span>
                    </div>
                  </label>
                ))}
              </div>
              {form.unit_ids.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1.5">{form.unit_ids.length} revenda(s) selecionada(s)</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <Label className="text-sm">Usuário Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
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

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar usuário' : 'Ativar usuário'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} "${toggleTarget?.nome}"?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
