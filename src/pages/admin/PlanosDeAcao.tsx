import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { usePlanosDeAcao, useUpdatePlano, useDeletePlano, type ActionPlanWithRelations } from '@/hooks/usePlanosDeAcao';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useIndicadores } from '@/hooks/useIndicadores';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardList, Activity, AlertTriangle, CheckCircle, Eye, Pencil, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlanosDeAcaoAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [atrasadosOnly, setAtrasadosOnly] = useState(false);
  const { data: planos = [], isLoading } = usePlanosDeAcao({
    status: filters.status, user_id: filters.user_id, atrasados: atrasadosOnly,
  });
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const updateMut = useUpdatePlano();
  const deleteMut = useDeletePlano();

  const colabs = usuarios.filter(u => u.role === 'colaborador');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ActionPlanWithRelations | null>(null);
  const [detailTab, setDetailTab] = useState('detalhes');
  const [newStatus, setNewStatus] = useState('');
  const [obs, setObs] = useState('');

  const isAtrasado = (p: ActionPlanWithRelations) => p.prazo && p.prazo < today && !['concluido', 'cancelado'].includes(p.status);

  const totalAbertos = planos.filter(p => p.status === 'aberto').length;
  const totalAndamento = planos.filter(p => p.status === 'em_andamento').length;
  const totalAtrasados = planos.filter(isAtrasado).length;
  const totalConcluidosMes = planos.filter(p => p.status === 'concluido' && p.updated_at?.startsWith(thisMonth)).length;

  const openDetail = (p: ActionPlanWithRelations) => {
    setSelected(p);
    setNewStatus(p.status);
    setObs(p.observacoes || '');
    setDetailTab('detalhes');
    setDetailOpen(true);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    await updateMut.mutateAsync({ id: selected.id, status: newStatus, observacoes: obs });
    setDetailOpen(false);
  };

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const tabFilter = (tab: string) => {
    if (tab === 'todos') return planos;
    if (tab === 'atrasados') return planos.filter(isAtrasado);
    return planos.filter(p => p.status === tab);
  };

  const [activeTab, setActiveTab] = useState('todos');
  const filteredByTab = tabFilter(activeTab);

  const columns: Column<ActionPlanWithRelations>[] = [
    {
      key: 'responsavel', label: 'Responsável', render: (p) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-[10px]">{getInitials(p.users?.nome ?? '')}</AvatarFallback></Avatar>
          <div>
            <p className="text-sm font-medium">{p.users?.nome}</p>
            {p.users?.worker_type && (
              <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                p.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
              )}>{p.users.worker_type === 'motorista' ? 'Mot' : 'Aj'}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'indicador', label: 'Indicador', render: (p) => p.root_cause_records?.indicators
        ? <span><span className="font-mono text-xs text-primary">{p.root_cause_records.indicators.codigo}</span> {p.root_cause_records.indicators.nome}</span>
        : '—',
    },
    { key: 'descricao', label: 'Descrição', render: (p) => <p className="text-sm line-clamp-2 max-w-[200px]">{p.descricao_acao}</p> },
    {
      key: 'prazo', label: 'Prazo', render: (p) => (
        <div className="flex items-center gap-1">
          {isAtrasado(p) && <AlertTriangle className="h-3 w-3 text-destructive" />}
          <span className={cn('text-sm', isAtrasado(p) && 'text-destructive font-medium')}>
            {p.prazo ? format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yy') : '—'}
          </span>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    { key: 'criado', label: 'Criado', render: (p) => format(new Date(p.created_at), 'dd/MM/yy') },
    {
      key: 'acoes', label: 'Ações', render: (p) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openDetail(p)}><Eye className="h-4 w-4" /></Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-blue-600" /></div>
          <div><p className="text-2xl font-bold">{totalAbertos}</p><p className="text-xs text-muted-foreground">Abertos</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center"><Activity className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-2xl font-bold">{totalAndamento}</p><p className="text-xs text-muted-foreground">Em Andamento</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className={cn("h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center", totalAtrasados > 0 && "animate-pulse")}>
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div><p className="text-2xl font-bold">{totalAtrasados}</p><p className="text-xs text-muted-foreground">Atrasados</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold">{totalConcluidosMes}</p><p className="text-xs text-muted-foreground">Concluídos este mês</p></div>
        </div>
      </div>

      <PageHeader title="Planos de Ação" subtitle="Gestão de planos vinculados a causas raiz" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap items-end">
        <Select value={filters.status ?? ''} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.user_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, user_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="atrasados" checked={atrasadosOnly} onCheckedChange={v => setAtrasadosOnly(!!v)} />
          <Label htmlFor="atrasados" className="text-sm">Apenas atrasados</Label>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="aberto">Abertos</TabsTrigger>
          <TabsTrigger value="em_andamento">Em andamento</TabsTrigger>
          <TabsTrigger value="atrasados">Atrasados</TabsTrigger>
          <TabsTrigger value="concluido">Concluídos</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable columns={columns} data={filteredByTab} loading={isLoading} emptyMessage="Nenhum plano encontrado" />

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Plano de Ação</DialogTitle></DialogHeader>
          {selected && (
            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="atualizar">Atualizar</TabsTrigger>
              </TabsList>
              <TabsContent value="detalhes" className="space-y-3 py-2">
                <div><span className="text-xs text-muted-foreground">Responsável</span><p className="text-sm font-medium">{selected.users?.nome}</p></div>
                {selected.root_cause_records?.indicators && (
                  <div><span className="text-xs text-muted-foreground">Indicador</span><p className="text-sm">{selected.root_cause_records.indicators.codigo} — {selected.root_cause_records.indicators.nome}</p></div>
                )}
                <div><span className="text-xs text-muted-foreground">Problema</span><p className="text-sm">{selected.root_cause_records?.descricao_problema}</p></div>
                <div><span className="text-xs text-muted-foreground">Causa Raiz</span><p className="text-sm">{selected.root_cause_records?.causa_raiz}</p></div>
                <div><span className="text-xs text-muted-foreground">Ação Planejada</span><p className="text-sm">{selected.descricao_acao}</p></div>
                <div className="flex gap-4">
                  <div><span className="text-xs text-muted-foreground">Prazo</span><p className="text-sm">{selected.prazo ? format(new Date(selected.prazo + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</p></div>
                  <div><span className="text-xs text-muted-foreground">Status</span><div className="mt-0.5"><StatusBadge status={selected.status} /></div></div>
                </div>
                {selected.prazo && (
                  <div>
                    <span className="text-xs text-muted-foreground">
                      {isAtrasado(selected)
                        ? `Atrasado há ${Math.ceil((Date.now() - new Date(selected.prazo + 'T00:00:00').getTime()) / 86400000)} dias`
                        : `${Math.ceil((new Date(selected.prazo + 'T00:00:00').getTime() - Date.now()) / 86400000)} dias restantes`}
                    </span>
                  </div>
                )}
                {selected.observacoes && <div><span className="text-xs text-muted-foreground">Observações</span><p className="text-sm">{selected.observacoes}</p></div>}
              </TabsContent>
              <TabsContent value="atualizar" className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em andamento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Observações</Label>
                  <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={4} />
                </div>
                <Button className="w-full" disabled={updateMut.isPending} onClick={handleUpdate}>
                  {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
