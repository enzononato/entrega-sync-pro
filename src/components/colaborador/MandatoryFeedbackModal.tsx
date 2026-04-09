import { useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateCausaRaiz } from '@/hooks/useCausaRaiz';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Loader2, ChevronRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingIndicator {
  id: string;
  indicator_id: string;
  valor: number;
  meta: number | null;
  percentual_atingimento: number | null;
  indicators: { nome: string; codigo: string } | null;
}

interface Props {
  pendingIndicators: PendingIndicator[];
  onComplete: () => void;
}

const CATEGORIAS = [
  { value: 'operacional', label: 'Problema Operacional' },
  { value: 'sistema', label: 'Falha de Sistema' },
  { value: 'rota', label: 'Problema na Rota' },
  { value: 'veiculo', label: 'Problema com Veículo' },
  { value: 'cliente', label: 'Problema com Cliente' },
  { value: 'pessoal', label: 'Motivo Pessoal' },
  { value: 'outro', label: 'Outro' },
];

export function MandatoryFeedbackModal({ pendingIndicators, onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createCausa = useCreateCausaRaiz();
  const qc = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const current = pendingIndicators[currentIndex];
  const isLast = currentIndex === pendingIndicators.length - 1;
  const canSubmit = categoria && descricao.trim().length >= 10;

  if (!current || !user) return null;

  const atingiu = (current.percentual_atingimento ?? 0) >= 100;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createCausa.mutateAsync({
        user_id: user.id,
        indicator_id: current.indicator_id,
        data_referencia: format(new Date(), 'yyyy-MM-dd'),
        descricao_problema: descricao.trim(),
        categoria_causa: categoria,
        causa_raiz: descricao.trim(),
        impacto: `Status: Não Atingiu`,
      });

      if (isLast) {
        qc.invalidateQueries({ queryKey: ['mandatory_feedback_check'] });
        toast({ title: 'Feedbacks registrados com sucesso!' });
        onComplete();
      } else {
        setCurrentIndex(i => i + 1);
        setCategoria('');
        setDescricao('');
      }
    } catch {
      toast({ title: 'Erro ao salvar. Tente novamente.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-md mx-auto"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <DialogTitle className="text-base">Feedback Obrigatório</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {pendingIndicators.length > 1
              ? `Indicador ${currentIndex + 1} de ${pendingIndicators.length} — informe o motivo do não atingimento.`
              : 'Informe o motivo do não atingimento da meta antes de continuar.'}
          </DialogDescription>
        </DialogHeader>

        {/* Indicator info */}
        <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-1">
          <p className="text-sm font-semibold text-foreground">{current.indicators?.nome ?? 'Indicador'}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Realizado: <strong className="text-destructive">{current.valor}</strong></span>
            <span>Meta: <strong>{current.meta ?? '—'}</strong></span>
            <span className="text-destructive font-bold">Não Atingiu ✗</span>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">Categoria do problema</label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria..." />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">O que aconteceu? (mín. 10 caracteres)</label>
          <Textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Descreva o motivo do não atingimento da meta..."
            rows={3}
            className="resize-none"
            maxLength={500}
          />
          <p className="text-[10px] text-muted-foreground text-right">{descricao.length}/500</p>
        </div>

        {/* Progress dots */}
        {pendingIndicators.length > 1 && (
          <div className="flex items-center justify-center gap-1.5">
            {pendingIndicators.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  i < currentIndex ? 'bg-success' : i === currentIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>
        )}

        {/* Submit */}
        <Button
          className="w-full h-11 gap-2"
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLast ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {isLast ? 'Enviar e Continuar' : 'Próximo Indicador'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
