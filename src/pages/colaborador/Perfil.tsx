import { useState, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeedbacksDoColaborador } from '@/hooks/useFeedbacks';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { useCausaRaizPorColaborador } from '@/hooks/useCausaRaiz';
import { useDesempenhoPorColaborador } from '@/hooks/useDesempenho';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ExtratoDescontos } from '@/components/colaborador/ExtratoDescontos';
import { ChangePasswordDialog } from '@/components/colaborador/ChangePasswordDialog';
import { ProgressBar } from '@/components/shared/ProgressBar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Hash, Mail, Building2, MapPin, Calendar, LogOut,
  MessageSquare, ClipboardList, AlertTriangle, CheckCircle,
  Camera, Lock, Trophy, ChevronRight, Sparkles, Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  threshold: number;
  color: string;
}

const BADGES: Badge[] = [
  { id: 'first_step', emoji: '🌱', title: 'Primeiro Passo', description: '1 dia na meta', threshold: 1, color: 'from-primary to-primary/80' },
  { id: 'on_track', emoji: '🎯', title: 'No Alvo', description: '3 dias na meta', threshold: 3, color: 'from-primary to-accent' },
  { id: 'consistent', emoji: '⭐', title: 'Consistente', description: '7 dias na meta', threshold: 7, color: 'from-warning to-warning/80' },
  { id: 'dedicated', emoji: '🔥', title: 'Dedicado', description: '15 dias na meta', threshold: 15, color: 'from-warning to-destructive' },
  { id: 'champion', emoji: '🏆', title: 'Campeão', description: '20 dias na meta', threshold: 20, color: 'from-warning to-success' },
  { id: 'legend', emoji: '💎', title: 'Lendário', description: '25+ dias na meta', threshold: 25, color: 'from-secondary to-primary' },
];

