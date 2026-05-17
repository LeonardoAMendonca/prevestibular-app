// ============================================================
//  ARQUIVO: src/components/Providers.tsx
//  Propósito: Camada de Client Components que envolve o app.
//  O layout.tsx (Server Component) não pode usar hooks,
//  então delegamos essa responsabilidade para este arquivo.
// ============================================================

'use client'; // <-- ESSENCIAL: marca este arquivo como Client Component

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    // SessionProvider do NextAuth DEVE ser o mais externo,
    // pois o AuthProvider depende do useSession() internamente.
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </SessionProvider>
  );
}