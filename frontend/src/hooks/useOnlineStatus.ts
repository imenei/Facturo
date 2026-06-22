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
        const { synced, failed } = await syncOfflineQueue();
        if (synced > 0 && failed === 0) {
          toast.success(`${synced} action${synced > 1 ? 's' : ''} synchronisée${synced > 1 ? 's' : ''} avec succès`);
        } else if (synced > 0 && failed > 0) {
          toast(`${synced} synchronisée(s), ${failed} échouée(s) — vérifiez vos données`, { icon: '⚠️', style: { background: '#f59e0b', color: '#fff' } });
        } else if (failed > 0) {
          toast.error(`Échec de synchronisation de ${failed} action${failed > 1 ? 's' : ''}`);
        }
        // Si synced === 0 et failed === 0, la queue était vide : rien à signaler.
      } catch {
        toast.error('Erreur lors de la synchronisation');
      }
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
