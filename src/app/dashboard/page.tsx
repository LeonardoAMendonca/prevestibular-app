'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useStudents';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { currentUser, isLoading, error, logout } = useAuth();
  const { students, searchTerm, setSearchTerm, filteredCount, totalCount } = useStudents();
  const router = useRouter();

  // Redireciona para login se não estiver autenticado
  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login');
    }
  }, [isLoading, currentUser, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Carregando dados do sistema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={logout} className="text-blue-600 underline text-sm">
          Sair e tentar outro e-mail
        </button>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">PJU — Dashboard</h1>
          <p className="text-sm text-gray-500">
            Olá, {currentUser.nome} · <span className="font-medium">{currentUser.role}</span>
          </p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          Sair
        </button>
      </div>

      {/* Estatística rápida */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6 inline-block">
        <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
        <p className="text-gray-500 text-sm">Alunos cadastrados</p>
      </div>

      {/* Busca */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-lg border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchTerm && (
          <p className="text-sm text-gray-400 mt-2">
            {filteredCount} resultado(s) para "{searchTerm}"
          </p>
        )}
      </div>

      {/* Lista de alunos */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">CPF</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">WhatsApp</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.slice(0, 50).map((student) => (
              <tr key={student.cpf} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{student.nome}</td>
                <td className="px-4 py-3 text-gray-500">{student.cpf}</td>
                <td className="px-4 py-3 text-gray-500">{student.telefoneWhatsapp}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    student.statusMatricula === 'ativo'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {student.statusMatricula || 'indefinido'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {students.length === 0 && (
          <p className="text-center text-gray-400 py-12">Nenhum aluno encontrado.</p>
        )}
      </div>
    </main>
  );
}