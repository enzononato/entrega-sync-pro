import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useActionPlansByCause, type CausaRaizRow } from '@/hooks/useCausaRaiz';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, FileText, Tag, AlertTriangle, Calendar, ClipboardList } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  causa: CausaRaizRow;
}

export function ViewCausaRaizSheet({ open, onClose, causa }: Props) {
  const { data: planos = [] } = useActionPlansByCause(causa.id);

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <DrawerTitle className="text-base">Causa Raiz Reportada</DrawerTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {causa.indicators?.nome ?? 'Indicador'}
          </p>
        </DrawerHeader>

        <div className="px-4 py-3 space-y-4 overflow-y-auto">
          {/* Causa Raiz info */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Data de referência</p>
                <p className="text-sm text-foreground">
                  {format(new Date(causa.data_referencia + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Descrição do problema</p>
                <p className="text-sm text-foreground">{causa.descricao_problema}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Categoria</p>
                <p className="text-sm text-foreground">{causa.categoria_causa}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Causa raiz</p>
                <p className="text-sm text-foreground">{causa.causa_raiz}</p>
              </div>
            </div>
          </div>

          {/* Planos de Ação */}
          {planos.length > 0 && (
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4 text-primary" />
                <p className="text-xs font-bold text-foreground">Plano de Ação</p>
              </div>
              {planos.map(p => (
                <div key={p.id} className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                  <p className="text-sm text-foreground">{p.descricao_acao}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="font-semibold uppercase">
                      Status: <span className="text-foreground">{p.status}</span>
                    </span>
                    {p.prazo && (
                      <span>
                        Prazo: <span className="text-foreground">{format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DrawerFooter className="pt-2">
          <Button variant="outline" onClick={onClose} className="w-full">
            Fechar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
