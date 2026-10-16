'use client';
import { useState, useEffect } from 'react';
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
  UserSquare2, LayoutTemplate, Bell, Wrench, Menu, X, Trash2,
} from 'lucide-react';

const adminNav = [
  { href: '/dashboard',    icon: LayoutDashboard, label: 'nav.dashboard' },
  { href: '/invoices',     icon: FileText,        label: 'nav.invoices' },
  { href: '/invoice-deletion-requests', icon: FileText, label: 'nav.deletion_requests' },
  { href: '/trash',        icon: Trash2,          label: 'nav.trash' },
  { href: '/clients',      icon: UserSquare2,     label: 'nav.clients' },
  { href: '/deliveries',   icon: Truck,           label: 'nav.deliveries' },
  { href: '/tasks',        icon: CheckSquare,     label: 'nav.tasks' },
  { href: '/interventions',icon: Wrench,          label: 'nav.interventions' },
  { href: '/products',     icon: ShoppingBag,     label: 'nav.products' },
  { href: '/templates',    icon: LayoutTemplate,  label: 'nav.templates' },
  { href: '/users',        icon: Users,           label: 'nav.users' },
  { href: '/company',      icon: Building2,       label: 'nav.company' },
];

const navItems = {
  admin: adminNav,
  commercial: [
    ...adminNav.filter((item) => !['/dashboard', '/users', '/invoice-deletion-requests'].includes(item.href)),
    { href: '/invoices/new?type=proforma',       icon: FileStack, label: 'nav.proforma' },
    { href: '/invoices/new?type=bon_livraison', icon: Package,   label: 'nav.delivery_note' },
    { href: '/notifications',                   icon: Bell,      label: 'nav.notifications' },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const isRTL = locale === 'ar';

  // Tiroir mobile : Échap pour fermer + on bloque le défilement de la page derrière le menu.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  // Repasse en mode bureau (≥ 1024px) : on referme le tiroir.
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!user) return null;
  const items = navItems[user.role as keyof typeof navItems] || [];

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="mobile-nav-toggle fixed start-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white shadow-lg lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        key={locale}
        className={clsx(
          'fixed inset-y-0 start-0 z-50 w-72 max-w-[85vw] bg-slate-950 text-white flex flex-col h-screen h-dvh shrink-0 overflow-hidden transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : isRTL ? 'translate-x-full' : '-translate-x-full',
        )}
      >
      <div className="px-6 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <span className="font-display font-700 text-lg tracking-tight">HelpDZ</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ms-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-slate-800 shrink-0">
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

      <nav className="flex-1 min-h-0 px-3 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
        {items.map(({ href, icon: Icon, label }) => {

          const baseHref = href.split('?')[0];
          const active = pathname === baseHref || (baseHref !== '/dashboard' && pathname.startsWith(baseHref));
          return (
            <Link key={href} href={href} className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
              active ? 'bg-brand-600 text-white font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              {t(label)}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-800 space-y-1 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
    </>
  );
}
