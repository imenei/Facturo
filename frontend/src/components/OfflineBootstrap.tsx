'use client';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { flushOfflineQueue } from '@/lib/api';

// Enregistre le Service Worker et rejoue les actions faites hors ligne dès que le réseau revient.
export default function OfflineBootstrap() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const sync = async () => {
      const { synced, failed, remaining } = await flushOfflineQueue();
      if (synced > 0) toast.success(`${synced} action(s) hors ligne synchronisée(s)`);
      if (failed > 0) toast.error(`${failed} action(s) refusée(s) par le serveur`);
      if (remaining > 0) toast.error('Synchronisation interrompue : reconnectez-vous si nécessaire');
      if (synced > 0) {
        window.dispatchEvent(new Event('helpdz:synced'));
        const el = document.activeElement as HTMLElement | null;
        const typing = el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
        if (!typing) setTimeout(() => window.location.reload(), 800);
      }
    };

    const onOnline = () => { void sync(); };
    window.addEventListener('online', onOnline);
    if (navigator.onLine) void sync();
    return () => window.removeEventListener('online', onOnline);
  }, []);

  return null;
}
