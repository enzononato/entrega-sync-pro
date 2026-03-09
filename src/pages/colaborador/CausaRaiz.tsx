import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useCausaRaizPorColaborador, useCreateCausaRaiz, useCreateActionPlan } from '@/hooks/useCausaRaiz';
import { useIndicadoresByWorkerType } from '@/hooks/useIndicadores';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
import { CircularProgress } from '@/components/shared/CircularProgress';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Plus, AlertTriangle, CalendarIcon, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['Logística', 'Qualidade', 'Processo', 'Externo', 'Equipamento', 'Pessoal', 'Outro'];

const catColors: Record<string, string> = {
  Logística: 'bg-blue-100 text-blue-700',
  Qualidade: 'bg-sky-100 text-sky-700',
  Processo: 'bg-amber-100 text-amber-700',
  Externo: 'bg-purple-100 text-purple-700',
  Equipamento: 'bg-red-100 text-red-700',
  Pessoal: 'bg-pink-100 text-pink-700',
  Outro: 'bg-gray-100 text-gray-600',
};

function DatePick({ value, onChange, placeholder, minDate }: { value: string; onChange: (v: string) => void; placeholder: string; minDate?: Date }) {
  const date = value ? new Date(value + 'T00:00:00') : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('w-full justify-start text-left font-normal rounded-xl', !value && 'text-muted-foreground')}>
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

