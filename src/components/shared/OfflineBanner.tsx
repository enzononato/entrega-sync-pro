import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className={cn(
      'flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium',
      'bg-warning/90 text-warning-foreground'
    )}>
      <WifiOff className="h-3.5 w-3.5" />
      Sem conexão — dados do último acesso
    </div>
  );
}
