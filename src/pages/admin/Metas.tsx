import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { ListPagination } from '@/components/shared/ListPagination';
import { formatMinutesHHMM } from '@/lib/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useMetas, useCreateMeta, useUpdateMeta, useToggleMetaAtivo, type GoalWithRelations } from '@/hooks/useMetas';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useAllowedUnits } from '@/hooks/useAllowedUnits';
import { useUsuarios } from '@/hooks/useUsuarios';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Pencil, Power, Loader2, CalendarIcon, Target, ChevronRight,
  Users, User, Truck, Building2, Clock, BarChart3, Layers, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PERIODOS = [
  { value: 'diario', label: 'Diário', icon: Clock },
  { value: 'semanal', label: 'Semanal', icon: CalendarIcon },
  { value: 'mensal', label: 'Mensal', icon: CalendarIcon },
];

const SCOPE_CONFIG: Record<string, { label: string; bg: string; color: string; icon: typeof Users }> = {
  individual: { label: 'Individual', bg: 'bg-orange-100', color: 'text-orange-700', icon: User },
  motorista: { label: 'Motorista', bg: 'bg-emerald-100', color: 'text-emerald-700', icon: Truck },
  ajudante: { label: 'Ajudante', bg: 'bg-violet-100', color: 'text-violet-700', icon: Users },
  geral: { label: 'Geral', bg: 'bg-muted', color: 'text-muted-foreground', icon: Layers },
};

function getScope(g: GoalWithRelations) {
  if (g.user_id) return 'individual';
  if (g.worker_type === 'motorista') return 'motorista';
  if (g.worker_type === 'ajudante') return 'ajudante';
  return 'geral';
}

const emptyForm = {
  indicator_id: '', unidade_id: '' as string | null, worker_type: '' as string | null,
  user_id: '' as string | null, valor_meta: 0, valor_bonificacao: 0, periodo_tipo: 'diario',
  vigencia_inicio: format(new Date(), 'yyyy-MM-dd'), ativo: true,
  formato_meta: 'tempo' as 'tempo' | 'porcentagem',
};

