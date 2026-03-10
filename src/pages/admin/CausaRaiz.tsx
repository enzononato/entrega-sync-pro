import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCausaRaiz, useActionPlansByCause, useCreateActionPlan, type CausaRaizRow, type ActionPlanRow } from '@/hooks/useCausaRaiz';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, Search, CalendarIcon, ChevronRight, Clock,
  Plus, Loader2, Target, FileText, Layers, Package, Users,
  Wrench, HelpCircle, Truck, Gem, GitBranch, ShieldAlert, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const CATEGORIAS = ['Logística', 'Qualidade', 'Processo', 'Externo', 'Equipamento', 'Pessoal', 'Outro'];

const CAT_CONFIG: Record<string, { icon: typeof Truck; color: string; bg: string }> = {
  Logística: { icon: Truck, color: 'text-blue-700', bg: 'bg-blue-100' },
  Qualidade: { icon: Gem, color: 'text-emerald-700', bg: 'bg-emerald-100' },
  Processo: { icon: GitBranch, color: 'text-amber-700', bg: 'bg-amber-100' },
  Externo: { icon: Package, color: 'text-violet-700', bg: 'bg-violet-100' },
  Equipamento: { icon: Wrench, color: 'text-red-700', bg: 'bg-red-100' },
  Pessoal: { icon: User, color: 'text-pink-700', bg: 'bg-pink-100' },
  Outro: { icon: HelpCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
};

function DatePick({ value, onChange, placeholder, minDate }: { value: string; onChange: (v: string) => void; placeholder: string; minDate?: Date }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          disabled={minDate ? (d) => d < minDate : undefined}
          className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

function DetailModal({ causa, open, onClose }: { causa: CausaRaizRow | null; open: boolean; onClose: () => void }) {
  const { data: plans = [] } = useActionPlansByCause(causa?.id);
  const { user } = useAuth();
  const createPlan = useCreateActionPlan();
  const { toast } = useToast();
  const [planOpen, setPlanOpen] = useState(false);
  const [acao, setAcao] = useState('');
  const [prazo, setPrazo] = useState('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const savePlan = async () => {
    if (!causa || !user) return;
    await createPlan.mutateAsync({ root_cause_id: causa.id, responsavel_user_id: user.id, descricao_acao: acao, prazo: prazo || null });
    toast({ title: 'Plano de ação criado!' });
    setPlanOpen(false);
    setAcao('');
    setPrazo('');
  };

  if (!causa) return null;

  const catConf = CAT_CONFIG[causa.categoria_causa] ?? CAT_CONFIG.Outro;
  const CatIcon = catConf.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg leading-snug">Detalhes da Causa Raiz</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {causa.users?.nome?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{causa.users?.nome}</span>
            {causa.users?.worker_type && (
              <span className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                causa.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'
              )}>{causa.users.worker_type === 'motorista' ? 'Motorista' : 'Ajudante'}</span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(causa.data_referencia + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Indicator */}
          {causa.indicators && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Indicador</span>
              </div>
              <p className="text-sm font-semibold text-foreground">
                {causa.indicators.codigo} — {causa.indicators.nome}
              </p>
            </div>
          )}

          {/* Problem */}
          <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              <span className="text-[11px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">O Problema</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{causa.descricao_problema}</p>
            {causa.impacto && (
              <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                <span className="text-[10px] font-bold text-red-600/70 uppercase tracking-wider">Impacto</span>
                <p className="text-sm text-foreground mt-0.5">{causa.impacto}</p>
              </div>
            )}
          </div>

          {/* Root Cause */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Search className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Causa Raiz</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium', catConf.bg, catConf.color)}>
                <CatIcon className="h-3 w-3" />
                {causa.categoria_causa}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{causa.causa_raiz}</p>
          </div>

          {/* Action Plans */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-foreground">Planos de Ação ({plans.length})</h4>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setPlanOpen(true)}>
                <Plus className="h-3 w-3 mr-1" /> Novo Plano
              </Button>
            </div>
            {plans.length === 0 ? (
              <div className="rounded-lg bg-muted/40 p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum plano vinculado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map((p: ActionPlanRow) => (
                  <div key={p.id} className="rounded-lg border bg-card p-3.5 flex items-start gap-3">
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      p.status === 'concluido' ? 'bg-emerald-100' : p.status === 'em_andamento' ? 'bg-amber-100' : 'bg-blue-100'
                    )}>
                      <FileText className={cn('h-4 w-4',
                        p.status === 'concluido' ? 'text-emerald-600' : p.status === 'em_andamento' ? 'text-amber-600' : 'text-blue-600'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2">{p.descricao_acao}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <StatusBadge status={p.status} />
                        {p.prazo && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* New plan form */}
          {planOpen && (
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Novo Plano de Ação</h4>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição da Ação *</Label>
                <Textarea value={acao} onChange={e => setAcao(e.target.value)} rows={3} placeholder="O que será feito?" className="resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <DatePick value={prazo} onChange={setPrazo} placeholder="Selecione" minDate={tomorrow} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPlanOpen(false)}>Cancelar</Button>
                <Button size="sm" disabled={!acao || createPlan.isPending} onClick={savePlan}>
                  {createPlan.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Salvar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CausaRaizAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: causas = [], isLoading } = useCausaRaiz({
    user_id: filters.user_id,
    indicator_id: filters.indicator_id,
    categoria_causa: activeTab !== 'todos' ? activeTab : filters.categoria_causa,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const colabs = usuarios.filter(u => u.role === 'colaborador');

  const [detailCausa, setDetailCausa] = useState<CausaRaizRow | null>(null);
  const pg = usePagination(causas);

  // KPIs
  const { data: allCausas = [] } = useCausaRaiz({});
  const totalRegistros = allCausas.length;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const registrosMes = allCausas.filter(c => c.created_at.startsWith(thisMonth)).length;

  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    allCausas.forEach(c => { map[c.categoria_causa] = (map[c.categoria_causa] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [allCausas]);

  const topCategoria = catBreakdown[0]?.[0] ?? '—';
  const topCategoriaCount = catBreakdown[0]?.[1] ?? 0;

  const indicadorBreakdown = useMemo(() => {
    const map: Record<string, { nome: string; codigo: string; count: number }> = {};
    allCausas.forEach(c => {
      if (c.indicators) {
        if (!map[c.indicator_id]) map[c.indicator_id] = { nome: c.indicators.nome, codigo: c.indicators.codigo, count: 0 };
        map[c.indicator_id].count++;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [allCausas]);

  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const kpis = [
    { label: 'Total de Registros', value: totalRegistros, icon: Layers, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Este Mês', value: registrosMes, icon: CalendarIcon, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Categorias', value: catBreakdown.length, icon: Layers, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
    { label: 'Top Causa', value: topCategoriaCount, icon: AlertTriangle, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderColor: 'border-l-amber-500', subtitle: topCategoria },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Causa Raiz" subtitle="Registros de problemas e análise de causas raiz" />

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
                  {'subtitle' in k && k.subtitle && (
                    <p className="text-[10px] font-medium text-foreground mt-0.5">{k.subtitle}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top Indicadores com problemas */}
      {indicadorBreakdown.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Indicadores Mais Afetados</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {indicadorBreakdown.map((ind, i) => (
              <div key={ind.codigo} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold',
                  i === 0 ? 'bg-red-100 text-red-700' : i === 1 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                )}>
                  {ind.count}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ind.nome}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{ind.codigo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="flex flex-col gap-3">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto flex-wrap h-auto gap-1">
            <TabsTrigger value="todos">Todos</TabsTrigger>
            {CATEGORIAS.slice(0, 5).map(cat => {
              const conf = CAT_CONFIG[cat] ?? CAT_CONFIG.Outro;
              return (
                <TabsTrigger key={cat} value={cat} className="gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', conf.bg)} />{cat}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Select value={filters.user_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, user_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Colaborador" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Indicador" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : causas.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum registro encontrado</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros para ver outros registros</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden divide-y divide-border/50">
            {pg.paginatedItems.map(c => {
              const catConf = CAT_CONFIG[c.categoria_causa] ?? CAT_CONFIG.Outro;
              const CatIcon = catConf.icon;
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => setDetailCausa(c)}>
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', catConf.bg)}><CatIcon className={cn('h-4 w-4', catConf.color)} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><p className="text-sm font-semibold text-foreground truncate">{c.descricao_problema}</p></div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5"><AvatarFallback className="bg-primary/10 text-primary text-[8px] font-semibold">{getInitials(c.users?.nome ?? '?')}</AvatarFallback></Avatar>
                        <span className="text-xs text-muted-foreground">{c.users?.nome}</span>
                      </div>
                      {c.indicators && (<><span className="text-muted-foreground/40">•</span><span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium"><Target className="h-3 w-3" />{c.indicators.codigo}</span></>)}
                      <span className="text-muted-foreground/40">•</span>
                      <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', catConf.bg, catConf.color)}><CatIcon className="h-3 w-3" />{c.categoria_causa}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.indicators && <span className="text-xs text-muted-foreground hidden lg:block">{c.indicators.nome}</span>}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      <DetailModal causa={detailCausa} open={!!detailCausa} onClose={() => setDetailCausa(null)} />
    </div>
  );
}
