import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useCausaRaizPorColaborador, useCreateCausaRaiz, useCreateActionPlan } from '@/hooks/useCausaRaiz';
import { useIndicadoresByWorkerType } from '@/hooks/useIndicadores';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Plus, AlertTriangle, CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['Logística', 'Qualidade', 'Processo', 'Externo', 'Equipamento', 'Pessoal', 'Outro'];

const catColors: Record<string, string> = {
  Logística: 'bg-blue-100 text-blue-700',
  Qualidade: 'bg-emerald-100 text-emerald-700',
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

export default function CausaRaizColaborador() {
  const { user } = useAuth();
  const { data: causas = [], isLoading } = useCausaRaizPorColaborador(user?.id);
  const { data: indicators = [] } = useIndicadoresByWorkerType(user?.worker_type ?? undefined);
  const createCausa = useCreateCausaRaiz();
  const createPlan = useCreateActionPlan();
  const { toast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    data_referencia: format(new Date(), 'yyyy-MM-dd'),
    indicator_id: '',
    descricao_problema: '',
    impacto: '',
    categoria_causa: '',
    causa_raiz: '',
    acao: '',
    prazo: '',
  });

  const openSheet = () => {
    setForm({ data_referencia: format(new Date(), 'yyyy-MM-dd'), indicator_id: '', descricao_problema: '', impacto: '', categoria_causa: '', causa_raiz: '', acao: '', prazo: '' });
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
    <div className="relative min-h-[60vh]">
      <h1 className="text-xl font-bold text-foreground mb-4">Causa Raiz</h1>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : causas.length === 0 ? (
        <EmptyState
          titulo="Nenhum registro de causa raiz"
          descricao="Registre problemas e suas causas para acompanhamento"
          icon={<AlertTriangle className="h-10 w-10" />}
          actionLabel="Registrar Primeiro Problema"
          onAction={openSheet}
        />
      ) : (
        <div className="space-y-3 pb-20">
          {causas.map((c: any) => (
            <div key={c.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  {c.indicators?.codigo}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(c.data_referencia + 'T00:00:00'), "dd 'de' MMM", { locale: ptBR })}
                </span>
              </div>
              <p className="text-sm text-foreground line-clamp-2">{c.descricao_problema}</p>
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', catColors[c.categoria_causa] ?? catColors.Outro)}>
                  {c.categoria_causa}
                </span>
              </div>
              {c.impacto && <p className="text-xs text-muted-foreground line-clamp-1">{c.impacto}</p>}
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <Button className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50" onClick={openSheet}>
        <Plus className="h-6 w-6" />
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

          {/* Progress */}
          <div className="flex gap-1 my-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn('h-1 flex-1 rounded-full', s <= step ? 'bg-primary' : 'bg-muted')} />
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
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Descrição do Problema * <span className="text-xs text-muted-foreground">(mín. 20 caracteres)</span></Label>
                <Textarea value={form.descricao_problema} onChange={e => setForm(f => ({ ...f, descricao_problema: e.target.value }))} rows={4} placeholder="Descreva o problema..." />
              </div>
              <div className="space-y-1">
                <Label>Impacto percebido</Label>
                <Textarea value={form.impacto} onChange={e => setForm(f => ({ ...f, impacto: e.target.value }))} rows={2} placeholder="Qual foi o impacto?" />
              </div>
              <Button className="w-full" disabled={!canNext1} onClick={() => setStep(2)}>
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
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Causa Raiz * <span className="text-xs text-muted-foreground">(mín. 20 caracteres)</span></Label>
                <Textarea value={form.causa_raiz} onChange={e => setForm(f => ({ ...f, causa_raiz: e.target.value }))} rows={4} placeholder="Por que aconteceu? Use os 5 Porquês..." />
              </div>
              <Button className="w-full" disabled={!canNext2} onClick={() => setStep(3)}>
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
                <Textarea value={form.acao} onChange={e => setForm(f => ({ ...f, acao: e.target.value }))} rows={4} placeholder="O que será feito para resolver?" />
              </div>
              <div className="space-y-1">
                <Label>Prazo</Label>
                <DatePick value={form.prazo} onChange={v => setForm(f => ({ ...f, prazo: v }))} placeholder="Selecione" minDate={tomorrow} />
              </div>
              <Button className="w-full" disabled={!canSave || saving} onClick={handleSave}>
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
