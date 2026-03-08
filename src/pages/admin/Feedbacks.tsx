import { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useFeedbacks, useResponderFeedback, useEncerrarFeedback, type FeedbackWithRelations } from '@/hooks/useFeedbacks';
import { useUnidades } from '@/hooks/useUnidades';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, AlertOctagon, CheckSquare, Archive, Eye, XCircle, Loader2, Truck, Monitor, GitBranch, Shield, Lightbulb, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'operacao', label: 'Operação', icon: Truck },
  { value: 'sistema', label: 'Sistema', icon: Monitor },
  { value: 'processo', label: 'Processo', icon: GitBranch },
  { value: 'seguranca', label: 'Segurança', icon: Shield },
  { value: 'sugestao', label: 'Sugestão', icon: Lightbulb },
  { value: 'incidente', label: 'Incidente', icon: AlertTriangle },
];

const URGENCIAS = ['baixa', 'media', 'alta', 'critica'];
const STATUSES = ['aberto', 'em_analise', 'respondido', 'encerrado'];

export default function FeedbacksAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: feedbacks = [], isLoading } = useFeedbacks({
    status: filters.status, urgencia: filters.urgencia, tipo: filters.tipo, unidade_id: filters.unidade_id,
  });
  const { data: units = [] } = useUnidades();
  const { user } = useAuth();
  const responderMut = useResponderFeedback();
  const encerrarMut = useEncerrarFeedback();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<FeedbackWithRelations | null>(null);
  const [respStatus, setRespStatus] = useState('');
  const [resposta, setResposta] = useState('');
  const [confirmEncerrar, setConfirmEncerrar] = useState<FeedbackWithRelations | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const totalAbertos = feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).length;
  const totalCriticos = feedbacks.filter(f => f.urgencia === 'critica' && ['aberto', 'em_analise'].includes(f.status)).length;
  const respondidosHoje = feedbacks.filter(f => f.responded_at?.startsWith(today)).length;
  const encerradosMes = feedbacks.filter(f => f.status === 'encerrado' && f.created_at.startsWith(thisMonth)).length;

  const openDetail = (f: FeedbackWithRelations) => {
    setSelected(f);
    setRespStatus(f.status === 'aberto' ? 'em_analise' : f.status);
    setResposta(f.resposta_lideranca ?? '');
    setDialogOpen(true);
  };

  const handleResponder = async () => {
    if (!selected || !user) return;
    await responderMut.mutateAsync({ id: selected.id, resposta, status: respStatus, respondido_por: user.id });
    setDialogOpen(false);
  };

  const handleEncerrar = async () => {
    if (!confirmEncerrar) return;
    await encerrarMut.mutateAsync(confirmEncerrar.id);
    setConfirmEncerrar(null);
  };

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const getTipoConfig = (tipo: string) => TIPOS.find(t => t.value === tipo) ?? { value: tipo, label: tipo, icon: MessageSquare };

  const columns: Column<FeedbackWithRelations>[] = [
    {
      key: 'colaborador', label: 'Colaborador', render: (f) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-[10px]">{getInitials(f.users?.nome ?? '')}</AvatarFallback></Avatar>
          <div>
            <p className="text-sm font-medium">{f.users?.nome}</p>
            {f.users?.worker_type && (
              <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                f.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
              )}>{f.users.worker_type === 'motorista' ? 'Mot' : 'Aj'}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'tipo', label: 'Tipo', render: (f) => {
        const t = getTipoConfig(f.tipo);
        const Icon = t.icon;
        return <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"><Icon className="h-3 w-3" />{t.label}</span>;
      },
    },
    { key: 'titulo', label: 'Título', render: (f) => <p className="text-sm font-semibold truncate max-w-[180px]">{f.titulo}</p> },
    { key: 'urgencia', label: 'Urgência', render: (f) => <StatusBadge status={f.urgencia} /> },
    { key: 'status', label: 'Status', render: (f) => <StatusBadge status={f.status} /> },
    {
      key: 'data', label: 'Data', render: (f) => (
        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}</span>
      ),
    },
    {
      key: 'acoes', label: 'Ações', render: (f) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openDetail(f)}><Eye className="h-4 w-4" /></Button>
          {f.status !== 'encerrado' && (
            <Button variant="ghost" size="icon" onClick={() => setConfirmEncerrar(f)}><XCircle className="h-4 w-4" /></Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
          <div><p className="text-2xl font-bold">{totalAbertos}</p><p className="text-xs text-muted-foreground">Abertos</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className={cn("h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center", totalCriticos > 0 && "animate-pulse")}>
            <AlertOctagon className="h-5 w-5 text-red-600" />
          </div>
          <div><p className="text-2xl font-bold">{totalCriticos}</p><p className="text-xs text-muted-foreground">Críticos</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckSquare className="h-5 w-5 text-emerald-600" /></div>
          <div><p className="text-2xl font-bold">{respondidosHoje}</p><p className="text-xs text-muted-foreground">Respondidos Hoje</p></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Archive className="h-5 w-5 text-muted-foreground" /></div>
          <div><p className="text-2xl font-bold">{encerradosMes}</p><p className="text-xs text-muted-foreground">Encerrados este mês</p></div>
        </div>
      </div>

      <PageHeader title="Feedbacks Operacionais" subtitle="Gerencie feedbacks dos colaboradores" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <Select value={filters.status ?? ''} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.urgencia ?? ''} onValueChange={v => setFilters(f => ({ ...f, urgencia: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Urgência" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{URGENCIAS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.tipo ?? ''} onValueChange={v => setFilters(f => ({ ...f, tipo: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Unidade" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{units.filter(u => u.ativo).map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={feedbacks} loading={isLoading} emptyMessage="Nenhum feedback encontrado" />

      {/* Detail + respond modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Feedback</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{selected.users?.nome}</span>
                {selected.users?.worker_type && (
                  <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                    selected.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
                  )}>{selected.users.worker_type === 'motorista' ? 'Mot' : 'Aj'}</span>
                )}
                {selected.units?.nome && <span className="text-xs text-muted-foreground">• {selected.units.nome}</span>}
                {selected.routes?.nome && <span className="text-xs text-muted-foreground">• {selected.routes.nome}</span>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(() => { const t = getTipoConfig(selected.tipo); const Icon = t.icon; return <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"><Icon className="h-3 w-3" />{t.label}</span>; })()}
                <StatusBadge status={selected.urgencia} />
                <StatusBadge status={selected.status} />
              </div>
              <div>
                <h3 className="text-base font-semibold">{selected.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(selected.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
              </div>
              <p className="text-sm">{selected.descricao}</p>

              {selected.resposta_lideranca && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Resposta Anterior</h4>
                    {selected.responded_at && <p className="text-xs text-muted-foreground">{format(new Date(selected.responded_at), "dd/MM/yyyy 'às' HH:mm")}</p>}
                    <p className="text-sm mt-1">{selected.resposta_lideranca}</p>
                  </div>
                </>
              )}

              <Separator />
              <h4 className="text-sm font-semibold">Responder</h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={respStatus} onValueChange={setRespStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_analise">Em análise</SelectItem>
                      <SelectItem value="respondido">Respondido</SelectItem>
                      <SelectItem value="encerrado">Encerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Sua Resposta {respStatus === 'respondido' && <span className="text-xs text-muted-foreground">(mín. 10 caracteres)</span>}</Label>
                  <Textarea value={resposta} onChange={e => setResposta(e.target.value)} rows={4} />
                </div>
                <Button className="w-full" disabled={responderMut.isPending || (respStatus === 'respondido' && resposta.length < 10)} onClick={handleResponder}>
                  {responderMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar Resposta
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!confirmEncerrar} title="Encerrar feedback"
        description="Deseja encerrar este feedback sem adicionar resposta?"
        confirmLabel="Encerrar" onConfirm={handleEncerrar}
        onCancel={() => setConfirmEncerrar(null)} loading={encerrarMut.isPending} />
    </div>
  );
}
