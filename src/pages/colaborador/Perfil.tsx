import { useState, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useFeedbacksDoColaborador } from '@/hooks/useFeedbacks';
import { usePlanosDoColaborador } from '@/hooks/usePlanosDeAcao';
import { useCausaRaizPorColaborador } from '@/hooks/useCausaRaiz';
import { useDesempenhoPorColaborador } from '@/hooks/useDesempenho';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ChangePasswordDialog } from '@/components/colaborador/ChangePasswordDialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Hash, Mail, Building2, MapPin, Calendar, LogOut, MessageSquare, ClipboardList, AlertTriangle, CheckCircle, Camera, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

      // Validação de tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }

      // Validação de tipo
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Formato inválido. Use JPG, PNG ou WEBP');
        return;
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Usuário não autenticado');

      const fileExt = file.name.split('.').pop();
      const fileName = `${authUser.id}/avatar.${fileExt}`;

      // Upload da imagem
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Pegar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Atualizar avatar_url na tabela users
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('auth_user_id', authUser.id);

      if (updateError) throw updateError;

      toast.success('Foto atualizada com sucesso!');
      window.location.reload(); // Reload para atualizar contexto
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error.message || 'Erro ao atualizar foto');
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4 animate-fade-up">
      <h1 className="text-xl font-bold text-foreground">Meu Perfil</h1>

      {/* Avatar card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center">
        <div className="relative group">
          <Avatar className="h-24 w-24 ring-4 ring-primary/10">
            <AvatarImage src={user.avatar_url || undefined} alt={user.nome} />
            <AvatarFallback className={cn(
              'text-2xl font-bold text-white',
              user.worker_type === 'motorista' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-purple-500 to-purple-600'
            )}>
              {getInitials(user.nome)}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
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
        <p className="text-lg font-semibold text-foreground mt-4">{user.nome}</p>
        {user.worker_type && (
          <span className={cn('inline-flex rounded-lg px-3 py-1 text-xs font-semibold mt-2',
            user.worker_type === 'motorista' ? 'bg-emerald-50 text-emerald-700' : 'bg-purple-50 text-purple-700'
          )}>
            {user.worker_type === 'motorista' ? '🚛 Motorista' : '📦 Ajudante'}
          </span>
        )}
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
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

      {/* Actions */}
      <div className="space-y-2">
        <Button 
          variant="outline" 
          className="w-full gap-2 h-11 rounded-xl" 
          onClick={() => setShowChangePassword(true)}
        >
          <Lock className="h-4 w-4" />
          Alterar Senha
        </Button>
        <Button 
          variant="outline" 
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 gap-2 h-11 rounded-xl" 
          onClick={() => setConfirmLogout(true)}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        title="Sair do EntregaApp"
        description="Deseja sair do EntregaApp?"
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
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
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-sm flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}
