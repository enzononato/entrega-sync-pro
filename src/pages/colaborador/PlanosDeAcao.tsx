import { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanosDoColaborador, useUpdatePlano, type ActionPlanWithRelations } from '@/hooks/usePlanosDeAcao';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  CalendarIcon, CheckCircle, Clock, AlertTriangle, Loader2,
  ClipboardList, ChevronRight, CircleDot, ArrowRight, Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const statusTabs = [
  { key: 'pendentes', label: 'Pendentes', filter: (p: ActionPlanWithRelations) => ['aberto', 'em_andamento'].includes(p.status) },
  { key: 'concluidos', label: 'Concluídos', filter: (p: ActionPlanWithRelations) => p.status === 'concluido' },
  { key: 'cancelados', label: 'Cancelados', filter: (p: ActionPlanWithRelations) => p.status === 'cancelado' },
] as const;

export default function PlanosDeAcaoColaborador() {
  const { user } = useAuth();
  const { data: planos = [], isLoading } = usePlanosDoColaborador(user?.id);
  const updateMut = useUpdatePlano();

  const [tab, setTab] = useState('pendentes');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<ActionPlanWithRelations | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [obs, setObs] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const isAtrasado = (p: ActionPlanWithRelations) =>
    p.prazo && p.prazo < today && !['concluido', 'cancelado'].includes(p.status);

  const pendentes = planos.filter(p => ['aberto', 'em_andamento'].includes(p.status));
  const concluidos = planos.filter(p => p.status === 'concluido');
  const cancelados = planos.filter(p => p.status === 'cancelado');
  const atrasados = pendentes.filter(isAtrasado);

  const filtered = useMemo(() => {
    const cfg = statusTabs.find(t => t.key === tab);
    return cfg ? planos.filter(cfg.filter) : [];
  }, [planos, tab]);

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

  const getDaysLeft = (prazo: string | null) => {
    if (!prazo) return null;
    return differenceInDays(new Date(prazo + 'T00:00:00'), new Date());
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 stagger-children pb-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" /> Planos de Ação
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie suas ações corretivas</p>
      </div>

      {/* Hero stats */}
      <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
        <div className="grid grid-cols-3 divide-x divide-white/10 p-1">
          <div className="py-4 text-center">
            <Clock className="h-4 w-4 text-white/60 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-white">{pendentes.length}</p>
            <p className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">Pendentes</p>
          </div>
          <div className="py-4 text-center">
            <CheckCircle className="h-4 w-4 text-success mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-white">{concluidos.length}</p>
            <p className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">Concluídos</p>
          </div>
          <div className="py-4 text-center">
            <AlertTriangle className="h-4 w-4 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-white">{atrasados.length}</p>
            <p className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">Atrasados</p>
          </div>
        </div>
      </div>

      {/* Atrasados alert */}
      {atrasados.length > 0 && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <Flame className="h-4.5 w-4.5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{atrasados.length} ação(ões) atrasada(s)</p>
            <p className="text-[11px] text-muted-foreground">Atualize o status o quanto antes</p>
          </div>
        </div>
      )}

      {/* Tab pills */}
      <div className="flex gap-2">
        {statusTabs.map(t => {
          const count = t.key === 'pendentes' ? pendentes.length : t.key === 'concluidos' ? concluidos.length : cancelados.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                tab === t.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          titulo={tab === 'pendentes' ? 'Nenhuma ação pendente 🎉' : tab === 'concluidos' ? 'Nenhuma ação concluída ainda' : 'Nenhuma ação cancelada'}
          icon={<ClipboardList className="h-10 w-10" />}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const atrasado = isAtrasado(p);
            const daysLeft = getDaysLeft(p.prazo);
            const canUpdate = ['aberto', 'em_andamento'].includes(p.status);

            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-xl border bg-card shadow-sm overflow-hidden transition-all',
                  atrasado && 'border-destructive/30'
                )}
              >
                <div className="px-4 py-3.5 space-y-2.5">
                  {/* Top row */}
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'h-2.5 w-2.5 rounded-full shrink-0',
                      p.status === 'aberto' ? 'bg-blue-500' :
                      p.status === 'em_andamento' ? 'bg-warning' :
                      p.status === 'concluido' ? 'bg-success' : 'bg-muted-foreground'
                    )} />
                    {p.root_cause_records?.indicators && (
                      <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-md px-2 py-0.5">
                        {p.root_cause_records.indicators.codigo}
                      </span>
                    )}
                    <StatusBadge status={p.status} className="ml-auto" />
                  </div>

                  {/* Description */}
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                    {p.descricao_acao}
                  </p>

                  {/* Causa raiz context */}
                  {p.root_cause_records?.descricao_problema && (
                    <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 line-clamp-1">
                      💡 {p.root_cause_records.descricao_problema}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      {p.prazo ? (
                        <span className={cn(atrasado && 'text-destructive font-semibold')}>
                          {format(new Date(p.prazo + 'T00:00:00'), 'dd/MM/yyyy')}
                          {atrasado && ' · Atrasado'}
                          {!atrasado && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && (
                            <span className="text-warning font-medium"> · {daysLeft === 0 ? 'Hoje' : `${daysLeft}d`}</span>
                          )}
                        </span>
                      ) : (
                        <span>Sem prazo</span>
                      )}
                    </div>
                    {canUpdate && (
                      <button
                        onClick={() => openUpdate(p)}
                        className="flex items-center gap-1 text-xs font-semibold text-primary"
                      >
                        Atualizar <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Update Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">Atualizar Plano</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 line-clamp-2">
                {selected.descricao_acao}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Novo Status *</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Observações</Label>
                <Textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  rows={3}
                  className="rounded-xl"
                  placeholder="Descreva o que foi feito..."
                />
              </div>
              <Button
                className="w-full rounded-xl"
                disabled={!newStatus || updateMut.isPending}
                onClick={handleSave}
              >
                {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Atualização
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