export default function PerfilColaborador() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: feedbacks = [] } = useFeedbacksDoColaborador(user?.id);
  const { data: planos = [] } = usePlanosDoColaborador(user?.id);
  const { data: causas = [] } = useCausaRaizPorColaborador(user?.id);

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

  const unlockedBadges = useMemo(() =>
    BADGES.map(badge => ({ ...badge, unlocked: diasNaMeta >= badge.threshold })),
  [diasNaMeta]);

  const nextBadge = unlockedBadges.find(b => !b.unlocked);
  const unlockedCount = unlockedBadges.filter(b => b.unlocked).length;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 5MB'); return; }
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) { toast.error('Formato inválido. Use JPG, PNG ou WEBP'); return; }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('auth_user_id', authUser.id);
      if (updateError) throw updateError;

      toast.success('Foto atualizada com sucesso!');
      window.location.reload();
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error.message || 'Erro ao atualizar foto');
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  const workerLabel = user.worker_type === 'motorista' ? '🚛 Motorista' : user.worker_type === 'distribuicao' ? '📋 Distribuição' : '📦 Ajudante';

  return (
    <div className="space-y-5 stagger-children pb-4">
      {/* ── Hero Profile Card ──────────────────────── */}
      <div className="rounded-2xl overflow-hidden shadow-lg gradient-hero">
        <div className="p-6 flex flex-col items-center text-center relative">
          {/* Avatar */}
          <div className="relative">
            <Avatar className="h-24 w-24 ring-4 ring-white/20 shadow-xl">
              <AvatarImage src={user.avatar_url || undefined} alt={user.nome} />
              <AvatarFallback className="text-2xl font-bold text-white bg-white/20 backdrop-blur-sm">
                {getInitials(user.nome)}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white text-primary shadow-lg flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <p className="text-lg font-bold text-white mt-4">{user.nome}</p>
          {user.worker_type && (
            <span className="mt-1.5 inline-flex items-center rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
              {workerLabel}
            </span>
          )}

          {/* Quick stats row */}
          <div className="flex items-center gap-6 mt-5">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white">{diasNaMeta}</p>
              <p className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">Dias na Meta</p>
            </div>
            <div className="h-8 w-px bg-white/15" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white">{unlockedCount}</p>
              <p className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">Conquistas</p>
            </div>
            <div className="h-8 w-px bg-white/15" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-white">{planos.filter(p => p.status === 'concluido').length}</p>
              <p className="text-[9px] text-white/50 font-semibold uppercase tracking-wider">Concluídos</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Conquistas ─────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-warning" /> Conquistas
          </h2>
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted rounded-full px-2.5 py-0.5">
            {unlockedCount}/{BADGES.length}
          </span>
        </div>

        {/* Next badge progress */}
        {nextBadge && (
          <div className="rounded-xl bg-muted/50 border border-border px-3.5 py-3 mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Próxima: <span className="font-semibold text-foreground">{nextBadge.emoji} {nextBadge.title}</span>
              </span>
              <span className="text-xs font-bold text-foreground">{diasNaMeta}/{nextBadge.threshold}</span>
            </div>
            <div className="h-2 rounded-full bg-border overflow-hidden">
              <div
                className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', nextBadge.color)}
                style={{ width: `${Math.min(100, (diasNaMeta / nextBadge.threshold) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Badge grid */}
        <div className="grid grid-cols-3 gap-2">
          {unlockedBadges.map(badge => (
            <div
              key={badge.id}
              className={cn(
                'relative flex flex-col items-center rounded-xl p-3 text-center transition-all',
                badge.unlocked
                  ? 'bg-card border border-border shadow-sm'
                  : 'bg-muted/20 border border-transparent opacity-35 grayscale'
              )}
            >
              <span className="text-2xl mb-1">{badge.emoji}</span>
              <p className="text-[10px] font-bold text-foreground leading-tight">{badge.title}</p>
              <p className="text-[8px] text-muted-foreground leading-tight mt-0.5">{badge.description}</p>
              {badge.unlocked && (
                <div className={cn('absolute -top-1 -right-1 h-4 w-4 rounded-full bg-gradient-to-r flex items-center justify-center', badge.color)}>
                  <CheckCircle className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Informações ────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
          <Sparkles className="h-4 w-4 text-primary" /> Informações
        </h2>
        <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border/50">
          <InfoRow icon={<Hash className="h-4 w-4" />} label="Matrícula" value={user.matricula || '—'} />
          <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={user.email} />
          <InfoRow icon={<Building2 className="h-4 w-4" />} label="Unidade" value={user.units?.nome ?? '—'} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Rota" value={user.routes?.nome ?? '—'} />
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="Desde" value={format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })} />
        </div>
      </section>

      {/* ── Atividade ──────────────────────────────── */}
      <section>
        <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
          <Star className="h-4 w-4 text-warning" /> Atividade (30 dias)
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          <StatCard icon={<MessageSquare className="h-4 w-4 text-primary" />} value={feedbacks.length} label="Feedbacks" />
          <StatCard icon={<ClipboardList className="h-4 w-4 text-warning" />} value={planos.length} label="Planos" />
          <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} value={causas.length} label="Causas raiz" />
          <StatCard icon={<CheckCircle className="h-4 w-4 text-success" />} value={diasNaMeta} label="Dias na meta" />
        </div>
      </section>

      {/* ── Extrato de Descontos ───────────────────── */}
      <ExtratoDescontos userId={user.id} />

      {/* ── Ações ──────────────────────────────────── */}
      <section className="space-y-2.5">
        <Button
          variant="outline"
          className="w-full justify-between gap-2 h-12 rounded-xl"
          onClick={() => setShowChangePassword(true)}
        >
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Alterar Senha
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button
          variant="outline"
          className="w-full justify-between text-destructive border-destructive/20 hover:bg-destructive/5 gap-2 h-12 rounded-xl"
          onClick={() => setConfirmLogout(true)}
        >
          <span className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sair da Conta
          </span>
          <ChevronRight className="h-4 w-4 opacity-50" />
        </Button>
      </section>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair do IncentivosPro"
        description="Deseja sair do IncentivosPro?"
        confirmLabel="Sair"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}
