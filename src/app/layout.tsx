// ============================================================
//  ARQUIVO: src/app/layout.tsx
//  Propósito: Layout raiz do app. É um Server Component por
//  padrão — por isso NÃO pode conter hooks ou Context direto.
//  Delegamos isso ao <Providers />.
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
      <body>
        {/* Providers é um Client Component e pode usar hooks/Context */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}