import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useFeedbacks, useResponderFeedback, useEncerrarFeedback, type FeedbackWithRelations } from '@/hooks/useFeedbacks';
import { useUnidades } from '@/hooks/useUnidades';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, AlertOctagon, CheckSquare, Archive, Eye, XCircle,
  Loader2, Truck, Monitor, GitBranch, Shield, Lightbulb, AlertTriangle, Clock, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'operacao', label: 'Operação', icon: Truck, color: 'bg-blue-100 text-blue-700' },
  { value: 'sistema', label: 'Sistema', icon: Monitor, color: 'bg-violet-100 text-violet-700' },
  { value: 'processo', label: 'Processo', icon: GitBranch, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'seguranca', label: 'Segurança', icon: Shield, color: 'bg-red-100 text-red-700' },
  { value: 'sugestao', label: 'Sugestão', icon: Lightbulb, color: 'bg-amber-100 text-amber-700' },
  { value: 'incidente', label: 'Incidente', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
];

const URGENCIAS = ['baixa', 'media', 'alta', 'critica'];
const STATUSES = ['aberto', 'em_analise', 'respondido', 'encerrado'];

const URGENCIA_DOT: Record<string, string> = {
  baixa: 'bg-muted-foreground',
  media: 'bg-amber-500',
  alta: 'bg-orange-500',
  critica: 'bg-red-500',
};

export default function FeedbacksAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: feedbacks = [], isLoading } = useFeedbacks({
    status: activeTab !== 'todos' ? activeTab : filters.status,
    urgencia: filters.urgencia,
    tipo: filters.tipo,
    unidade_id: filters.unidade_id,
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

  // Use all feedbacks for KPIs (unfiltered by tab)
  const { data: allFeedbacks = [] } = useFeedbacks({});
  const totalAbertos = allFeedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status)).length;
  const totalCriticos = allFeedbacks.filter(f => f.urgencia === 'critica' && ['aberto', 'em_analise'].includes(f.status)).length;
  const respondidosHoje = allFeedbacks.filter(f => f.responded_at?.startsWith(today)).length;
  const encerradosMes = allFeedbacks.filter(f => f.status === 'encerrado' && f.created_at.startsWith(thisMonth)).length;

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
  const getTipoConfig = (tipo: string) => TIPOS.find(t => t.value === tipo) ?? { value: tipo, label: tipo, icon: MessageSquare, color: 'bg-muted text-muted-foreground' };

  const kpis = [
    { label: 'Abertos', value: totalAbertos, icon: MessageSquare, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Críticos', value: totalCriticos, icon: AlertOctagon, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500', pulse: totalCriticos > 0 },
    { label: 'Respondidos Hoje', value: respondidosHoje, icon: CheckSquare, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Encerrados (mês)', value: encerradosMes, icon: Archive, iconBg: 'bg-muted', iconColor: 'text-muted-foreground', borderColor: 'border-l-muted-foreground' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Feedbacks Operacionais" subtitle="Gerencie e responda feedbacks dos colaboradores" />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={cn('rounded-xl border bg-card p-4 shadow-sm border-l-[3px] transition-all hover:shadow-md', k.borderColor)}>
              <div className="flex items-center gap-3">
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', k.iconBg, k.pulse && 'animate-pulse')}>
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
            <TabsTrigger value="aberto" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Abertos
            </TabsTrigger>
            <TabsTrigger value="em_analise" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Em Análise
            </TabsTrigger>
            <TabsTrigger value="respondido" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Respondidos
            </TabsTrigger>
            <TabsTrigger value="encerrado">Encerrados</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Select value={filters.urgencia ?? ''} onValueChange={v => setFilters(f => ({ ...f, urgencia: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs"><SelectValue placeholder="Urgência" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{URGENCIAS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.tipo ?? ''} onValueChange={v => setFilters(f => ({ ...f, tipo: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{units.filter(u => u.ativo).map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Feedback List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : feedbacks.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum feedback encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou aguarde novos envios</p>
        </div>
      ) : (
        <FeedbackList feedbacks={feedbacks} openDetail={openDetail} setConfirmEncerrar={setConfirmEncerrar} getTipoConfig={getTipoConfig} getInitials={getInitials} />
      )}

      {/* Detail + respond modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
          {selected && (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-lg leading-snug">{selected.titulo}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 mt-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {getInitials(selected.users?.nome ?? '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">{selected.users?.nome}</span>
                  {selected.users?.worker_type && (
                    <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                      selected.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
                    )}>{selected.users.worker_type === 'motorista' ? 'Motorista' : 'Ajudante'}</span>
                  )}
                  {selected.units?.nome && <span className="text-xs text-muted-foreground">• {selected.units.nome}</span>}
                  {selected.routes?.nome && <span className="text-xs text-muted-foreground">• {selected.routes.nome}</span>}
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5">
                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    const t = getTipoConfig(selected.tipo);
                    const Icon = t.icon;
                    return (
                      <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', t.color)}>
                        <Icon className="h-3.5 w-3.5" />{t.label}
                      </span>
                    );
                  })()}
                  <StatusBadge status={selected.urgencia} />
                  <StatusBadge status={selected.status} />
                </div>

                <p className="text-xs text-muted-foreground">
                  {format(new Date(selected.created_at), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })}
                </p>

                <div className="rounded-lg bg-muted/40 p-4">
                  <p className="text-sm text-foreground leading-relaxed">{selected.descricao}</p>
                </div>

                {selected.resposta_lideranca && (
                  <>
                    <Separator />
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4">
                      <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
                        Resposta da Liderança
                      </h4>
                      {selected.responded_at && (
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mb-2">
                          {format(new Date(selected.responded_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                      <p className="text-sm text-foreground leading-relaxed">{selected.resposta_lideranca}</p>
                    </div>
                  </>
                )}

                {/* Respond section */}
                {selected.status !== 'encerrado' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-foreground">Responder</h4>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status</Label>
                        <Select value={respStatus} onValueChange={setRespStatus}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="em_analise">Em análise</SelectItem>
                            <SelectItem value="respondido">Respondido</SelectItem>
                            <SelectItem value="encerrado">Encerrado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">
                          Sua Resposta
                          {respStatus === 'respondido' && <span className="text-muted-foreground ml-1">(mín. 10 caracteres)</span>}
                        </Label>
                        <Textarea
                          value={resposta}
                          onChange={e => setResposta(e.target.value)}
                          rows={4}
                          placeholder="Escreva sua resposta aqui..."
                          className="resize-none"
                        />
                      </div>
                      <Button
                        className="w-full h-10"
                        disabled={responderMut.isPending || (respStatus === 'respondido' && resposta.length < 10)}
                        onClick={handleResponder}
                      >
                        {responderMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Resposta
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmEncerrar}
        title="Encerrar feedback"
        description="Deseja encerrar este feedback sem adicionar resposta?"
        confirmLabel="Encerrar"
        onConfirm={handleEncerrar}
        onCancel={() => setConfirmEncerrar(null)}
        loading={encerrarMut.isPending}
      />
    </div>
  );
}
