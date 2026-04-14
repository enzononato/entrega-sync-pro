import { useLocation, useNavigate } from 'react-router-dom';
import { Home, DollarSign, MessageSquare, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Dashboard', icon: Home, path: '/colaborador/home' },
  { label: 'Incentivo', icon: DollarSign, path: '/colaborador/incentivo' },
  { label: 'Feedback', icon: MessageSquare, path: '/colaborador/feedbacks' },
  { label: 'Perfil', icon: UserCircle, path: '/colaborador/perfil' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
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
      </div>
    </nav>
  );
}
