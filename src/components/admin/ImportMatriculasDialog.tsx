import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Loader2, ArrowLeft, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

function normalize(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readUploadedText(file: File) {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(buffer);
  if (!utf8Text.includes('\uFFFD')) return utf8Text;
  try { return new TextDecoder('windows-1252').decode(buffer); } catch { return utf8Text; }
}

function generateEmail(nome: string) {
  const normalized = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return `${normalized}@entrega.com`;
}

type MatchType = 'exact' | 'partial' | 'not_found';

interface ParsedEntry {
  nome_lista: string;
  matricula: string;
  match_type: MatchType;
  user_id?: string;
  nome_banco?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportMatriculasDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [updating, setUpdating] = useState(false);
  const [creating, setCreating] = useState(false);
  const queryClient = useQueryClient();

  const reset = useCallback(() => {
    setStep(1);
    setEntries([]);
    setUpdating(false);
    setCreating(false);
  }, []);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await readUploadedText(file);
    const lines = text.split('\n');
    const regex = /^(.*?)\s*(?:-)?\s*\((\d+)\)/;

    const parsed: { nome: string; matricula: string }[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().includes('motoristas')) continue;
      const match = trimmed.match(regex);
      if (match) {
        parsed.push({ nome: match[1].trim(), matricula: match[2] });
      }
    }

    if (parsed.length === 0) {
      toast.error('Nenhuma entrada válida encontrada no arquivo.');
      e.target.value = '';
      return;
    }

    const { data: users, error } = await supabase.from('users').select('id, nome');
    if (error || !users) {
      toast.error('Erro ao buscar usuários: ' + (error?.message ?? 'desconhecido'));
      e.target.value = '';
      return;
    }

    const usersNorm = users.map(u => ({ ...u, norm: normalize(u.nome) }));

    const results: ParsedEntry[] = parsed.map(p => {
      const normLista = normalize(p.nome);

      const exact = usersNorm.find(u => u.norm === normLista);
      if (exact) {
        return { nome_lista: p.nome, matricula: p.matricula, match_type: 'exact' as MatchType, user_id: exact.id, nome_banco: exact.nome };
      }

      const wordsLista = normLista.split(' ').filter(word => word.length >= 2);
      const partial = usersNorm.find(u => {
        const wordsBanco = u.norm.split(' ').filter(word => word.length >= 2);
        return (wordsLista.length > 0 && wordsLista.every(word => wordsBanco.includes(word))) ||
               (wordsBanco.length > 0 && wordsBanco.every(word => wordsLista.includes(word)));
      });

      if (partial) {
        return { nome_lista: p.nome, matricula: p.matricula, match_type: 'partial' as MatchType, user_id: partial.id, nome_banco: partial.nome };
      }

      return { nome_lista: p.nome, matricula: p.matricula, match_type: 'not_found' as MatchType };
    });

    setEntries(results);
    setStep(2);
    e.target.value = '';
  };

  const matched = entries.filter(e => e.match_type !== 'not_found');
  const notFound = entries.filter(e => e.match_type === 'not_found');
  const exactCount = entries.filter(e => e.match_type === 'exact').length;
  const partialCount = entries.filter(e => e.match_type === 'partial').length;
  const notFoundCount = notFound.length;

  const handleUpdate = async () => {
    if (matched.length === 0) return;
    setUpdating(true);
    try {
      const results = await Promise.all(
        matched.map(entry =>
          supabase.from('users').update({ matricula: entry.matricula }).eq('id', entry.user_id!)
        )
      );
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        toast.error(`${errors.length} erro(s) ao atualizar matrículas.`);
      } else {
        toast.success(`${matched.length} matrícula(s) atualizada(s) com sucesso!`);
      }
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      handleClose(false);
    } catch {
      toast.error('Erro inesperado ao atualizar.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCreateNotFound = async () => {
    if (notFound.length === 0) return;
    setCreating(true);

    let successCount = 0;
    let errorCount = 0;

    for (const entry of notFound) {
      const nome = normalize(entry.nome_lista)
        .split(' ')
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');

      const email = generateEmail(entry.nome_lista);

      const { error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password: 'Entrega@2026',
          nome,
          matricula: entry.matricula,
          role: 'colaborador',
          worker_type: 'motorista',
        },
      });

      if (error) {
        errorCount++;
        console.error(`Erro ao criar ${nome}:`, error);
      } else {
        successCount++;
      }
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} erro(s) ao criar colaboradores.`);
    }
    if (successCount > 0) {
      toast.success(`${successCount} colaborador(es) criado(s) com sucesso!`);
    }

    queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    handleClose(false);
    setCreating(false);
  };

  const isProcessing = updating || creating;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg">Atualizar Matrículas em Lote</DialogTitle>
            <DialogDescription className="text-xs">
              Importe um arquivo CSV/TXT com o formato "NOME - (MATRICULA)" para atualizar as matrículas dos colaboradores.
            </DialogDescription>
          </DialogHeader>
        </div>

        {step === 1 && (
          <div className="px-6 py-10 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Selecione o arquivo</p>
              <p className="text-xs text-muted-foreground">Formato: NOME - (MATRICULA), uma linha por colaborador</p>
            </div>
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
              <Button variant="outline" className="gap-2" asChild>
                <span><Upload className="h-4 w-4" /> Escolher Arquivo</span>
              </Button>
            </label>
          </div>
        )}

        {step === 2 && (
          <>
            <div className="px-6 pt-4 flex flex-wrap gap-3">
              <Badge variant="outline" className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> {exactCount} exato(s)
              </Badge>
              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                <AlertTriangle className="h-3 w-3" /> {partialCount} parcial(is)
              </Badge>
              <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
                <XCircle className="h-3 w-3" /> {notFoundCount} não encontrado(s)
              </Badge>
            </div>

            <ScrollArea className="h-[50vh] px-6 py-3">
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome na Lista</TableHead>
                      <TableHead className="text-xs">Nome no Sistema</TableHead>
                      <TableHead className="text-xs w-28">Matrícula</TableHead>
                      <TableHead className="text-xs w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, i) => (
                      <TableRow key={i} className={
                        entry.match_type === 'exact' ? 'bg-emerald-50/50' :
                        entry.match_type === 'partial' ? 'bg-amber-50/50' :
                        'bg-red-50/50'
                      }>
                        <TableCell className="text-xs py-2">{entry.nome_lista}</TableCell>
                        <TableCell className="text-xs py-2">{entry.nome_banco ?? '—'}</TableCell>
                        <TableCell className="text-xs py-2 font-mono font-medium">{entry.matricula}</TableCell>
                        <TableCell className="py-2">
                          {entry.match_type === 'exact' && (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Exato</Badge>
                          )}
                          {entry.match_type === 'partial' && (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">Parcial</Badge>
                          )}
                          {entry.match_type === 'not_found' && (
                            <Badge className="bg-red-100 text-red-700 border-0 text-[10px]">Não encontrado</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            <div className="px-6 pb-6 pt-3 flex items-center justify-between border-t border-border/50">
              <Button variant="ghost" size="sm" className="gap-1" onClick={reset} disabled={isProcessing}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
              <div className="flex gap-2">
                {notFoundCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleCreateNotFound}
                    disabled={isProcessing}
                    className="gap-2"
                  >
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    {!creating && <UserPlus className="h-4 w-4" />}
                    Criar {notFoundCount} Colaborador(es)
                  </Button>
                )}
                <Button onClick={handleUpdate} disabled={isProcessing || matched.length === 0} className="gap-2">
                  {updating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Atualizar {matched.length} Matrícula(s)
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
