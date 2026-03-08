import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useCausaRaiz, useActionPlansByCause, useCreateActionPlan, type CausaRaizRow, type ActionPlanRow } from '@/hooks/useCausaRaiz';
import { useIndicadores } from '@/hooks/useIndicadores';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Eye, Plus, CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const CATEGORIAS = ['Logística', 'Qualidade', 'Processo', 'Externo', 'Equipamento', 'Pessoal', 'Outro'];

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

function DetailModal({ causa, open, onClose }: { causa: CausaRaizRow | null; open: boolean; onClose: () => void }) {
  const { data: plans = [] } = useActionPlansByCause(causa?.id);
  const { user } = useAuth();
  const createPlan = useCreateActionPlan();
  const { toast } = useToast();
  const [planOpen, setPlanOpen] = useState(false);
  const [acao, setAcao] = useState('');
  const [prazo, setPrazo] = useState('');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const savePlan = async () => {
    if (!causa || !user) return;
    await createPlan.mutateAsync({ root_cause_id: causa.id, responsavel_user_id: user.id, descricao_acao: acao, prazo: prazo || null });
    toast({ title: 'Plano de ação criado!' });
    setPlanOpen(false);
    setAcao('');
    setPrazo('');
  };

  if (!causa) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Detalhes da Causa Raiz</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">O Problema</h4>
            <p className="text-sm text-muted-foreground">{causa.descricao_problema}</p>
            {causa.impacto && <p className="text-sm text-muted-foreground mt-1"><strong>Impacto:</strong> {causa.impacto}</p>}
          </section>
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-1">A Causa</h4>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium mb-1">{causa.categoria_causa}</span>
            <p className="text-sm text-muted-foreground">{causa.causa_raiz}</p>
          </section>
          <section>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-foreground">Planos de Ação ({plans.length})</h4>
              <Button size="sm" variant="outline" onClick={() => setPlanOpen(true)}><Plus className="h-3 w-3 mr-1" /> Novo</Button>
            </div>
            {plans.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum plano vinculado.</p>
            ) : (
              <div className="space-y-2">
                {plans.map((p: ActionPlanRow) => (
                  <div key={p.id} className="rounded-lg border p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium line-clamp-1">{p.descricao_acao}</p>
                      <StatusBadge status={p.status} />
                    </div>
                    {p.prazo && <p className="text-xs text-muted-foreground">Prazo: {format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yyyy')}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {planOpen && (
            <section className="rounded-lg border p-3 space-y-3 bg-muted/30">
              <h4 className="text-sm font-semibold">Novo Plano de Ação</h4>
              <div className="space-y-1"><Label>Descrição *</Label><Textarea value={acao} onChange={e => setAcao(e.target.value)} rows={3} /></div>
              <div className="space-y-1"><Label>Prazo</Label><DatePick value={prazo} onChange={setPrazo} placeholder="Selecione" minDate={tomorrow} /></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPlanOpen(false)}>Cancelar</Button>
                <Button size="sm" disabled={!acao || createPlan.isPending} onClick={savePlan}>
                  {createPlan.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Salvar
                </Button>
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CausaRaizAdmin() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: causas = [], isLoading } = useCausaRaiz({
    user_id: filters.user_id, indicator_id: filters.indicator_id, categoria_causa: filters.categoria_causa,
  });
  const { data: indicators = [] } = useIndicadores({ ativo: 'true' });
  const { data: usuarios = [] } = useUsuarios({ ativo: 'true' });
  const colabs = usuarios.filter(u => u.role === 'colaborador');

  const [detailCausa, setDetailCausa] = useState<CausaRaizRow | null>(null);

  const columns: Column<CausaRaizRow>[] = [
    {
      key: 'colaborador', label: 'Colaborador', render: (c) => (
        <div>
          <p className="text-sm font-medium">{c.users?.nome}</p>
          {c.users?.worker_type && (
            <span className={cn('inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium',
              c.users.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
            )}>{c.users.worker_type === 'motorista' ? 'Mot' : 'Aj'}</span>
          )}
        </div>
      ),
    },
    { key: 'indicador', label: 'Indicador', render: (c) => <span><span className="font-mono text-xs text-primary">{c.indicators?.codigo}</span> {c.indicators?.nome}</span> },
    { key: 'problema', label: 'Problema', render: (c) => <p className="text-sm line-clamp-2 max-w-[200px]">{c.descricao_problema}</p> },
    { key: 'causa', label: 'Causa Raiz', render: (c) => <p className="text-sm line-clamp-2 max-w-[200px]">{c.causa_raiz}</p> },
    { key: 'impacto', label: 'Impacto', render: (c) => <p className="text-sm line-clamp-1 max-w-[150px]">{c.impacto || '—'}</p> },
    { key: 'data', label: 'Data', render: (c) => format(new Date(c.data_referencia + 'T00:00:00'), 'dd/MM/yy') },
    { key: 'categoria', label: 'Categoria', render: (c) => <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{c.categoria_causa}</span> },
    {
      key: 'acoes', label: 'Ações', render: (c) => (
        <Button variant="ghost" size="icon" onClick={() => setDetailCausa(c)}><Eye className="h-4 w-4" /></Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Causa Raiz" subtitle="Registros de problemas e causas raiz" />
      <div className="flex flex-col sm:flex-row gap-3 mb-4 flex-wrap">
        <Select value={filters.user_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, user_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{colabs.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.indicator_id ?? ''} onValueChange={v => setFilters(f => ({ ...f, indicator_id: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Indicador" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos</SelectItem>{indicators.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.categoria_causa ?? ''} onValueChange={v => setFilters(f => ({ ...f, categoria_causa: v === 'all' ? '' : v }))}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas</SelectItem>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={causas} loading={isLoading} emptyMessage="Nenhum registro encontrado" />

      <DetailModal causa={detailCausa} open={!!detailCausa} onClose={() => setDetailCausa(null)} />
    </div>
  );
}
