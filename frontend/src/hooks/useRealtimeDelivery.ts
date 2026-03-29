'use client';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export function useRealtimeDelivery(onUpdate?: (data: any) => void) {
  const { user, token } = useAuthStore();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!user || !token) return;

    // Lazy import socket.io-client
    import('socket.io-client').then(({ io }) => {
      const socket = io(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/realtime`, {
        query: { role: user.role, userId: user.id },
        auth: { token },
        transports: ['websocket'],
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('WebSocket connected');
      });

      socket.on('delivery:status-updated', (data: any) => {
        toast(`Livraison mise à jour: ${data.taskId}`, { icon: '🚚' });
        onUpdate?.(data);
      });

      socket.on('task:assigned', (data: any) => {
        toast.success(`Nouvelle tâche assignée: ${data.task?.name}`);
        onUpdate?.(data);
      });

      socket.on('notification:reminder-sent', (data: any) => {
        toast(`Rappel envoyé à ${data.clientName}`, { icon: '📧' });
      });

      socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
      });

      return () => { socket.disconnect(); };
    }).catch(() => {
      // socket.io-client not available, skip
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, token]);

  return socketRef;
}
