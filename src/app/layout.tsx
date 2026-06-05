// ============================================================
//  ARQUIVO: src/app/layout.tsx
// ============================================================

import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'PJU - Pré-Vestibular da Juventude',
  description: 'Sistema de gestão do PJU',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-slate-50 text-slate-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}