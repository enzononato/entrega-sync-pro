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
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center justify-around z-40">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <tab.icon className="h-5 w-5" />
              {active && <span className="text-[10px] font-medium">{tab.label}</span>}
            </button>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            <Button variant="ghost" className="w-full justify-start" onClick={() => handleMore('/colaborador/feedbacks')}>
              <MessageSquare className="mr-3 h-4 w-4" /> Feedbacks
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => handleMore('/colaborador/causa-raiz')}>
              <AlertTriangle className="mr-3 h-4 w-4" /> Causa Raiz
            </Button>
            <Button variant="ghost" className="w-full justify-start" onClick={() => handleMore('/colaborador/perfil')}>
              <UserCircle className="mr-3 h-4 w-4" /> Meu Perfil
            </Button>
            <hr className="my-2" />
            <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-3 h-4 w-4" /> Sair
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