function parseHHMM(str: string): number {
  const parts = str.split(':');
  if (parts.length !== 2) return 0;
  const h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  return h * 60 + m;
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.round(Math.abs(minutes) % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function detectFormato(valorMeta: number, indicatorCodigo?: string): 'tempo' | 'porcentagem' {
  if (['TML', 'TR', 'TI', 'JL'].includes((indicatorCodigo ?? '').toUpperCase())) return 'tempo';
  return valorMeta > 200 ? 'tempo' : 'porcentagem';
}

function DatePick({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-9', !value && 'text-muted-foreground')}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(new Date(value + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default function Metas() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('todos');
  const { data: metas = [], isLoading } = useMetas({
    indicator_id: filters.indicator_id,
    worker_type: activeTab !== 'todos' && activeTab !== 'individual' && activeTab !== 'geral' ? activeTab : filters.worker_type,
    unidade_id: filters.unidade_id,
    ativo: filters.ativo,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { allowedUnits } = useAllowedUnits();
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const createMut = useCreateMeta();
  const updateMut = useUpdateMeta();
  const toggleMut = useToggleMetaAtivo();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalWithRelations | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formTab, setFormTab] = useState('tipo');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<GoalWithRelations | null>(null);
  const [metaTimeStr, setMetaTimeStr] = useState('');
  const [metaValorStr, setMetaValorStr] = useState('');
  const [bonusStr, setBonusStr] = useState('');

  // KPIs
  const { data: allMetas = [] } = useMetas({});
  const totalMetas = allMetas.length;
  const totalAtivas = allMetas.filter(g => g.ativo).length;
  const totalIndividuais = allMetas.filter(g => g.user_id).length;
  const indicadoresComMeta = useMemo(() => {
    const set = new Set(allMetas.map(g => g.indicator_id));
    return set.size;
  }, [allMetas]);

  const filteredMetas = useMemo(() => {
    if (activeTab === 'todos') return metas;
    if (activeTab === 'individual') return metas.filter(g => g.user_id);
    if (activeTab === 'geral') return metas.filter(g => !g.user_id && !g.worker_type);
    return metas;
  }, [metas, activeTab]);
  const pg = usePagination(filteredMetas);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setMetaTimeStr(''); setFormTab('tipo'); setDialogOpen(true); };
  const openEdit = (g: GoalWithRelations) => {
    const fmt = detectFormato(g.valor_meta, g.indicators?.codigo);
    setEditing(g);
    setForm({
      indicator_id: g.indicator_id, unidade_id: g.unidade_id ?? '',
      worker_type: g.worker_type ?? '', user_id: g.user_id ?? '',
      valor_meta: g.valor_meta, valor_bonificacao: g.valor_bonificacao ?? 0, periodo_tipo: g.periodo_tipo,
      vigencia_inicio: g.vigencia_inicio, ativo: g.ativo,
      formato_meta: fmt,
    });
    setMetaTimeStr(fmt === 'tempo' && g.valor_meta ? minutesToHHMM(g.valor_meta) : '');
    setFormTab(g.user_id ? 'individual' : 'tipo');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const isIndividual = formTab === 'individual';
    const payload = {
      indicator_id: form.indicator_id,
      unidade_id: form.unidade_id || null,
      worker_type: isIndividual ? null : (form.worker_type || null),
      user_id: isIndividual ? (form.user_id || null) : null,
      valor_meta: form.valor_meta,
      valor_bonificacao: form.valor_bonificacao,
      periodo_tipo: form.periodo_tipo,
      vigencia_inicio: form.vigencia_inicio,
      vigencia_fim: null,
      ativo: form.ativo,
    };
    if (editing?.id) await updateMut.mutateAsync({ id: editing.id, ...payload });
    else await createMut.mutateAsync(payload);
    setDialogOpen(false);
  };

  const confirmToggle = async () => {
    if (toggleTarget) await toggleMut.mutateAsync({ id: toggleTarget.id, ativo: toggleTarget.ativo });
    setConfirmOpen(false); setToggleTarget(null);
  };

  const saving = createMut.isPending || updateMut.isPending;
  const activeUnits = allowedUnits;
  const activeColabs = usuarios.filter(u => u.role === 'colaborador');
  const getInitials = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const kpis = [
    { label: 'Total de Metas', value: totalMetas, icon: Target, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderColor: 'border-l-blue-500' },
    { label: 'Ativas', value: totalAtivas, icon: BarChart3, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderColor: 'border-l-emerald-500' },
    { label: 'Individuais', value: totalIndividuais, icon: User, iconBg: 'bg-orange-100', iconColor: 'text-orange-600', borderColor: 'border-l-orange-500' },
    { label: 'Indicadores c/ Meta', value: indicadoresComMeta, icon: Layers, iconBg: 'bg-violet-100', iconColor: 'text-violet-600', borderColor: 'border-l-violet-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Metas" subtitle="Defina metas para indicadores de desempenho" actionLabel="Nova Meta" onAction={openCreate} />

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
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Motorista
            </TabsTrigger>
            <TabsTrigger value="ajudante" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Ajudante
            </TabsTrigger>
            <TabsTrigger value="distribuicao" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Distribuição
            </TabsTrigger>
            <TabsTrigger value="individual" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> Individual
            </TabsTrigger>
            <TabsTrigger value="geral">Geral</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs"><SelectValue placeholder="Indicador" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.unidade_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, unidade_id: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-44 h-9 text-xs"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.ativo ?? ''} onValueChange={v => setFilters(f => ({ ...f, ativo: v === 'all' ? '' : v }))}>
            <SelectTrigger className="w-full sm:w-32 h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="true">Ativo</SelectItem><SelectItem value="false">Inativo</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredMetas.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma meta encontrada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Ajuste os filtros ou crie uma nova meta</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pg.paginatedItems.map(g => {
              const scope = getScope(g);
              const scopeConf = SCOPE_CONFIG[scope];
              const ScopeIcon = scopeConf.icon;
              const periodo = PERIODOS.find(p => p.value === g.periodo_tipo);
              const indicatorName = g.indicators?.nome ?? '—';
              const unitName = g.units?.nome;
              const userName = g.users?.nome;

              return (
                <div
                  key={g.id}
                  className={cn(
                    'group relative rounded-xl border bg-card shadow-sm transition-all hover:shadow-md overflow-hidden',
                    !g.ativo && 'opacity-60'
                  )}
                >
                  {/* Top color bar */}
                  <div className={cn('h-1.5', scope === 'motorista' ? 'bg-emerald-500' : scope === 'ajudante' ? 'bg-violet-500' : scope === 'individual' ? 'bg-orange-500' : 'bg-primary/40')} />

                  <div className="p-4 space-y-3">
                    {/* Header: indicator + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', scopeConf.bg)}>
                          <ScopeIcon className={cn('h-4 w-4', scopeConf.color)} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{indicatorName}</p>
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', scopeConf.color)}>
                            {scopeConf.label}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={g.ativo ? 'ativo' : 'inativo'} />
                    </div>

                    {/* Value highlight */}
                    <div className="flex items-baseline gap-1.5 bg-muted/40 rounded-lg px-3 py-2.5">
                      <Target className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-2xl font-bold text-foreground">
                        {['TML','TR','TI','JL'].includes(g.indicators?.codigo?.toUpperCase() ?? '')
                          ? formatMinutesHHMM(g.valor_meta)
                          : g.valor_meta > 200
                            ? formatMinutesHHMM(g.valor_meta)
                            : `${g.valor_meta}%`}
                      </span>
                      
                      <span className="ml-auto text-xs text-muted-foreground bg-background rounded-md px-2 py-0.5 border">
                        {periodo?.label ?? g.periodo_tipo}
                      </span>
                    </div>

                    {/* Bonus value */}
                    {g.valor_bonificacao > 0 && (
                      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">💰 Bonificação:</span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">R$ {g.valor_bonificacao.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {userName && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-semibold">
                              {getInitials(userName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{userName}</span>
                        </div>
                      )}
                      {unitName && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{unitName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Início: {format(new Date(g.vigencia_inicio + 'T00:00:00'), 'dd/MM/yy')}
                          </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <Separator />
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => openEdit(g)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={() => { setToggleTarget(g); setConfirmOpen(true); }}>
                        <Power className="h-3.5 w-3.5" /> {g.ativo ? 'Inativar' : 'Ativar'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination page={pg.page} totalPages={pg.totalPages} from={pg.from} to={pg.to} totalCount={pg.totalCount} onPageChange={pg.setPage} />
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <div className="px-6 pt-6 pb-4 border-b border-border/50">
            <DialogHeader>
              <DialogTitle className="text-lg">{editing ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="grid w-full grid-cols-2 mb-5">
                <TabsTrigger value="tipo">Por Tipo</TabsTrigger>
                <TabsTrigger value="individual">Individual</TabsTrigger>
              </TabsList>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Indicador *</Label>
                  <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <TabsContent value="tipo" className="mt-0 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Colaborador</Label>
                    <div className="flex gap-2">
                      {[
                        { v: '', l: 'Todos', bg: 'bg-muted text-muted-foreground border-border' },
                        { v: 'motorista', l: 'Motorista', bg: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                        { v: 'ajudante', l: 'Ajudante', bg: 'bg-violet-100 text-violet-700 border-violet-300' },
                      ].map(o => (
                        <button
                          key={o.v}
                          type="button"
                          className={cn(
                            'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                            (form.worker_type ?? '') === o.v
                              ? cn(o.bg, 'border-2 shadow-sm')
                              : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                          )}
                          onClick={() => setForm(f => ({ ...f, worker_type: o.v || null }))}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="individual" className="mt-0 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Colaborador *</Label>
                    <Select value={form.user_id ?? ''} onValueChange={v => setForm(f => ({ ...f, user_id: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{activeColabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <div className="space-y-1.5">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={form.unidade_id ?? ''} onValueChange={v => setForm(f => ({ ...f, unidade_id: v === 'none' ? null : v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Todas</SelectItem>{activeUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Formato da Meta</Label>
                  <div className="flex gap-2">
                    {[
                      { v: 'tempo' as const, l: '⏱ Tempo (HH:MM)' },
                      { v: 'porcentagem' as const, l: '% Porcentagem' },
                    ].map(o => (
                      <button
                        key={o.v}
                        type="button"
                        className={cn(
                          'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                          form.formato_meta === o.v
                            ? 'border-2 border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        )}
                        onClick={() => { setForm(f => ({ ...f, formato_meta: o.v, valor_meta: 0 })); setMetaTimeStr(''); }}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor da Meta *</Label>
                    {form.formato_meta === 'tempo' ? (
                      <Input
                        type="text"
                        placeholder="HH:MM (ex: 09:20)"
                        value={metaTimeStr}
                        onChange={e => {
                          let v = e.target.value.replace(/[^0-9:]/g, '');
                          if (v.length > 5) v = v.slice(0, 5);
                          setMetaTimeStr(v);
                          const mins = parseHHMM(v);
                          setForm(f => ({ ...f, valor_meta: mins }));
                        }}
                        className="h-9"
                      />
                    ) : (
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Ex: 95.5"
                        value={form.valor_meta || ''}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                          setForm(f => ({ ...f, valor_meta: v === '' ? 0 : Number(v) }));
                        }}
                        className="h-9"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bonificação (R$)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 50.00"
                      value={form.valor_bonificacao || ''}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                        setForm(f => ({ ...f, valor_bonificacao: v === '' ? 0 : Number(v) }));
                      }}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Período</Label>
                    <Select value={form.periodo_tipo} onValueChange={v => setForm(f => ({ ...f, periodo_tipo: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{PERIODOS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Início *</Label>
                    <DatePick value={form.vigencia_inicio} onChange={v => setForm(f => ({ ...f, vigencia_inicio: v }))} placeholder="Selecione" />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <Label className="text-sm">Meta Ativa</Label>
                  <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
                </div>
              </div>
            </Tabs>
          </div>
          <div className="px-6 pb-6 flex gap-2 justify-end border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.indicator_id || (formTab === 'individual' && !form.user_id)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} title={toggleTarget?.ativo ? 'Inativar meta' : 'Ativar meta'}
        description={`Deseja ${toggleTarget?.ativo ? 'inativar' : 'ativar'} esta meta?`}
        confirmLabel={toggleTarget?.ativo ? 'Inativar' : 'Ativar'} onConfirm={confirmToggle}
        onCancel={() => { setConfirmOpen(false); setToggleTarget(null); }} loading={toggleMut.isPending} />
    </div>
  );
}
