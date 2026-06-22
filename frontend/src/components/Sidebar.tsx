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
  UserSquare2, LayoutTemplate, Bell, Wrench,
} from 'lucide-react';

const navItems = {
  admin: [
    { href: '/dashboard',    icon: LayoutDashboard, label: 'nav.dashboard' },
    { href: '/invoices',     icon: FileText,        label: 'nav.invoices' },
    { href: '/clients',      icon: UserSquare2,     label: 'nav.clients' },
    { href: '/deliveries',   icon: Truck,           label: 'nav.deliveries' },
    { href: '/tasks',        icon: CheckSquare,     label: 'nav.tasks' },
    { href: '/interventions',icon: Wrench,          label: 'nav.interventions' },
    { href: '/products',     icon: ShoppingBag,     label: 'nav.products' },
    { href: '/templates',    icon: LayoutTemplate,  label: 'nav.templates' },
    { href: '/users',        icon: Users,           label: 'nav.users' },
    { href: '/company',      icon: Building2,       label: 'nav.company' },
  ],
  commercial: [
    { href: '/dashboard',              icon: LayoutDashboard, label: 'nav.dashboard' },
    { href: '/invoices',               icon: FileText,        label: 'nav.invoices' },
    { href: '/clients',                icon: UserSquare2,     label: 'nav.clients' },
    { href: '/invoices/new?type=proforma',      icon: FileStack, label: 'nav.proforma' },
    { href: '/invoices/new?type=bon_livraison', icon: Package,   label: 'nav.delivery_note' },
    { href: '/products',               icon: ShoppingBag,     label: 'nav.products' },
    { href: '/notifications',          icon: Bell,            label: 'nav.notifications' },
  ],
  livreur: [
    { href: '/dashboard', icon: LayoutDashboard, label: 'nav.dashboard' },
    { href: '/tasks',     icon: CheckSquare,     label: 'nav.my_tasks' },
  ],
  technicien: [
    { href: '/dashboard',     icon: LayoutDashboard, label: 'nav.dashboard' },
    { href: '/interventions', icon: Wrench,          label: 'nav.my_interventions' },
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
    <aside key={locale} className="w-full md:w-64 bg-slate-950 text-white flex flex-col h-auto md:h-screen sticky top-0 z-30 shrink-0">
      <div className="px-4 py-3 md:px-6 md:py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <span className="font-display font-700 text-lg tracking-tight">Facturo</span>
        </div>
      </div>

      <div className="px-4 py-3 md:py-4 border-b border-slate-800">
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

      <nav className="flex px-3 py-3 gap-2 overflow-x-auto md:flex-1 md:block md:py-4 md:space-y-0.5 md:overflow-y-auto">
        {items.map(({ href, icon: Icon, label }) => {

          const baseHref = href.split('?')[0];
          const active = pathname === baseHref || (baseHref !== '/dashboard' && pathname.startsWith(baseHref));
          return (
            <Link key={href} href={href} className={clsx(
              'flex shrink-0 items-center gap-2 md:gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
              active ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}>
              <Icon size={18} className="shrink-0" />
              <span className="whitespace-nowrap">{t(label)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2 px-3 py-3 border-t border-slate-800 md:block md:py-4 md:space-y-1">
        <LanguageSelector />
        <div className={clsx('flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg', isOnline ? 'text-emerald-400' : 'text-amber-400')}>
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isOnline ? t('common.online') : t('common.offline')}
        </div>
        <button onClick={logout} className="flex w-auto items-center gap-2 md:gap-3 px-3 py-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg text-sm transition-all md:w-full">
          <LogOut size={18} />
          <span>{t('common.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
