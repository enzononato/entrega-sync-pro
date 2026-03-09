import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign, Search, MessageSquare, MoreHorizontal, ClipboardList, AlertTriangle, UserCircle, LogOut, BarChart3 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', icon: Home, path: '/colaborador/home' },
  { label: 'Incentivo', icon: DollarSign, path: '/colaborador/incentivo' },
  { label: 'Análise', icon: Search, path: '/colaborador/causa-raiz' },
  { label: 'Feedback', icon: MessageSquare, path: '/colaborador/feedbacks' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleMore = (path: string) => {
    setMoreOpen(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    setMoreOpen(false);
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;
  const isMoreActive = ['/colaborador/indicadores', '/colaborador/planos-de-acao', '/colaborador/perfil'].includes(location.pathname);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/40 z-40 bottom-nav-bar"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
          {tabs.map(tab => {
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2.5px] rounded-b-full bg-primary transition-all" />
                )}
                <div className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-200',
                  active && 'bg-primary/10'
                )}>
                  <tab.icon className={cn('h-[18px] w-[18px] transition-all', active && 'text-primary')} />
                </div>
                <span className={cn(
                  'text-[10px] font-semibold transition-all',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}>{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 transition-all duration-200',
              isMoreActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <div className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg',
              isMoreActive && 'bg-primary/10'
            )}>
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </div>
            <span className="text-[10px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-lg font-bold">Menu</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 py-2">
            <Button variant="ghost" className="w-full justify-start rounded-xl h-12 gap-3 text-base" onClick={() => handleMore('/colaborador/indicadores')}>
              <BarChart3 className="h-5 w-5 text-primary" /> Indicadores
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-12 gap-3 text-base" onClick={() => handleMore('/colaborador/planos-de-acao')}>
              <ClipboardList className="h-5 w-5 text-amber-500" /> Planos de Ação
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-12 gap-3 text-base" onClick={() => handleMore('/colaborador/perfil')}>
              <UserCircle className="h-5 w-5 text-blue-500" /> Meu Perfil
            </Button>
            <div className="my-2 border-t border-border/40" />
            <Button variant="ghost" className="w-full justify-start rounded-xl h-12 gap-3 text-base text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
