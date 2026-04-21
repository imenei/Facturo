'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/store/i18nStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import LanguageSelector from './LanguageSelector';
import clsx from 'clsx';
import {
  LayoutDashboard, FileText, Truck, CheckSquare, Users, Building2,
  LogOut, Wifi, WifiOff, Package, FileStack, ShoppingBag,
  UserSquare2, LayoutTemplate, Bell,
} from 'lucide-react';



import { Wrench } from 'lucide-react'; // ajouter à l'import lucide existant

const navItems = {
  admin: [
    { href: '/dashboard',    icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/invoices',     icon: FileText,         label: 'Factures' },
    { href: '/clients',      icon: UserSquare2,      label: 'Clients' },
    { href: '/deliveries',   icon: Truck,            label: 'Livraisons' },
    { href: '/tasks',        icon: CheckSquare,      label: 'Tâches' },
    { href: '/interventions',icon: Wrench,           label: 'Interventions' }, // ← NOUVEAU
    { href: '/products',     icon: ShoppingBag,      label: 'Produits' },
    { href: '/templates',    icon: LayoutTemplate,   label: 'Templates' },
    { href: '/users',        icon: Users,            label: 'Utilisateurs' },
    { href: '/company',      icon: Building2,        label: 'Entreprise' },
  ],
  commercial: [
    { href: '/dashboard',              icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/invoices',               icon: FileText,         label: 'Factures' },
    { href: '/clients',                icon: UserSquare2,      label: 'Clients' },
    { href: '/invoices/new?type=proforma',      icon: FileStack, label: 'Proforma' },
    { href: '/invoices/new?type=bon_livraison', icon: Package,   label: 'Bon de livraison' },
    { href: '/products',               icon: ShoppingBag,      label: 'Produits' },
    { href: '/notifications',          icon: Bell,             label: 'Rappels' },
  ],
  livreur: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/tasks',     icon: CheckSquare,     label: 'Mes tâches' },
  ],
  // ← NOUVEAU RÔLE TECHNICIEN
  technicien: [
    { href: '/dashboard',     icon: LayoutDashboard, label: 'Tableau de bord' },
    { href: '/interventions', icon: Wrench,          label: 'Mes interventions' },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { t, locale } = useI18nStore();
  const isOnline = useOnlineStatus();

  if (!user) return null;
  const items = navItems[user.role as keyof typeof navItems] || [];

  return (
    <aside key={locale} className="w-64 bg-slate-950 text-white flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <span className="font-display font-700 text-lg tracking-tight">Facturo</span>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold uppercase">
            {user.name?.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-slate-400 capitalize">{t(`role_${user.role}`)}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map(({ href, icon: Icon, label }) => {

          const baseHref = href.split('?')[0];
          const active = pathname === baseHref || (baseHref !== '/dashboard' && pathname.startsWith(baseHref));
          return (
            <Link key={href} href={href} className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
              active ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}>
              <Icon size={18} />
              {t(label)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <LanguageSelector />
        <div className={clsx('flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg', isOnline ? 'text-emerald-400' : 'text-amber-400')}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? t('common.online') : t('common.offline')}
        </div>
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg text-sm transition-all">
          <LogOut size={18} />
          {t('common.logout')}
        </button>
      </div>
    </aside>
  );
}
