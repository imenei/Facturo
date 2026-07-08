'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { homeRouteForRole } from '@/lib/roles';

export default function HomePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  useEffect(() => {
    router.push(user ? homeRouteForRole(user.role) : '/login');
  }, [user, router]);
  return null;
}
