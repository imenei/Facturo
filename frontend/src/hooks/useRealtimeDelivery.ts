'use client';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const DELIVERY_STATUS_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  livree: 'Livrée',
  non_livree: 'Non livrée',
};

/** Événement window émis à chaque changement de livraison : les pages (livreur, bon de livraison,
 *  suivi des livraisons) s'y abonnent pour se rafraîchir sans recharger la page. */
export const DELIVERY_UPDATED_EVENT = 'facturo:delivery-updated';

export function useRealtimeDelivery(onUpdate?: (data: any) => void) {
  const { user, token } = useAuthStore();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !token) return;

    let cancelled = false;

    // Lazy import socket.io-client
    import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      const socket = io(`${process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '')}/realtime`, {
        query: { role: user.role, userId: user.id },
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('WebSocket connected');
      });

      // Changement de statut de livraison (livreur, administrateur ou commercial).
      // On ne notifie pas l'auteur du changement, il a déjà son retour visuel.
      socket.on('delivery:status-updated', (data: any) => {
        if (!data?.actorId || data.actorId !== user.id) {
          const label = DELIVERY_STATUS_LABELS[data?.status] || data?.status || '';
          toast(`Livraison ${data?.number || ''}${data?.clientName ? ` — ${data.clientName}` : ''} : ${label}`, { icon: '🚚' });
        }
        window.dispatchEvent(new CustomEvent(DELIVERY_UPDATED_EVENT, { detail: data }));
        onUpdate?.(data);
      });

      socket.on('intervention:status-updated', (data: any) => {
        toast(`Intervention ${data.ticketNumber} — ${data.clientName} : ${data.status}`, { icon: '🛠️' });
        onUpdate?.(data);
      });

      // Ancien événement (déjà couvert par delivery:status-updated) : pas de second toast.
      socket.on('delivery:updated-by-livreur', (data: any) => {
        window.dispatchEvent(new CustomEvent(DELIVERY_UPDATED_EVENT, { detail: data }));
        onUpdate?.(data);
      });

      socket.on('task:assigned', (data: any) => {
        toast.success(`Nouvelle tâche assignée: ${data.task?.name}`);
        window.dispatchEvent(new CustomEvent(DELIVERY_UPDATED_EVENT, { detail: data }));
        window.dispatchEvent(new CustomEvent('facturo:task-assigned', { detail: data }));
        onUpdate?.(data);
      });

      socket.on('notification:reminder-sent', (data: any) => {
        toast(`Rappel envoyé à ${data.clientName}`, { icon: '📧' });
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });

    }).catch(() => {
      // socket.io-client not available, skip
    });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [user, token]);

  return socketRef;
}
