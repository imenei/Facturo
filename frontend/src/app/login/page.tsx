'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { FileText, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const { login, isLoading } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Connexion réussie');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Identifiants invalides');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-brand-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, #fff 1px, transparent 0)', backgroundSize: '50px 50px' }} />

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-brand-600 px-8 py-8 text-white">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-700">Facturo</h1>
                <p className="text-blue-200 text-sm">Gestion commerciale & livraisons</p>
              </div>
            </div>
            <p className="text-white/80 text-sm">Connectez-vous pour accéder à votre espace de travail.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            <div>
              <label className="label">Adresse e-mail</label>
              <input
                type="email"
                className="input"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3 text-base">
              {isLoading ? <><Loader2 size={18} className="animate-spin" /> Connexion…</> : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Facturo v1.0 — Application PWA sécurisée
        </p>
      </div>
    </div>
  );
}