export default function CausaRaizColaborador() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: causas = [], isLoading } = useCausaRaizPorColaborador(user?.id);
  const { data: indicators = [] } = useIndicadoresByWorkerType(user?.worker_type ?? undefined);
  const { data: desempenho = [] } = useDesempenhoDiario(today, { user_id: user?.id });
  const createCausa = useCreateCausaRaiz();
  const createPlan = useCreateActionPlan();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    data_referencia: today,
    indicator_id: '',
    descricao_problema: '',
    impacto: '',
    categoria_causa: '',
    causa_raiz: '',
    acao: '',
    prazo: '',
  });

  const totalCausas = causas.length;
  const causasRecentes = causas.filter(c => {
    const d = new Date(c.created_at);
    return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
  }).length;

  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    causas.forEach(c => { map[c.categoria_causa] = (map[c.categoria_causa] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [causas]);

  const porquesCompletos = useMemo(() => {
    if (causas.length === 0) return 0;
    const comCausaDetalhada = causas.filter(c => c.causa_raiz && c.causa_raiz.length >= 50).length;
    return Math.round((comCausaDetalhada / causas.length) * 100);
  }, [causas]);

  const kpisBelowTarget = useMemo(() => {
    return desempenho.filter(d => d.status === 'abaixo_meta');
  }, [desempenho]);

  const openSheet = () => {
    setForm({ data_referencia: today, indicator_id: '', descricao_problema: '', impacto: '', categoria_causa: '', causa_raiz: '', acao: '', prazo: '' });
    setStep(1);
    setSheetOpen(true);
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const causa = await createCausa.mutateAsync({
        user_id: user.id,
        indicator_id: form.indicator_id,
        data_referencia: form.data_referencia,
        descricao_problema: form.descricao_problema,
        categoria_causa: form.categoria_causa,
        causa_raiz: form.causa_raiz,
        impacto: form.impacto,
      });
      if (form.acao) {
        await createPlan.mutateAsync({
          root_cause_id: (causa as any).id,
          responsavel_user_id: user.id,
          descricao_acao: form.acao,
          prazo: form.prazo || null,
        });
      }
      toast({ title: 'Problema registrado e plano de ação criado!' });
      setSheetOpen(false);
    } catch {
      toast({ title: 'Erro ao salvar.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const canNext1 = form.indicator_id && form.descricao_problema.length >= 20;
  const canNext2 = form.categoria_causa && form.causa_raiz.length >= 20;
  const canSave = form.acao.length > 0;

  return (
    <div className="space-y-5 stagger-children relative min-h-[60vh]">
      <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Search className="h-5 w-5 text-primary" /> Análise de Causa Raiz
      </h1>

      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden shadow-lg">
        <div className="gradient-hero p-5">
          <div className="flex items-center gap-5">
            <CircularProgress value={porquesCompletos} size={80} strokeWidth={6}>
              <span className="text-lg font-bold text-white">{porquesCompletos}%</span>
            </CircularProgress>
            <div className="flex-1 text-white">
              <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Qualidade das Análises</p>
              <p className="text-sm mt-1 text-white/80">
                {porquesCompletos >= 80
                  ? 'Excelente! Causas bem detalhadas'
                  : porquesCompletos >= 50
                    ? 'Bom progresso. Continue detalhando!'
                    : 'Detalhe mais suas análises de causa raiz'}
              </p>
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white mt-2">
                {totalCausas} registro{totalCausas !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border/40 bg-card">
          <div className="p-3.5 text-center">
            <p className="text-lg font-bold text-foreground">{causasRecentes}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Últimos 30 dias</p>
          </div>
          <div className="p-3.5 text-center">
            <p className="text-lg font-bold text-foreground">{catBreakdown.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Categorias</p>
          </div>
        </div>
      </div>

      {/* KPIs abaixo da meta */}
      {kpisBelowTarget.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" /> KPIs Abaixo da Meta
          </h2>
          <div className="card-elevated divide-y divide-border/40 overflow-hidden">
            {kpisBelowTarget.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">{d.indicators?.nome ?? ''}</span>
                    <span className="text-sm font-bold text-destructive ml-2 shrink-0">{(d.percentual_atingimento ?? 0).toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={d.percentual_atingimento ?? 0} color="red" className="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Categorias mais frequentes */}
      {catBreakdown.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Categorias Frequentes</h2>
          <div className="flex flex-wrap gap-2">
            {catBreakdown.slice(0, 5).map(([cat, count]) => (
              <span key={cat} className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium gap-1', catColors[cat] ?? catColors.Outro)}>
                {cat} <span className="font-bold">({count})</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Registros recentes */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Registros Recentes</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : causas.length === 0 ? (
          <EmptyState
            titulo="Nenhum registro de causa raiz"
            descricao="Registre problemas e suas causas para acompanhar"
            icon={<AlertTriangle className="h-10 w-10" />}
            actionLabel="Registrar Problema"
            onAction={openSheet}
          />
        ) : (
          <div className="card-elevated divide-y divide-border/40 overflow-hidden">
            {causas.slice(0, 5).map((c: any) => (
              <div key={c.id} className="px-4 py-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center rounded-lg bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                    {c.indicators?.codigo}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(new Date(c.data_referencia + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2 font-medium">{c.descricao_problema}</p>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', catColors[c.categoria_causa] ?? catColors.Outro)}>
                  {c.categoria_causa}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FAB */}
      <Button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-xl z-50 gradient-primary hover:opacity-90"
        onClick={openSheet}
      >
        <Plus className="h-6 w-6 text-white" />
      </Button>

      {/* Sheet stepper */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {step === 1 && 'Etapa 1 — O Problema'}
              {step === 2 && 'Etapa 2 — A Causa'}
              {step === 3 && 'Etapa 3 — Plano de Ação'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex gap-1 my-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', s <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Data de Referência</Label>
                <DatePick value={form.data_referencia} onChange={v => setForm(f => ({ ...f, data_referencia: v }))} placeholder="Hoje" />
              </div>
              <div className="space-y-1">
                <Label>Indicador com Problema *</Label>
                <Select value={form.indicator_id} onValueChange={v => setForm(f => ({ ...f, indicator_id: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Descrição do Problema * <span className="text-xs text-muted-foreground">(mín. 20 caracteres)</span></Label>
                <Textarea value={form.descricao_problema} onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} rows={4} placeholder="Descreva o problema..." maxLength={500} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Impacto percebido</Label>
                <Textarea value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: e.target.value }))} rows={2} placeholder="Qual foi o impacto?" maxLength={300} className="rounded-xl" />
              </div>
              <Button className="w-full rounded-xl h-11 gradient-primary text-white" disabled={!canNext1} onClick={() => setStep(2)}>
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <div className="space-y-1">
                <Label>Categoria da Causa *</Label>
                <Select value={form.categoria_causa} onValueChange={v => setForm(f => ({ ...f, categoria_causa: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Causa Raiz * <span className="text-xs text-muted-foreground">(mín. 20 caracteres)</span></Label>
                <Textarea value={form.causa_raiz} onChange={e => setForm(f => ({ ...f, causa_raiz: e.target.value }))} rows={4} placeholder="Por que aconteceu? Use os 5 Porquês..." maxLength={500} className="rounded-xl" />
              </div>
              <Button className="w-full rounded-xl h-11 gradient-primary text-white" disabled={!canNext2} onClick={() => setStep(3)}>
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <div className="space-y-1">
                <Label>Descrição da Ação *</Label>
                <Textarea value={form.acao} onChange={e => setForm(f => ({ ...f, acao: e.target.value }))} rows={4} placeholder="O que será feito para resolver?" maxLength={500} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Prazo</Label>
                <DatePick value={form.prazo} onChange={v => setForm(f => ({ ...f, prazo: v }))} placeholder="Selecione" minDate={tomorrow} />
              </div>
              <Button className="w-full rounded-xl h-11 gradient-primary text-white" disabled={!canSave || saving} onClick={handleSave}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Tudo
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
