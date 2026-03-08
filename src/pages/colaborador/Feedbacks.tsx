import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedbacksDoColaborador, useCreateFeedback, type FeedbackWithRelations } from '@/hooks/useFeedbacks';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Plus, Truck, Monitor, GitBranch, Shield, Lightbulb, AlertTriangle, CalendarIcon, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'operacao', label: 'Operação', icon: Truck },
  { value: 'sistema', label: 'Sistema', icon: Monitor },
  { value: 'processo', label: 'Processo', icon: GitBranch },
  { value: 'seguranca', label: 'Segurança', icon: Shield },
  { value: 'sugestao', label: 'Sugestão', icon: Lightbulb },
  { value: 'incidente', label: 'Incidente', icon: AlertTriangle },
];

const URGENCIAS = [
  { value: 'baixa', label: 'Baixa', color: 'bg-muted text-muted-foreground' },
  { value: 'media', label: 'Média', color: 'bg-amber-100 text-amber-700' },
  { value: 'alta', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'critica', label: 'Crítica', color: 'bg-destructive/10 text-destructive' },
];

const getTipoIcon = (tipo: string) => {
  const t = TIPOS.find(t => t.value === tipo);
  return t ? t.icon : MessageSquare;
};

function DatePick({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
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
        <Calendar mode="single" selected={date} onSelect={d => onChange(d ? format(d, 'yyyy-MM-dd') : '')} className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export default function FeedbacksColaborador() {
  const { user } = useAuth();
  const { data: feedbacks = [], isLoading } = useFeedbacksDoColaborador(user?.id);
  const createMut = useCreateFeedback();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewFeedback, setViewFeedback] = useState<FeedbackWithRelations | null>(null);

  const [form, setForm] = useState({
    data_referencia: format(new Date(), 'yyyy-MM-dd'),
    tipo: '', titulo: '', descricao: '', urgencia: 'baixa',
  });

  const enviados = feedbacks.filter(f => ['aberto', 'em_analise'].includes(f.status));
  const respondidos = feedbacks.filter(f => ['respondido', 'encerrado'].includes(f.status));

  const openCreate = () => {
    setForm({ data_referencia: format(new Date(), 'yyyy-MM-dd'), tipo: '', titulo: '', descricao: '', urgencia: 'baixa' });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    await createMut.mutateAsync({
      user_id: user.id,
      unidade_id: user.unidade_id,
      rota_id: user.rota_id,
      ...form,
    });
    setSheetOpen(false);
  };

  const canSave = form.tipo && form.titulo.length >= 5 && form.descricao.length >= 20;

  const renderCard = (f: FeedbackWithRelations) => {
    const Icon = getTipoIcon(f.tipo);
    const tipoLabel = TIPOS.find(t => t.value === f.tipo)?.label ?? f.tipo;
    const urgConfig = URGENCIAS.find(u => u.value === f.urgencia);
    return (
      <div key={f.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2" onClick={() => f.resposta_lideranca && setViewFeedback(f)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
            <Icon className="h-3 w-3" />{tipoLabel}
          </span>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', urgConfig?.color)}>
            {urgConfig?.label}
          </span>
          <StatusBadge status={f.status} className="ml-auto" />
        </div>
        <p className="text-sm font-semibold text-foreground">{f.titulo}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: ptBR })}
        </p>
        {f.resposta_lideranca && (
          <div className="rounded-lg bg-muted/50 p-2 mt-1">
            <p className="text-xs text-muted-foreground line-clamp-2">{f.resposta_lideranca}</p>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setViewFeedback(f)}>Ver Resposta</Button>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="relative min-h-[60vh]">
      <h1 className="text-xl font-bold text-foreground mb-4">Feedbacks</h1>
      <Tabs defaultValue="enviados">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="enviados">Enviados ({enviados.length})</TabsTrigger>
          <TabsTrigger value="respondidos">Respondidos ({respondidos.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="enviados" className="space-y-3 pb-20">
          {enviados.length === 0 ? (
            <EmptyState titulo="Nenhum feedback ainda" descricao="Sua opinião é importante!" icon={<MessageSquare className="h-10 w-10" />} actionLabel="Enviar Feedback" onAction={openCreate} />
          ) : enviados.map(renderCard)}
        </TabsContent>
        <TabsContent value="respondidos" className="space-y-3 pb-20">
          {respondidos.length === 0 ? (
            <EmptyState titulo="Nenhuma resposta ainda" icon={<MessageSquare className="h-10 w-10" />} />
          ) : respondidos.map(renderCard)}
        </TabsContent>
      </Tabs>

      <Button className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-50" onClick={openCreate}>
        <Plus className="h-6 w-6" />
      </Button>

      {/* New feedback sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl overflow-y-auto">
          <SheetHeader><SheetTitle>Novo Feedback</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Data</Label>
              <DatePick value={form.data_referencia} onChange={v => setForm(f => ({ ...f, data_referencia: v }))} placeholder="Hoje" />
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => {
                    const Icon = t.icon;
                    return <SelectItem key={t.value} value={t.value}><span className="flex items-center gap-2"><Icon className="h-3 w-3" />{t.label}</span></SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Título * <span className="text-xs text-muted-foreground">(mín. 5 caracteres)</span></Label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Descrição * <span className="text-xs text-muted-foreground">(mín. 20 caracteres)</span></Label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={4} />
            </div>
            <div className="space-y-1">
              <Label>Urgência</Label>
              <div className="grid grid-cols-4 gap-2">
                {URGENCIAS.map(u => (
                  <Button key={u.value} type="button" variant={form.urgencia === u.value ? 'default' : 'outline'} size="sm"
                    className={form.urgencia === u.value ? '' : u.color}
                    onClick={() => setForm(f => ({ ...f, urgencia: u.value }))}>
                    {u.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button className="w-full" disabled={!canSave || createMut.isPending} onClick={handleSave}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar Feedback
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* View response dialog */}
      <Dialog open={!!viewFeedback} onOpenChange={() => setViewFeedback(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewFeedback?.titulo}</DialogTitle></DialogHeader>
          {viewFeedback && (
            <div className="space-y-3 py-2">
              <div className="flex gap-2 flex-wrap">
                <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                  {TIPOS.find(t => t.value === viewFeedback.tipo)?.label}
                </span>
                <StatusBadge status={viewFeedback.urgencia} />
                <StatusBadge status={viewFeedback.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(viewFeedback.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="text-sm">{viewFeedback.descricao}</p>
              {viewFeedback.resposta_lideranca && (
                <>
                  <Separator />
                  <h4 className="text-sm font-semibold">Resposta da Liderança</h4>
                  {viewFeedback.responded_at && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(viewFeedback.responded_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                  <p className="text-sm">{viewFeedback.resposta_lideranca}</p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
