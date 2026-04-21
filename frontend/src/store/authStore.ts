import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';

export type UserRole = 'admin' | 'commercial' | 'livreur' | 'technicien';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  specialty?: string; // champ spécifique au technicien
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          localStorage.setItem('facturo_token', data.access_token);
          set({ user: data.user, token: data.access_token, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem('facturo_token');
        set({ user: null, token: null });
      },
    }),
    {
      name: 'facturo_auth',
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);