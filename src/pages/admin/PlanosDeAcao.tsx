import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { usePlanosDeAcao, useUpdatePlano, type ActionPlanWithRelations } from '@/hooks/usePlanosDeAcao';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  ClipboardList, Activity, AlertTriangle, CheckCircle, Loader2,
  Calendar, ChevronRight, Target, FileText, Clock, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_ICON: Record<string, { icon: typeof ClipboardList; color: string }> = {
  aberto: { icon: ClipboardList, color: 'text-blue-500' },
  em_andamento: { icon: Activity, color: 'text-amber-500' },
  concluido: { icon: CheckCircle, color: 'text-emerald-500' },
  cancelado: { icon: XCircle, color: 'text-muted-foreground' },
};

export default function PlanosDeAcaoAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: planos = [], isLoading } = usePlanosDeAcao({
    status: activeTab !== 'todos' && activeTab !== 'atrasados' ? activeTab : filters.status,
    user_id: filters.user_id,
  });
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const updateMut = useUpdatePlano();

  const colabs = usuarios.filter(u => u.role === 'colaborador');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ActionPlanWithRelations | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [obs, setObs] = useState('');

  const isAtrasado = (p: ActionPlanWithRelations) =>
    p.prazo && p.prazo < today && !['concluido', 'cancelado'].includes(p.status);

  const diasRestantes = (p: ActionPlanWithRelations) => {
    if (!p.prazo) return null;
    const diff = Math.ceil((new Date(p.prazo + 'T00:00:00').getTime() - Date.now()) / 86400000);
    return diff;
  };

  // KPIs from all data
  const { data: allPlanos = [] } = usePlanosDeAcao({});
  const totalAbertos = allPlanos.filter(p => p.status === 'aberto').length;
  const totalAndamento = allPlanos.filter(p => p.status === 'em_andamento').length;
  const totalAtrasados = allPlanos.filter(isAtrasado).length;
  const totalConcluidosMes = allPlanos.filter(p => p.status === 'concluido' && p.updated_at?.startsWith(thisMonth)).length;
  const totalPlanos = allPlanos.length;
  const totalConcluidos = allPlanos.filter(p => p.status === 'concluido').length;
  const taxaConclusao = totalPlanos > 0 ? Math.round((totalConcluidos / totalPlanos) * 100) : 0;

  const openDetail = (p: ActionPlanWithRelations) => {
    setSelected(p);
    setNewStatus(p.status);
    setObs(p.observacoes || '');
    setDetailOpen(true);
  };

  const handleUpdate = async () => {
    if (!selected) return;
    await updateMut.mutateAsync({ id: selected.id, status: newStatus, observacoes: obs });
    setDetailOpen(false);
  };

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const filteredPlanos = activeTab === 'atrasados'
    ? planos.filter(isAtrasado)
    : planos;
  const pg = usePagination(filteredPlanos);

  const kpis = [
    { label: 'Abertos', value: totalAbertos, icon: ClipboardList, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Em Andamento', value: totalAndamento, icon: Activity, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderColor: 'border-l-amber-500' },
    { label: 'Atrasados', value: totalAtrasados, icon: AlertTriangle, iconBg: 'bg-red-100', iconColor: 'text-red-600', borderColor: 'border-l-red-500', pulse: totalAtrasados > 0 },
    { label: 'Concluídos (mês)', value: totalConcluidosMes, icon: CheckCircle, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Planos de Ação" subtitle="Gestão de planos vinculados a causas raiz" />

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

      {/* Progress bar */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Taxa de Conclusão</span>
          </div>
          <span className="text-sm font-bold text-primary">{taxaConclusao}%</span>
        </div>
        <Progress value={taxaConclusao} className="h-2.5" />
        <p className="text-[11px] text-muted-foreground mt-2">{totalConcluidos} de {totalPlanos} planos concluídos</p>
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="aberto" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Abertos
            </TabsTrigger>
            <TabsTrigger value="em_andamento" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Em Andamento
            </TabsTrigger>
            <TabsTrigger value="atrasados" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Atrasados
            </TabsTrigger>
            <TabsTrigger value="concluido" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Concluídos
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Select value={filters.user_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, user_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredPlanos.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum plano encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros para ver outros planos</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            {pg.paginatedItems.map(p => {
              const statusConf = STATUS_ICON[p.status] ?? STATUS_ICON.aberto;
              const StatusIcon = statusConf.icon;
              const dias = diasRestantes(p);
              const atrasado = isAtrasado(p);
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => openDetail(p)}>
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', atrasado ? 'bg-red-100' : p.status === 'concluido' ? 'bg-emerald-100' : p.status === 'em_andamento' ? 'bg-amber-100' : 'bg-blue-100')}>
                    {atrasado ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <StatusIcon className={cn('h-4 w-4', statusConf.color)} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><p className="text-sm font-semibold text-foreground truncate">{p.descricao_acao}</p></div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5"><AvatarFallback className="bg-primary/10 text-primary text-[8px] font-semibold">{getInitials(p.users?.nome ?? '?')}</AvatarFallback></Avatar>
                        <span className="text-xs text-muted-foreground">{p.users?.nome}</span>
                      </div>
                      {p.root_cause_records?.indicators && (<><span className="text-muted-foreground/40">•</span><span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium"><Target className="h-3 w-3" />{p.root_cause_records.indicators.codigo}</span></>)}
                      {p.prazo && (<><span className="text-muted-foreground/40">•</span><span className={cn('inline-flex items-center gap-1 text-[11px]', atrasado ? 'text-red-600 font-semibold' : 'text-muted-foreground')}><Calendar className="h-3 w-3" />{format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yy')}{atrasado && dias !== null && <span className="ml-1 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-bold">{Math.abs(dias)}d atrás</span>}{!atrasado && dias !== null && dias <= 3 && dias >= 0 && <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[9px] font-bold">{dias}d</span>}</span></>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={p.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Detail modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
          {selected && (() => {
            const atrasado = isAtrasado(selected);
            const dias = diasRestantes(selected);

            return (
              <>
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-border/50">
                  <DialogHeader>
                    <DialogTitle className="text-lg leading-snug">Plano de Ação</DialogTitle>
                  </DialogHeader>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
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
                    <div className="ml-auto flex gap-2">
                      <StatusBadge status={selected.status} />
                      {atrasado && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3" /> ATRASADO
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-5">
                  {/* Indicator info */}
                  {selected.root_cause_records?.indicators && (
                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Indicador</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {selected.root_cause_records.indicators.codigo} — {selected.root_cause_records.indicators.nome}
                      </p>
                    </div>
                  )}

                  {/* Problem & Root Cause */}
                  {selected.root_cause_records && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg bg-muted/40 p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Problema</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{selected.root_cause_records.descricao_problema}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Causa Raiz</span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{selected.root_cause_records.causa_raiz}</p>
                      </div>
                    </div>
                  )}

                  {/* Ação Planejada */}
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ClipboardList className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">Ação Planejada</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{selected.descricao_acao}</p>
                  </div>

                  {/* Prazo & timing */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Prazo</span>
                        <span className={cn('text-sm font-semibold', atrasado ? 'text-red-600' : 'text-foreground')}>
                          {selected.prazo ? format(new Date(selected.prazo + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Sem prazo'}
                        </span>
                      </div>
                    </div>
                    {dias !== null && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">Tempo</span>
                          <span className={cn('text-sm font-semibold', atrasado ? 'text-red-600' : dias <= 3 ? 'text-amber-600' : 'text-foreground')}>
                            {atrasado ? `${Math.abs(dias)} dias de atraso` : `${dias} dias restantes`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Observations */}
                  {selected.observacoes && (
                    <div className="rounded-lg bg-muted/40 p-4">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Observações</span>
                      <p className="text-sm text-foreground leading-relaxed">{selected.observacoes}</p>
                    </div>
                  )}

                  {/* Update section */}
                  {!['concluido', 'cancelado'].includes(selected.status) && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-foreground">Atualizar</h4>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Status</Label>
                          <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aberto">Aberto</SelectItem>
                              <SelectItem value="em_andamento">Em andamento</SelectItem>
                              <SelectItem value="concluido">Concluído</SelectItem>
                              <SelectItem value="cancelado">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Observações</Label>
                          <Textarea
                            value={obs}
                            onChange={e => setObs(e.target.value)}
                            rows={3}
                            placeholder="Adicione observações..."
                            className="resize-none"
                          />
                        </div>
                        <Button className="w-full h-10" disabled={updateMut.isPending} onClick={handleUpdate}>
                          {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Salvar Alterações
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
