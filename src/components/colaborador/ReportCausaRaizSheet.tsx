import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useCreateCausaRaiz, useCreateActionPlan } from '@/hooks/useCausaRaiz';
import { toast } from 'sonner';
import { AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  indicatorId: string;
  dataReferencia: string;
  indicatorNome: string;
}

const CATEGORIAS = [
  { value: 'Veículo', label: 'Veículo' },
  { value: 'Rota', label: 'Rota' },
  { value: 'Clima', label: 'Clima' },
  { value: 'Sistema', label: 'Sistema' },
  { value: 'Pessoal', label: 'Pessoal' },
  { value: 'Outro', label: 'Outro' },
];

export function ReportCausaRaizSheet({ open, onClose, userId, indicatorId, dataReferencia, indicatorNome }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [causaRaiz, setCausaRaiz] = useState('');
  const [acao, setAcao] = useState('');
  const [prazo, setPrazo] = useState('');

  const createCausa = useCreateCausaRaiz();
  const createPlan = useCreateActionPlan();
  const saving = createCausa.isPending || createPlan.isPending;

  const resetAndClose = () => {
    setStep(1);
    setDescricao('');
    setCategoria('');
    setCausaRaiz('');
    setAcao('');
    setPrazo('');
    onClose();
  };

  const handleSave = async () => {
    try {
      const causa = await createCausa.mutateAsync({
        user_id: userId,
        indicator_id: indicatorId,
        data_referencia: dataReferencia,
        descricao_problema: descricao,
        categoria_causa: categoria,
        causa_raiz: causaRaiz,
        impacto: 'Indicador abaixo da meta',
      });

      if (acao.trim()) {
        await createPlan.mutateAsync({
          root_cause_id: causa.id,
          responsavel_user_id: userId,
          descricao_acao: acao,
          prazo: prazo || null,
        });
      }

      toast.success('Causa raiz e plano registrados!');
      resetAndClose();
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
    }
  };

  const step1Valid = descricao.trim() && categoria && causaRaiz.trim();

  return (
    <Drawer open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <DrawerTitle className="text-base">
              {step === 1 ? 'Causa Raiz' : 'Plano de Ação'}
            </DrawerTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{indicatorNome}</p>
          <div className="flex gap-1.5 mt-3">
            <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </DrawerHeader>

        <div className="px-4 py-3 space-y-4 overflow-y-auto">
          {step === 1 ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Descrição do problema</Label>
                <Textarea
                  placeholder="O que aconteceu?"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="min-h-[70px] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={categoria} onValueChange={setCategoria}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Causa raiz</Label>
                <Textarea
                  placeholder="Por que o problema aconteceu?"
                  value={causaRaiz}
                  onChange={e => setCausaRaiz(e.target.value)}
                  className="min-h-[70px] text-sm"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Ação corretiva</Label>
                <Textarea
                  placeholder="O que será feito para resolver?"
                  value={acao}
                  onChange={e => setAcao(e.target.value)}
                  className="min-h-[70px] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <Input
                  type="date"
                  value={prazo}
                  onChange={e => setPrazo(e.target.value)}
                  className="text-sm"
                />
              </div>
            </>
          )}
        </div>

        <DrawerFooter className="pt-2">
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={!step1Valid}
              className="w-full"
            >
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
