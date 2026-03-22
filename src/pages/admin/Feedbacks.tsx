import { useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, AlertOctagon, CheckSquare, Archive, XCircle,
  Loader2, Truck, Monitor, GitBranch, Shield, Lightbulb, AlertTriangle,
  Clock, ChevronRight, Search, Building2, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'operacao', label: 'Operação', icon: Truck, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'sistema', label: 'Sistema', icon: Monitor, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  { value: 'processo', label: 'Processo', icon: GitBranch, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'seguranca', label: 'Segurança', icon: Shield, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'sugestao', label: 'Sugestão', icon: Lightbulb, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'incidente', label: 'Incidente', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
];

const URGENCIAS = ['baixa', 'media', 'alta', 'critica'];

const URGENCIA_BORDER: Record<string, string> = {
  baixa: 'border-l-muted-foreground/40',
  media: 'border-l-amber-400',
  alta: 'border-l-orange-500',
  critica: 'border-l-red-500',
};

const URGENCIA_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
};

export default function FeedbacksAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const [search, setSearch] = useState('');
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

  // Search filter
  const filteredFeedbacks = search
    ? feedbacks.filter(f => {
        const s = search.toLowerCase();
        return f.titulo.toLowerCase().includes(s) || f.users?.nome?.toLowerCase().includes(s) || f.descricao.toLowerCase().includes(s);
      })
    : feedbacks;

  const pg = usePagination(filteredFeedbacks);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

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
    { label: 'Abertos', value: totalAbertos, icon: MessageSquare, iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400', borderColor: 'border-l-blue-500' },
    { label: 'Críticos', value: totalCriticos, icon: AlertOctagon, iconBg: 'bg-red-100 dark:bg-red-900/30', iconColor: 'text-red-600 dark:text-red-400', borderColor: 'border-l-red-500', pulse: totalCriticos > 0 },
    { label: 'Respondidos Hoje', value: respondidosHoje, icon: CheckSquare, iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400', borderColor: 'border-l-emerald-500' },
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
        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); pg.resetPage(); }}>
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
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, nome..."
              value={search}
              onChange={e => { setSearch(e.target.value); pg.resetPage(); }}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Select value={filters.urgencia ?? ''} onValueChange={v => { setFilters(f => ({ ...f, urgencia: v === 'all' ? '' : v })); pg.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs"><SelectValue placeholder="Urgência" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{URGENCIAS.map(u => <SelectItem key={u} value={u} className="capitalize">{URGENCIA_LABEL[u]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.tipo ?? ''} onValueChange={v => { setFilters(f => ({ ...f, tipo: v === 'all' ? '' : v })); pg.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-36 h-9 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.unidade_id ?? ''} onValueChange={v => { setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v })); pg.resetPage(); }}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{units.filter(u => u.ativo).map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Feedback Cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum feedback encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou aguarde novos envios</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pg.paginatedItems.map(f => {
              const tipo = getTipoConfig(f.tipo);
              const TipoIcon = tipo.icon;
              const isCritica = f.urgencia === 'critica';
              const isAberto = ['aberto', 'em_analise'].includes(f.status);

              return (
                <div
                  key={f.id}
                  onClick={() => openDetail(f)}
                  className={cn(
                    'rounded-xl border bg-card shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer group border-l-[3px]',
                    URGENCIA_BORDER[f.urgencia] ?? 'border-l-transparent',
                    isCritica && isAberto && 'ring-1 ring-destructive/20',
                  )}
                >
                  {/* Card header */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {f.titulo}
                      </h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{f.descricao}</p>
                  </div>

                  {/* Tags */}
                  <div className="px-4 py-2 flex flex-wrap gap-1.5">
                    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', tipo.color)}>
                      <TipoIcon className="h-3 w-3" />{tipo.label}
                    </span>
                    <StatusBadge status={f.urgencia} />
                    <StatusBadge status={f.status} />
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                          {getInitials(f.users?.nome ?? '?')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{f.users?.nome ?? '—'}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {f.units?.nome && (
                            <span className="inline-flex items-center gap-0.5 truncate">
                              <Building2 className="h-2.5 w-2.5 shrink-0" />{f.units.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                      {f.status !== 'encerrado' && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={e => { e.stopPropagation(); setConfirmEncerrar(f); }}
                        >
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Detail + respond modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
          {selected && (
            <>
              <div className={cn('h-1.5 w-full', {
                'bg-muted-foreground/30': selected.urgencia === 'baixa',
                'bg-amber-400': selected.urgencia === 'media',
                'bg-orange-500': selected.urgencia === 'alta',
                'bg-red-500': selected.urgencia === 'critica',
              })} />
              <div className="px-6 pt-5 pb-4 border-b border-border/50">
                <DialogHeader>
                  <DialogTitle className="text-lg leading-snug">{selected.titulo}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {getInitials(selected.users?.nome ?? '')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-foreground">{selected.users?.nome}</span>
                  {selected.users?.worker_type && (
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                      selected.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : selected.users.worker_type === 'distribuicao' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                    )}>
                      {selected.users.worker_type === 'motorista' ? 'Motorista' : selected.users.worker_type === 'distribuicao' ? 'Distribuição' : 'Ajudante'}
                    </span>
                  )}
                  {selected.units?.nome && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {selected.units.nome}
                    </span>
                  )}
                  {selected.routes?.nome && (
                    <span className="text-xs text-muted-foreground">• {selected.routes.nome}</span>
                  )}
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                <div className="flex gap-2 flex-wrap">
                  {(() => {
                    const t = getTipoConfig(selected.tipo);
                    const Icon = t.icon;
                    return (
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', t.color)}>
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

                <div className="rounded-xl bg-muted/40 p-4 border border-border/30">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.descricao}</p>
                </div>

                {selected.resposta_lideranca && (
                  <>
                    <Separator />
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                          Resposta da Liderança
                        </h4>
                      </div>
                      {selected.responded_at && (
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mb-2">
                          {format(new Date(selected.responded_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selected.resposta_lideranca}</p>
                    </div>
                  </>
                )}

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
