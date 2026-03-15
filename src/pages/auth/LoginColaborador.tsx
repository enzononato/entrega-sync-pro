import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Truck, ArrowLeft } from 'lucide-react';
import { formatCpf, validateCpf } from '@/lib/formatters';

export default function LoginColaborador() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      navigate(user.role === 'administrador' ? '/admin/dashboard' : '/colaborador/home', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanCpf = cpf.replace(/\D/g, '');
    if (!validateCpf(cleanCpf)) {
      setError('CPF inválido. Verifique os dígitos.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth-cpf', {
        body: { cpf: cleanCpf, password },
      });

      if (fnError || !data?.session) {
        setError(data?.error || 'CPF ou senha inválidos');
        return;
      }

      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } catch {
      setError('Erro ao conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!authLoading && user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(199_89%_48%_/_0.2),_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(224_76%_20%_/_0.5),_transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="w-full max-w-sm relative z-10 animate-scale-in">
        <div className="absolute -inset-4 bg-white/5 rounded-3xl blur-2xl" />
        <div className="relative rounded-2xl bg-card/95 backdrop-blur-2xl p-8 shadow-elevated border border-white/10">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 rounded-2xl overflow-hidden mb-5 shadow-glow-primary ring-1 ring-white/10">
              <img src="/logo.png" alt="IncentivosPro" className="h-16 w-16 object-cover" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Área do Colaborador</h1>
            <p className="text-sm text-muted-foreground mt-1">Motoristas e Ajudantes</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4 rounded-xl">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-sm font-medium">CPF</Label>
              <Input
                id="cpf"
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={e => setCpf(formatCpf(e.target.value))}
                required
                className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-muted/50 border-border/60 focus:bg-card pr-10 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl gradient-primary text-white font-semibold shadow-glow-primary hover:opacity-90 hover:shadow-lg transition-all"
              disabled={loading || authLoading}
            >
              {(loading || authLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <p className="text-center text-[10px] text-muted-foreground/50 mt-6 tracking-wide">
            © {new Date().getFullYear()} IncentivosPro · Gestão de Entregas
          </p>
        </div>
      </div>
    </div>
  );
}
