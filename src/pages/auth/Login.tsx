import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Truck, Shield, Users, TrendingUp } from 'lucide-react';

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate(user.role === 'administrador' ? '/admin/dashboard' : '/colaborador/home', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) return <LoadingSpinner />;
  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(199_89%_48%_/_0.2),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(224_76%_20%_/_0.5),_transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="absolute -inset-4 bg-white/5 rounded-3xl blur-2xl" />
        <div className="relative rounded-2xl bg-card/95 backdrop-blur-2xl p-8 shadow-elevated border border-white/10">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl overflow-hidden mb-5 shadow-glow-primary ring-1 ring-white/10">
              <img src="/logo.png" alt="IncentivosPro" className="h-16 w-16 object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">IncentivosPro</h1>
            <p className="text-sm text-muted-foreground mt-1">Selecione seu perfil para continuar</p>
          </div>

          <div className="grid gap-4">
            <button
              onClick={() => navigate('/login/colaborador')}
              className="group relative flex items-center gap-4 p-5 rounded-xl border border-border/60 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Motorista / Ajudante</p>
                <p className="text-xs text-muted-foreground mt-0.5">Acesse seus indicadores, incentivos e metas</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/login/admin')}
              className="group relative flex items-center gap-4 p-5 rounded-xl border border-border/60 bg-muted/30 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
            >
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Administrador</p>
                <p className="text-xs text-muted-foreground mt-0.5">Gerencie equipes, metas e desempenho</p>
              </div>
            </button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground/50 mt-6 tracking-wide">
            © {new Date().getFullYear()} IncentivosPro · Gestão de Entregas
          </p>
        </div>
      </div>
    </div>
  );
}
