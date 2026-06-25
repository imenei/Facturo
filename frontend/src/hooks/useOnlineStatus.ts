'use client';
import { useState, useEffect } from 'react';
import { syncOfflineQueue } from '../lib/api';
import toast from 'react-hot-toast';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      toast.success('Connexion rétablie — synchronisation en cours…');
      try {
        await syncOfflineQueue();
        toast.success('Données synchronisées avec succès');
      } catch {}
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast('Mode hors-ligne activé', { icon: '📶', style: { background: '#f59e0b', color: '#fff' } });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
