'use client';

// ============================================================
//  ARQUIVO: src/app/login/page.tsx
//  Fix: erro de hidratação causado por isLoading divergindo
//  entre server render e client render do NextAuth.
//  Solução: só aplicar estado dinâmico após montar no cliente.
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();

  // Garante que estados dinâmicos (isLoading, error) só são
  // aplicados após a hidratação — evita mismatch server/client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  // Só mostra loading depois de montado no cliente
  const loading = mounted && isLoading;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">PJU</h1>
        <p className="text-gray-500 mb-8">Pré-Vestibular da Juventude</p>

        {mounted && error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={login}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Verificando...' : 'Entrar com Google'}
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Apenas usuários cadastrados têm acesso ao sistema.
        </p>
      </div>
    </main>
  );
}