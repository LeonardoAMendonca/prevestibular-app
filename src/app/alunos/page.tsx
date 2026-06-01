'use client';

// ============================================================
//  ARQUIVO: src/app/alunos/page.tsx
//  Rota: /alunos  — Lista completa de alunos (era o dashboard)
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useStudents';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const ROLE_BADGE: Record<string, string> = {
  ADMIN:              'bg-purple-100 text-purple-700',
  COORDENAÇÃO:        'bg-blue-100 text-blue-700',
  'PROFESSOR/MONITOR':'bg-green-100 text-green-700',
  INSPETOR:           'bg-orange-100 text-orange-700',
};

export default function AlunosPage() {
  const { currentUser, isLoading, logout, can } = useAuth();
  const { students, searchTerm, setSearchTerm, totalCount, filteredCount, setFilter, activeFilters, clearFilters } = useStudents();
  const router = useRouter();

  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
    if (!isLoading && currentUser && !can('VER_ALUNOS')) router.replace('/dashboard');
  }, [isLoading, currentUser, can, router]);

  useEffect(() => {
    setFilter('statusMatricula', filtroStatus);
  }, [filtroStatus]);

  if (isLoading || !currentUser) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-lg font-bold text-gray-800 hover:text-blue-600 transition-colors">PJU</Link>
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/dashboard" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">Dashboard</Link>
              <span className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg font-medium">Alunos</span>
              {can('VER_PRESENCA') && (
                <Link href="/presenca" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">Presença</Link>
              )}
              {can('GERENCIAR_USUARIOS') && (
                <Link href="/usuarios" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">Usuários</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">{currentUser.nome}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[currentUser.role] ?? 'bg-gray-100 text-gray-500'}`}>
                {currentUser.role}
              </span>
            </div>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Cabeçalho da página */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Alunos Cadastrados</h2>
            <p className="text-sm text-gray-400 mt-0.5">{totalCount} aluno(s) no total · {filteredCount} exibido(s)</p>
          </div>
          {can('CADASTRAR_ALUNOS') && (
            <Link href="/alunos/novo"
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
              + Cadastrar Aluno
            </Link>
          )}
        </div>

        {/* Cards rápidos */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Ativos',    count: students.filter(s=>s.statusMatricula==='ativo').length,    cor:'bg-green-100 text-green-700',  onClick:()=>setFiltroStatus('ativo') },
            { label:'Inativos',  count: students.filter(s=>s.statusMatricula==='inativo').length,  cor:'bg-gray-100 text-gray-500',    onClick:()=>setFiltroStatus('inativo') },
            { label:'Trancados', count: students.filter(s=>s.statusMatricula==='trancado').length, cor:'bg-yellow-100 text-yellow-700', onClick:()=>setFiltroStatus('trancado') },
            { label:'Concluídos',count: students.filter(s=>s.statusMatricula==='concluído').length,cor:'bg-blue-100 text-blue-700',    onClick:()=>setFiltroStatus('concluído') },
          ].map(({ label, count, cor, onClick }) => (
            <button key={label} onClick={onClick}
              className={`rounded-xl p-4 text-left transition-all hover:shadow-sm border-2 ${filtroStatus===label.toLowerCase().replace('í','i')+'do'||filtroStatus===label.toLowerCase()?'border-blue-400 ring-2 ring-blue-200':'border-transparent'} ${cor.includes('gray')?'bg-gray-50':cor.includes('green')?'bg-green-50':cor.includes('yellow')?'bg-yellow-50':'bg-blue-50'}`}>
              <p className={`text-2xl font-bold ${cor.split(' ')[1]}`}>{count}</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Barra de busca + filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
            <option value="trancado">Trancados</option>
            <option value="concluído">Concluídos</option>
          </select>
          {(searchTerm || Object.keys(activeFilters).length > 0) && (
            <button onClick={() => { clearFilters(); setFiltroStatus(''); }}
              className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
              Limpar
            </button>
          )}
        </div>

        {/* Tabela de alunos */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Aluno</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">CPF</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden md:table-cell">WhatsApp</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Bairro / Cidade</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.slice(0, 150).map(student => (
                <tr key={student.cpf}
                  onClick={() => router.push(`/alunos/${encodeURIComponent(student.cpf)}`)}
                  className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-blue-100 flex items-center justify-center">
                        {student.fotoUrl
                          ? <img src={student.fotoUrl} alt="" className="w-full h-full object-cover"/>
                          : <span className="text-blue-600 font-bold text-xs">{student.nome?.charAt(0)}</span>
                        }
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{student.nome}</p>
                        {student.email && <p className="text-xs text-gray-400 hidden sm:block">{student.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell font-mono text-xs">{student.cpf}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{student.telefoneWhatsapp || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs">
                    {student.bairro && student.cidade ? `${student.bairro}, ${student.cidade}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      student.statusMatricula === 'ativo'    ? 'bg-green-100 text-green-700'   :
                      student.statusMatricula === 'inativo'  ? 'bg-gray-100 text-gray-500'     :
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
            <div className="text-center py-20">
              <p className="text-5xl mb-3">👥</p>
              <p className="text-gray-400 text-sm mb-4">Nenhum aluno encontrado.</p>
              {can('CADASTRAR_ALUNOS') && (
                <Link href="/alunos/novo" className="text-blue-600 text-sm underline">Cadastrar o primeiro aluno →</Link>
              )}
            </div>
          )}

          {students.length > 150 && (
            <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-50">
              Exibindo 150 de {students.length} alunos. Use a busca para encontrar outros.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}