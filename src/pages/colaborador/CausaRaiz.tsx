import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useCausaRaizPorColaborador, useCreateCausaRaiz, useCreateActionPlan } from '@/hooks/useCausaRaiz';
import { useIndicadoresByWorkerType } from '@/hooks/useIndicadores';
import { useDesempenhoDiario } from '@/hooks/useDesempenho';
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
import {
  Plus, AlertTriangle, CalendarIcon, ChevronLeft, ChevronRight,
  Loader2, Search, FileText, Lightbulb, CheckCircle2, XCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['Logística', 'Qualidade', 'Processo', 'Externo', 'Equipamento', 'Pessoal', 'Outro'];

const catConfig: Record<string, { bg: string; dot: string }> = {
  Logística:   { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',   dot: 'bg-blue-500' },
  Qualidade:   { bg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400',       dot: 'bg-sky-500' },
  Processo:    { bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', dot: 'bg-amber-500' },
  Externo:     { bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400', dot: 'bg-purple-500' },
  Equipamento: { bg: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',       dot: 'bg-red-500' },
  Pessoal:     { bg: 'bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400',   dot: 'bg-pink-500' },
  Outro:       { bg: 'bg-muted text-muted-foreground',                                     dot: 'bg-muted-foreground' },
};

function getCatConfig(cat: string) {
  return catConfig[cat] ?? catConfig.Outro;
}

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
  const [showAllRecords, setShowAllRecords] = useState(false);

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

  const kpisBelowTarget = useMemo(() => desempenho.filter(d => d.status === 'abaixo_meta'), [desempenho]);

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

  const visibleCausas = showAllRecords ? causas : causas.slice(0, 4);

  return (
    <div className="space-y-5 stagger-children relative min-h-[60vh] pb-2">
      {/* ── Header ─────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" /> Análise de Causa Raiz
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Registre problemas e acompanhe ações corretivas</p>
      </div>

      {/* ── Hero Stats ─────────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
        <div className="p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Registros no mês</p>
              <p className="text-4xl font-extrabold mt-1 leading-none">{causasRecentes}</p>
              <p className="text-[11px] text-white/40 mt-1">{totalCausas} total</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Lightbulb className="h-7 w-7 text-white/80" />
            </div>
          </div>
        </div>

        {/* Category pills inside hero */}
        {catBreakdown.length > 0 && (
          <div className="px-5 pb-4 flex flex-wrap gap-1.5">
            {catBreakdown.slice(0, 4).map(([cat, count]) => (
              <span key={cat} className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2.5 py-1 text-[10px] font-medium text-white">
                <span className={cn('h-1.5 w-1.5 rounded-full', getCatConfig(cat).dot)} />
                {cat} ({count})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── KPIs Abaixo da Meta (alertas) ──────── */}
      {kpisBelowTarget.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-3">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="text-sm font-bold text-foreground">KPIs Abaixo da Meta Hoje</h2>
          </div>
          <div className="card-elevated rounded-2xl divide-y divide-border/40 overflow-hidden">
            {kpisBelowTarget.map(d => (
              <div key={d.id} className="px-4 py-3 flex items-center gap-3">
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
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
          {/* Quick action to register */}
          <button
            onClick={openSheet}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-primary py-2 rounded-xl bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Registrar análise para indicador abaixo da meta
          </button>
        </section>
      )}

      {/* ── Registros ─────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" /> Registros Recentes
          </h2>
          {totalCausas > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 font-medium">
              {totalCausas}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : causas.length === 0 ? (
          <EmptyState
            titulo="Nenhum registro ainda"
            descricao="Registre problemas e suas causas para acompanhar"
            icon={<Search className="h-10 w-10" />}
            actionLabel="Registrar Problema"
            onAction={openSheet}
          />
        ) : (
          <>
            <div className="card-elevated rounded-2xl divide-y divide-border/40 overflow-hidden">
              {visibleCausas.map((c: any) => {
                const cfg = getCatConfig(c.categoria_causa);
                return (
                  <div key={c.id} className="px-4 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5">
                            {c.indicators?.codigo}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(c.data_referencia + 'T00:00:00'), "dd MMM", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground font-medium line-clamp-2 leading-snug">{c.descricao_problema}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', cfg.bg)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                            {c.categoria_causa}
                          </span>
                          {c.causa_raiz && c.causa_raiz.length >= 50 && (
                            <CheckCircle2 className="h-3 w-3 text-success" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {causas.length > 4 && (
              <button
                onClick={() => setShowAllRecords(p => !p)}
                className="w-full mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-primary py-2 rounded-xl hover:bg-primary/5 transition-colors"
              >
                {showAllRecords ? (
                  <>Mostrar menos <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Ver todos ({causas.length}) <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </>
        )}
      </section>

      {/* ── FAB ────────────────────────────────── */}
      <Button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-xl z-50 gradient-primary hover:opacity-90"
        onClick={openSheet}
      >
        <Plus className="h-6 w-6 text-white" />
      </Button>

      {/* ── Sheet Stepper ─────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {step === 1 && <><AlertTriangle className="h-4 w-4 text-destructive" /> O Problema</>}
              {step === 2 && <><Lightbulb className="h-4 w-4 text-warning" /> A Causa</>}
              {step === 3 && <><CheckCircle2 className="h-4 w-4 text-success" /> Plano de Ação</>}
            </SheetTitle>
          </SheetHeader>

          {/* Progress steps */}
          <div className="flex gap-1.5 my-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  'h-1.5 w-full rounded-full transition-all duration-300',
                  s < step ? 'bg-success' : s === step ? 'bg-primary' : 'bg-muted'
                )} />
                <span className={cn(
                  'text-[9px] font-medium transition-colors',
                  s <= step ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {s === 1 ? 'Problema' : s === 2 ? 'Causa' : 'Ação'}
                </span>
              </div>
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
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o indicador" /></SelectTrigger>
                  <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>
                  Descrição do Problema *
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({form.descricao_problema.length}/20 mín.)
                  </span>
                </Label>
                <Textarea value={form.descricao_problema} onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} rows={4} placeholder="Descreva o que aconteceu..." maxLength={500} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Impacto percebido</Label>
                <Textarea value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: e.target.value }))} rows={2} placeholder="Qual foi o impacto?" maxLength={300} className="rounded-xl" />
              </div>
              <Button className="w-full rounded-xl h-12 gradient-primary text-white font-semibold" disabled={!canNext1} onClick={() => setStep(2)}>
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="rounded-lg">
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <div className="space-y-1">
                <Label>Categoria da Causa *</Label>
                <Select value={form.categoria_causa} onValueChange={v => setForm(f => ({ ...f, categoria_causa: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>
                  Causa Raiz *
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({form.causa_raiz.length}/20 mín.)
                  </span>
                </Label>
                <Textarea value={form.causa_raiz} onChange={e => setForm(f => ({ ...f, causa_raiz: e.target.value }))} rows={4} placeholder="Por que aconteceu? Use os 5 Porquês..." maxLength={500} className="rounded-xl" />
              </div>

              {/* Dica */}
              <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 flex gap-2">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Dica:</strong> Pergunte "por quê?" pelo menos 5 vezes para chegar na causa real do problema.
                </p>
              </div>

              <Button className="w-full rounded-xl h-12 gradient-primary text-white font-semibold" disabled={!canNext2} onClick={() => setStep(3)}>
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="rounded-lg">
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
              <div className="space-y-1">
                <Label>Descrição da Ação Corretiva *</Label>
                <Textarea value={form.acao} onChange={e => setForm(f => ({ ...f, acao: e.target.value }))} rows={4} placeholder="O que será feito para resolver?" maxLength={500} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Prazo</Label>
                <DatePick value={form.prazo} onChange={v => setForm(f => ({ ...f, prazo: v }))} placeholder="Selecione o prazo" minDate={tomorrow} />
              </div>
              <Button className="w-full rounded-xl h-12 gradient-primary text-white font-semibold" disabled={!canSave || saving} onClick={handleSave}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Análise
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
