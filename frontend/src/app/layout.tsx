import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import I18nBootstrap from '@/components/I18nBootstrap';

export const metadata: Metadata = {
  title: 'HelpDZ — Gestion commerciale & livraisons',
  description: 'Application de facturation, gestion commerciale et suivi des livraisons',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'HelpDZ' },
  icons: { icon: '/icons/icon-512.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#1a54ff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Le cache PWA (Service Worker) a été désactivé : on s'assure ici
              // que tout Service Worker précédemment installé est bien supprimé
              // chez les utilisateurs existants, et que le site ne garde plus
              // aucune version en cache.
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  registrations.forEach(function(reg) { reg.unregister(); });
                });
              }
              if (window.caches && window.caches.keys) {
                window.caches.keys().then(function(names) {
                  names.forEach(function(name) { window.caches.delete(name); });
                });
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <I18nBootstrap />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: 'Inter, system-ui', fontSize: '14px', borderRadius: '10px' },
            success: { iconTheme: { primary: '#1a54ff', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}