import type { Metadata } from 'next';
import './globals.css';
import { SessionProvider } from './providers';

export const metadata: Metadata = {
  title:       'EduSocial — Pré-Vestibular Social',
  description: 'Sistema de Gestão Integrado',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
