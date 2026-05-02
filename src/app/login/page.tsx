'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { login, isAuthenticated, isLoading, error } = useAuth();
  const router = useRouter();

  // Redireciona automaticamente se já estiver autenticado
  useEffect(() => {
    if (isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">PJU</h1>
        <p className="text-gray-500 mb-8">Pré-Vestibular da Juventude</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={login}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3 px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Verificando...' : 'Entrar com Google'}
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Apenas usuários cadastrados têm acesso ao sistema.
        </p>
      </div>
    </main>
  );
}