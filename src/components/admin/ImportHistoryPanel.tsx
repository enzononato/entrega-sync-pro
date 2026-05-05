import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, Undo2, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ImportBatch, ImportBatchTipo, TIPO_LABEL,
  useImportBatches, useUndoImport,
} from '@/hooks/useImportBatches';

interface Props {
  tipo?: ImportBatchTipo;
  /** Janela em horas em que o undo é permitido. Default 24h. */
  undoWindowHours?: number;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatDate(d.toISOString().slice(0, 10))} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ImportHistoryPanel({ tipo, undoWindowHours = 24 }: Props) {
  const { data: batches = [], isLoading } = useImportBatches(tipo);
  const undoMut = useUndoImport();
  const [target, setTarget] = useState<ImportBatch | null>(null);
  const [details, setDetails] = useState<{ batch: ImportBatch; status: 'inserido' | 'duplicado' | 'invalido' } | null>(null);

  const STATUS_LABEL: Record<string, string> = {
    inserido: 'Inseridas',
    duplicado: 'Duplicadas',
    invalido: 'Inválidas',
  };

  const canUndo = (b: ImportBatch) => {
    if (b.status !== 'confirmed') return false;
    if (!b.confirmed_at) return false;
    const ageMs = Date.now() - new Date(b.confirmed_at).getTime();
    return ageMs < undoWindowHours * 3600 * 1000;
  };

  const handleUndo = async () => {
    if (!target) return;
    try {
      await undoMut.mutateAsync(target);
      toast.success(`Importação desfeita: ${target.linhas_inseridas} registros removidos.`);
      setTarget(null);
    } catch (e: any) {
      toast.error('Erro ao desfazer: ' + (e.message || String(e)));
    }
  };

  const renderCount = (b: ImportBatch, status: 'inserido' | 'duplicado' | 'invalido', count: number) => {
    const hasItems = Array.isArray(b.payload_preview) && b.payload_preview.some((p: any) => p?.status === status);
    if (count === 0 || !hasItems) {
      return <span>{count}</span>;
    }
    return (
      <button
        type="button"
        className="text-primary hover:underline font-medium"
        onClick={() => setDetails({ batch: b, status })}
        title="Ver detalhes"
      >
        {count}
      </button>
    );
  };

  const detailRows = details
    ? (details.batch.payload_preview || []).filter((p: any) => p?.status === details.status)
    : [];
  const totalForStatus = details
    ? details.status === 'inserido' ? details.batch.linhas_inseridas
      : details.status === 'duplicado' ? details.batch.linhas_duplicadas
      : details.batch.linhas_invalidas
    : 0;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" /> Histórico de Importações
          </CardTitle>
          <CardDescription>
            Lotes recentes. Você pode desfazer importações nas últimas {undoWindowHours}h.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
          ) : (
            <div className="overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Data/Hora</th>
                    {!tipo && <th className="p-2 text-left">Tipo</th>}
                    <th className="p-2 text-left">Arquivo</th>
                    <th className="p-2 text-right">Inseridas</th>
                    <th className="p-2 text-right">Duplicadas</th>
                    <th className="p-2 text-right">Inválidas</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(b => (
                    <tr key={b.id} className="border-t">
                      <td className="p-2 whitespace-nowrap">{formatDateTime(b.created_at)}</td>
                      {!tipo && <td className="p-2">{TIPO_LABEL[b.tipo]}</td>}
                      <td className="p-2 max-w-[220px] truncate" title={b.arquivo_nome}>{b.arquivo_nome || '—'}</td>
                      <td className="p-2 text-right">{renderCount(b, 'inserido', b.linhas_inseridas)}</td>
                      <td className="p-2 text-right">{renderCount(b, 'duplicado', b.linhas_duplicadas)}</td>
                      <td className="p-2 text-right">{renderCount(b, 'invalido', b.linhas_invalidas)}</td>
                      <td className="p-2">
                        {b.status === 'confirmed' && <Badge variant="outline" className="bg-success/15 text-success border-success/30">Confirmada</Badge>}
                        {b.status === 'undone' && <Badge variant="outline" className="bg-muted">Desfeita</Badge>}
                        {b.status === 'preview' && <Badge variant="outline">Preview</Badge>}
                      </td>
                      <td className="p-2 text-right">
                        {canUndo(b) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTarget(b)}
                            disabled={undoMut.isPending}
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-1" /> Desfazer
                          </Button>
                        ) : b.status === 'confirmed' ? (
                          <span className="text-xs text-muted-foreground">expirado</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer importação?</AlertDialogTitle>
            <AlertDialogDescription>
              {target && (
                <>
                  Isso vai remover <strong>{target.linhas_inseridas}</strong> registros importados em{' '}
                  <strong>{formatDateTime(target.created_at)}</strong>
                  {target.tipo === 'colaboradores' && (
                    <> (colaboradores serão <strong>desativados</strong>, não excluídos).</>
                  )}
                  . Esta ação não pode ser revertida.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={undoMut.isPending}>
              {undoMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {details && `${STATUS_LABEL[details.status]} — ${TIPO_LABEL[details.batch.tipo]}`}
            </DialogTitle>
            <DialogDescription>
              {details && (
                <>
                  Exibindo {detailRows.length} de {totalForStatus} registros
                  {detailRows.length < totalForStatus && ' (amostra das primeiras 50 linhas do lote)'}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded border">
            {detailRows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sem detalhes disponíveis para este lote.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left w-10">#</th>
                    {Object.keys(detailRows[0])
                      .filter(k => k !== 'status')
                      .map(k => (
                        <th key={k} className="p-2 text-left whitespace-nowrap">{k}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows.map((r: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2 text-muted-foreground">{idx + 1}</td>
                      {Object.entries(r)
                        .filter(([k]) => k !== 'status')
                        .map(([k, v]) => (
                          <td key={k} className="p-2 whitespace-nowrap">
                            {v === null || v === undefined || v === '' ? '—' : String(v)}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}