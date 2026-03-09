import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanosDoColaborador, useUpdatePlano, type ActionPlanWithRelations } from '@/hooks/usePlanosDeAcao';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CalendarIcon, CheckCircle, Clock, AlertTriangle, Loader2, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PlanosDeAcaoColaborador() {
  const { user } = useAuth();
  const { data: planos = [], isLoading } = usePlanosDoColaborador(user?.id);
  const updateMut = useUpdatePlano();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<ActionPlanWithRelations | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [obs, setObs] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const isAtrasado = (p: ActionPlanWithRelations) => p.prazo && p.prazo < today && !['concluido', 'cancelado'].includes(p.status);

  const abertos = planos.filter(p => p.status === 'aberto');
  const andamento = planos.filter(p => p.status === 'em_andamento');
  const concluidos = planos.filter(p => p.status === 'concluido');

  const openUpdate = (p: ActionPlanWithRelations) => {
    setSelected(p);
    setNewStatus('');
    setObs('');
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!selected || !newStatus) return;
    await updateMut.mutateAsync({ id: selected.id, status: newStatus, observacoes: obs });
    setSheetOpen(false);
  };

  const statusIcon = (s: string) => {
    if (s === 'aberto') return <Clock className="h-4 w-4 text-blue-500" />;
    if (s === 'em_andamento') return <Loader2 className="h-4 w-4 text-amber-500" />;
    return <CheckCircle className="h-4 w-4 text-blue-500" />;
  };

  const renderCard = (p: ActionPlanWithRelations, showUpdate = true) => (
    <div key={p.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        {statusIcon(p.status)}
        {p.root_cause_records?.indicators && (
          <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
            {p.root_cause_records.indicators.codigo}
          </span>
        )}
        <StatusBadge status={p.status} className="ml-auto" />
      </div>
      <p className="text-sm text-foreground line-clamp-2">{p.descricao_acao}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarIcon className="h-3 w-3" />
        {p.prazo ? format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yyyy') : 'Sem prazo'}
        {isAtrasado(p) && (
          <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">ATRASADO</span>
        )}
      </div>
      {showUpdate && ['aberto', 'em_andamento'].includes(p.status) && (
        <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => openUpdate(p)}>Atualizar</Button>
      )}
    </div>
  );

  const emptyMsg = (tab: string) => {
    if (tab === 'abertos') return 'Nenhum plano aberto. Ótimo trabalho!';
    if (tab === 'andamento') return 'Nenhum plano em andamento.';
    return 'Nenhum plano concluído ainda.';
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground mb-4">Planos de Ação</h1>
      <Tabs defaultValue="abertos">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="abertos">Abertos ({abertos.length})</TabsTrigger>
          <TabsTrigger value="andamento">Em andamento ({andamento.length})</TabsTrigger>
          <TabsTrigger value="concluidos">Concluídos ({concluidos.length})</TabsTrigger>
        </TabsList>
        {[
          { key: 'abertos', items: abertos },
          { key: 'andamento', items: andamento },
          { key: 'concluidos', items: concluidos },
        ].map(({ key, items }) => (
          <TabsContent key={key} value={key} className="space-y-3">
            {items.length === 0 ? (
              <EmptyState titulo={emptyMsg(key)} icon={<ClipboardList className="h-10 w-10" />} />
            ) : items.map(p => renderCard(p, key !== 'concluidos'))}
          </TabsContent>
        ))}
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[50vh] rounded-t-2xl">
          <SheetHeader><SheetTitle>Atualizar Plano</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Novo Status *</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" disabled={!newStatus || updateMut.isPending} onClick={handleSave}>
              {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
