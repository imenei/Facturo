import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import I18nBootstrap from '@/components/I18nBootstrap';

export const metadata: Metadata = {
  title: 'Facturo — Gestion commerciale & livraisons',
  description: 'Application de facturation, gestion commerciale et suivi des livraisons',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Facturo' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
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
      </head>
      <body>
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

