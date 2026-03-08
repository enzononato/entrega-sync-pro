import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, DollarSign, ClipboardList, MoreHorizontal, MessageSquare, AlertTriangle, UserCircle, LogOut } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Home', icon: Home, path: '/colaborador/home' },
  { label: 'Indicadores', icon: BarChart2, path: '/colaborador/indicadores' },
  { label: 'Incentivo', icon: DollarSign, path: '/colaborador/incentivo' },
  { label: 'Ações', icon: ClipboardList, path: '/colaborador/planos-de-acao' },
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

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-xl border-t border-border/60 flex items-center justify-around z-40 safe-area-pb">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200 rounded-xl',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {active && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full gradient-primary" />
              )}
              <tab.icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
              <span className={cn(
                "text-[10px] font-medium transition-all",
                active ? "opacity-100" : "opacity-0 h-0"
              )}>{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-xl"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle className="text-lg">Menu</SheetTitle>
          </SheetHeader>
          <div className="px-3 space-y-0.5">
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11" onClick={() => handleMore('/colaborador/feedbacks')}>
              <MessageSquare className="mr-3 h-4 w-4 text-muted-foreground" /> Feedbacks
            </Button>
            <Button variant="ghost" className="w-full justify-start rounded-xl h-11" onClick={() => handleMore('/colaborador/causa-raiz')}>
              <AlertTriangle className="mr-3 h-4 w-4 text-muted-foreground" /> Causa Raiz
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
