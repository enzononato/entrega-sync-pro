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
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border/60 z-40">
        <div className="flex items-stretch justify-around h-16 safe-area-pb">
          {tabs.map(tab => {
            const active = isActive(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-[3px] rounded-b-full bg-primary" />
                )}
                <tab.icon className={cn('h-5 w-5', active && 'text-primary')} />
                <span className={cn(
                  'text-[10px] font-semibold',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}>{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 text-muted-foreground"
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Mais</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="text-lg">Menu</SheetTitle>
          </SheetHeader>
          <div className="px-3 space-y-0.5">
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11" onClick={() => handleMore('/colaborador/indicadores')}>
              <Search className="mr-3 h-4 w-4 text-muted-foreground" /> Indicadores
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11" onClick={() => handleMore('/colaborador/planos-de-acao')}>
              <ClipboardList className="mr-3 h-4 w-4 text-muted-foreground" /> Planos de Ação
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11" onClick={() => handleMore('/colaborador/perfil')}>
              <UserCircle className="mr-3 h-4 w-4 text-muted-foreground" /> Meu Perfil
            </Button>
            <div className="my-2 border-t border-border/60" />
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11 text-destructive hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-3 h-4 w-4" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
