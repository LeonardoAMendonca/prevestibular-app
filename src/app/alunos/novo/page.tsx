'use client';

// ============================================================
//  ARQUIVO: src/app/alunos/novo/page.tsx
//  Rota: /alunos/novo
//  Acesso: ADMIN e COORDENAÇÃO apenas
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import StudentForm from '@/components/StudentForm';
import Link from 'next/link';

export default function NovoAlunoPage() {
  const { currentUser, isLoading, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
    if (!isLoading && currentUser && !can.writeStudents) router.replace('/dashboard');
  }, [isLoading, currentUser, can, router]);

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho da página */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            ← Dashboard
          </Link>
          <span className="text-gray-200">/</span>
          <h1 className="text-gray-800 font-semibold text-sm">Cadastrar Novo Aluno</h1>
        </div>
      </div>

      {/* Formulário */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800">Novo Aluno</h2>
            <p className="text-sm text-gray-400 mt-1">
              Preencha os dados do aluno. Campos com <span className="text-red-400">*</span> são obrigatórios.
            </p>
          </div>
          <StudentForm mode="add" />
        </div>
      </div>
    </main>
  );
}