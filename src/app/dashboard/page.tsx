'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useStudents';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentUser, isLoading, error, logout, can } = useAuth();
  const { students, searchTerm, setSearchTerm, filteredCount, totalCount } = useStudents();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
  }, [isLoading, currentUser, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando dados do sistema...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button onClick={logout} className="text-blue-600 underline text-sm">
            Sair e tentar outro e-mail
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const roleBadge: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    COORDENAÇÃO: 'bg-blue-100 text-blue-700',
    MONITOR: 'bg-green-100 text-green-700',
    INSPETOR: 'bg-orange-100 text-orange-700',
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-800">PJU</h1>
            <nav className="hidden sm:flex items-center gap-1">
              <span className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg font-medium">
                Alunos
              </span>
              {can.manageUsers && (
                <Link
                  href="/usuarios"
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Usuários
                </Link>
              )}
              <Link
                href="/presenca"
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Presença
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">{currentUser.nome}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[currentUser.role] ?? 'bg-gray-100 text-gray-500'}`}>
                {currentUser.role}
              </span>
            </div>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total de Alunos" value={totalCount} color="blue" />
          <StatCard label="Ativos" value={students.filter(s => s.statusMatricula === 'ativo').length} color="green" />
          <StatCard label="Inativos" value={students.filter(s => s.statusMatricula === 'inativo').length} color="gray" />
          <StatCard label="Resultados da busca" value={searchTerm ? filteredCount : totalCount} color="purple" />
        </div>

        {/* Barra de ações */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {can.writeStudents && (
            <Link
              href="/alunos/novo"
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              + Cadastrar Aluno
            </Link>
          )}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">CPF</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden md:table-cell">WhatsApp</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Bairro / Cidade</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 100).map((student) => (
                <tr
                  key={student.cpf}
                  onClick={() => router.push(`/alunos/${encodeURIComponent(student.cpf)}`)}
                  className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {student.nome?.charAt(0).toUpperCase()}
                      </div>
                      <span>{student.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell font-mono text-xs">{student.cpf}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{student.telefoneWhatsapp || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs">
                    {student.bairro && student.cidade ? `${student.bairro}, ${student.cidade}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${student.statusMatricula === 'ativo' ? 'bg-green-100 text-green-700' :
                        student.statusMatricula === 'inativo' ? 'bg-gray-100 text-gray-500' :
                          student.statusMatricula === 'trancado' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-600'
                      }`}>
                      {student.statusMatricula || 'indefinido'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {students.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm mb-4">Nenhum aluno cadastrado ainda.</p>
              {can.writeStudents && (
                <Link href="/alunos/novo" className="text-blue-600 text-sm underline">
                  Cadastrar o primeiro aluno →
                </Link>
              )}
            </div>
          )}

          {students.length > 100 && (
            <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-50">
              Exibindo 100 de {students.length} alunos. Use a busca para encontrar outros.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600',
    gray: 'text-gray-500', purple: 'text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}