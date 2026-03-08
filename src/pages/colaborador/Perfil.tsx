import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedbacksDoColaborador } from '@/hooks/useFeedbacks';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { useCausaRaizPorColaborador } from '@/hooks/useCausaRaiz';
import { useDesempenhoPorColaborador } from '@/hooks/useDesempenho';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Hash, Mail, Building2, MapPin, Calendar, LogOut, MessageSquare, ClipboardList, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PerfilColaborador() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const { data: feedbacks = [] } = useFeedbacksDoColaborador(user?.id);
  const { data: planos = [] } = usePlanosDoColaborador(user?.id);
  const { data: causas = [] } = useCausaRaizPorColaborador(user?.id);

  // Count days with all KPIs on target in the last 30 days
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const { data: desempenho = [] } = useDesempenhoPorColaborador(user?.id, thirtyAgo, today);

  const diasNaMeta = useMemo(() => {
    const byDay: Record<string, string[]> = {};
    desempenho.forEach(d => {
      if (!byDay[d.data_referencia]) byDay[d.data_referencia] = [];
      if (d.status) byDay[d.data_referencia].push(d.status);
    });
    return Object.values(byDay).filter(statuses =>
      statuses.length > 0 && statuses.every(s => s === 'acima_meta' || s === 'dentro_meta')
    ).length;
  }, [desempenho]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  if (!user) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>

      {/* Avatar card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center">
        <div className={cn(
          'h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white',
          user.worker_type === 'motorista' ? 'bg-blue-500' : 'bg-purple-500'
        )}>
          {getInitials(user.nome)}
        </div>
        <p className="text-lg font-semibold text-foreground mt-3">{user.nome}</p>
        {user.worker_type && (
          <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium mt-1',
            user.worker_type === 'motorista' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'
          )}>{user.worker_type === 'motorista' ? 'Motorista' : 'Ajudante'}</span>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <InfoRow icon={<Hash className="h-4 w-4" />} label="Matrícula" value={user.matricula || '—'} />
        <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={user.email} />
        <InfoRow icon={<Building2 className="h-4 w-4" />} label="Unidade" value={user.units?.nome ?? '—'} />
        <InfoRow icon={<MapPin className="h-4 w-4" />} label="Rota" value={user.routes?.nome ?? '—'} />
        <InfoRow icon={<Calendar className="h-4 w-4" />} label="Membro desde" value={format(new Date(user.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} />
      </div>

      {/* Stats card */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={<MessageSquare className="h-4 w-4 text-blue-500" />} value={feedbacks.length} label="Feedbacks enviados" />
        <StatCard icon={<ClipboardList className="h-4 w-4 text-amber-500" />} value={planos.length} label="Planos criados" />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} value={causas.length} label="Causas raiz" />
        <StatCard icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} value={diasNaMeta} label="Dias na meta (30d)" />
      </div>

      {/* Logout */}
      <Button variant="outline" className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 gap-2" onClick={() => setConfirmLogout(true)}>
        <LogOut className="h-4 w-4" />Sair
      </Button>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair do EntregaApp"
        description="Deseja sair do EntregaApp?"
        confirmLabel="Sair"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm flex items-center gap-3">
      {icon}
      <div>
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
