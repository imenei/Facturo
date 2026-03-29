'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  useEffect(() => {
    router.push(user ? '/dashboard' : '/login');
  }, [user, router]);
  return null;
}
