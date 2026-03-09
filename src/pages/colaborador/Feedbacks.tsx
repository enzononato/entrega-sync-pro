import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedbacksDoColaborador, useCreateFeedback, type FeedbackWithRelations } from '@/hooks/useFeedbacks';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { MessageSquare, Send, Loader2, ChevronRight, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROBLEMAS_RAPIDOS = [
  { id: 'rota', tipo: 'operacao', label: 'Rota com problemas', desc: 'Falto intenso, ausências and latidger da entrega', urgencia: 'media' },
  { id: 'cliente', tipo: 'operacao', label: 'Cliente reclamou', desc: 'Da falta de produto de amostrição', urgencia: 'alta' },
  { id: 'sistema', tipo: 'sistema', label: 'Sistema travou na expedição', desc: 'Atrasando dat baligãas', urgencia: 'alta' },
  { id: 'veiculo', tipo: 'incidente', label: 'Veículo com problema mecânico', desc: 'Necessário manutenção urgente', urgencia: 'critica' },
  { id: 'carga', tipo: 'processo', label: 'Erro na separação de carga', desc: 'Produtos errados ou faltando', urgencia: 'media' },
];

const URGENCIAS_COLOR: Record<string, string> = {
  baixa: 'text-muted-foreground',
  media: 'text-warning',
  alta: 'text-orange-500',
  critica: 'text-destructive',
};

export default function FeedbacksColaborador() {
  const { user } = useAuth();
  const { data: feedbacks = [], isLoading } = useFeedbacksDoColaborador(user?.id);
  const createMut = useCreateFeedback();

  const [selected, setSelected] = useState<string[]>([]);
  const [sugestao, setSugestao] = useState('');
  const [viewFeedback, setViewFeedback] = useState<FeedbackWithRelations | null>(null);

  const enviados = feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status));
  const respondidos = feedbacks.filter(f => ['respondido', 'encerrado'].includes(f.status));

  const toggleProblem = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleEnviar = async () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    // Send selected quick problems
    for (const id of selected) {
      const prob = PROBLEMAS_RAPIDOS.find(p => p.id === id);
      if (!prob) continue;
      await createMut.mutateAsync({
        user_id: user.id,
        unidade_id: user.unidade_id,
        rota_id: user.rota_id,
        data_referencia: today,
        tipo: prob.tipo,
        titulo: prob.label,
        descricao: prob.desc,
        urgencia: prob.urgencia,
      });
    }

    // Send suggestion if provided
    if (sugestao.trim().length >= 10) {
      await createMut.mutateAsync({
        user_id: user.id,
        unidade_id: user.unidade_id,
        rota_id: user.rota_id,
        data_referencia: today,
        tipo: 'sugestao',
        titulo: 'Sugestão do colaborador',
        descricao: sugestao.trim(),
        urgencia: 'baixa',
      });
    }

    setSelected([]);
    setSugestao('');
  };

  const canSend = selected.length > 0 || sugestao.trim().length >= 10;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5 animate-fade-up pb-24">
      <h1 className="text-lg font-bold text-foreground">Feedback Diário</h1>

      {/* Quick problems section */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Como foi seu dia hoje?</h2>
        <div className="card-elevated divide-y divide-border/40">
          {PROBLEMAS_RAPIDOS.map(prob => (
            <label
              key={prob.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors',
                selected.includes(prob.id) ? 'bg-primary/5' : 'hover:bg-muted/30'
              )}
            >
              <Checkbox
                checked={selected.includes(prob.id)}
                onCheckedChange={() => toggleProblem(prob.id)}
                className="mt-0.5 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{prob.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{prob.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Suggestion section */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Tem alguma sugestão ou solução?</h2>
        <div className="card-elevated p-4 space-y-3">
          <Textarea
            value={sugestao}
            onChange={e => setSugestao(e.target.value)}
            placeholder="Descreva sua sugestão ou solução para melhorar o dia a dia..."
            rows={4}
            className="resize-none"
            maxLength={1000}
          />
          <p className="text-[10px] text-muted-foreground text-right">{sugestao.length}/1000</p>
        </div>
      </section>

      {/* Send button */}
      <Button
        className="w-full h-12 rounded-xl text-base font-semibold gap-2"
        disabled={!canSend || createMut.isPending}
        onClick={handleEnviar}
      >
        {createMut.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        Enviar Feedback
      </Button>

      {/* Recent feedbacks */}
      {(enviados.length > 0 || respondidos.length > 0) && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Feedbacks Recentes</h2>
          <div className="card-elevated divide-y divide-border/40">
            {[...enviados, ...respondidos].slice(0, 5).map(f => (
              <div
                key={f.id}
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => f.resposta_lideranca && setViewFeedback(f)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{f.titulo}</p>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>
                {f.resposta_lideranca && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* View response dialog */}
      <Dialog open={!!viewFeedback} onOpenChange={() => setViewFeedback(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewFeedback?.titulo}</DialogTitle></DialogHeader>
          {viewFeedback && (
            <div className="space-y-3 py-2">
              <div className="flex gap-2 flex-wrap">
                <StatusBadge status={viewFeedback.urgencia} />
                <StatusBadge status={viewFeedback.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(viewFeedback.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="text-sm text-foreground">{viewFeedback.descricao}</p>
              {viewFeedback.resposta_lideranca && (
                <>
                  <Separator />
                  <div className="rounded-lg bg-muted/50 p-3">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Resposta da Liderança</h4>
                    {viewFeedback.responded_at && (
                      <p className="text-[10px] text-muted-foreground mb-2">
                        {format(new Date(viewFeedback.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    <p className="text-sm text-foreground">{viewFeedback.resposta_lideranca}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
