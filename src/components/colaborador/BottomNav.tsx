import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign, Search, MessageSquare, MoreHorizontal, ClipboardList, AlertTriangle, UserCircle, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', icon: Home, path: '/colaborador/home' },
  { label: 'Remuneração', icon: DollarSign, path: '/colaborador/incentivo' },
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

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border/40 z-40 bottom-nav-bar"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-stretch justify-around h-16">
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
            className="flex flex-col items-center justify-center gap-0.5 flex-1 text-muted-foreground"
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-lg">
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </div>
            <span className="text-[10px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="text-lg font-bold">Menu</SheetTitle>
          </SheetHeader>
          <div className="px-3 space-y-0.5">
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11 gap-3" onClick={() => handleMore('/colaborador/indicadores')}>
              <Search className="h-4 w-4 text-muted-foreground" /> Indicadores
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11 gap-3" onClick={() => handleMore('/colaborador/planos-de-acao')}>
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> Planos de Ação
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11 gap-3" onClick={() => handleMore('/colaborador/perfil')}>
              <UserCircle className="h-4 w-4 text-muted-foreground" /> Meu Perfil
            </Button>
            <div className="my-3 border-t border-border/40" />
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11 gap-3 text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
