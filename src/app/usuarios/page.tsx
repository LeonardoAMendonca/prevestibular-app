'use client';

// ============================================================
//  ARQUIVO: src/app/usuarios/page.tsx
//  Gerenciamento completo de usuários (ADMIN apenas)
//  Usa o componente UserForm para cadastro e edição
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { postToGAS } from '@/lib/gasClient';
import { PjuUser } from '@/contexts/AuthContext';
import UserForm from '@/components/UserForm';
import Link from 'next/link';

const ROLE_BADGE: Record<string, string> = {
  ADMIN:       'bg-purple-100 text-purple-700',
  COORDENAÇÃO: 'bg-blue-100 text-blue-700',
  MONITOR:     'bg-green-100 text-green-700',
  INSPETOR:    'bg-orange-100 text-orange-700',
};

const ROLE_ICON: Record<string, string> = {
  ADMIN: '👑', COORDENAÇÃO: '📋', MONITOR: '👁️', INSPETOR: '🔍',
};

export default function UsuariosPage() {
  const { currentUser, isLoading, allUsers, can, refreshData } = useAuth();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [filtroRole, setFiltroRole] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativo');

  // Painel lateral (slide-over)
  const [painelAberto, setPainelAberto] = useState(false);
  const [usuarioEdicao, setUsuarioEdicao] = useState<PjuUser | null>(null);

  // Modal de confirmação de status
  const [modalStatus, setModalStatus] = useState<PjuUser | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState(false);

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
    if (!isLoading && currentUser && !can.manageUsers) router.replace('/dashboard');
  }, [isLoading, currentUser, can, router]);

  function abrirNovo() {
    setUsuarioEdicao(null);
    setPainelAberto(true);
  }

  function abrirEdicao(user: PjuUser) {
    setUsuarioEdicao(user);
    setPainelAberto(true);
  }

  function fecharPainel() {
    setPainelAberto(false);
    setUsuarioEdicao(null);
  }

  async function handleToggleStatus() {
    if (!modalStatus || !currentUser) return;
    setAlterandoStatus(true);
    try {
      const novoStatus = modalStatus.status === 'ativo' ? 'inativo' : 'ativo';
      await postToGAS('UPDATE_USER', { ...modalStatus, status: novoStatus }, currentUser.email);
      await refreshData();
      setModalStatus(null);
    } catch (err) {
      alert('Erro: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setAlterandoStatus(false);
    }
  }

  // Filtros combinados
  const usuariosFiltrados = useMemo(() => {
    return allUsers.filter(u => {
      const matchSearch = !searchTerm ||
        u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.cpf?.includes(searchTerm) ||
        u.disciplina?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole   = !filtroRole   || u.role === filtroRole;
      const matchStatus = !filtroStatus || u.status === filtroStatus;
      return matchSearch && matchRole && matchStatus;
    });
  }, [allUsers, searchTerm, filtroRole, filtroStatus]);

  // Contadores por role
  const counters = useMemo(() => ({
    ADMIN:       allUsers.filter(u => u.role === 'ADMIN').length,
    COORDENAÇÃO: allUsers.filter(u => u.role === 'COORDENAÇÃO').length,
    MONITOR:     allUsers.filter(u => u.role === 'MONITOR').length,
    INSPETOR:    allUsers.filter(u => u.role === 'INSPETOR').length,
    inativos:    allUsers.filter(u => u.status === 'inativo').length,
  }), [allUsers]);

  function calcularIdade(dataNascimento: string): string {
    if (!dataNascimento) return '';
    try {
      const nasc = new Date(dataNascimento);
      const hoje = new Date();
      let idade = hoje.getFullYear() - nasc.getFullYear();
      const m = hoje.getMonth() - nasc.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
      return `${idade} anos`;
    } catch { return ''; }
  }

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
              ← Dashboard
            </Link>
            <span className="text-gray-200">/</span>
            <h1 className="text-gray-800 font-semibold text-sm">Gerenciar Usuários</h1>
          </div>
          <button
            onClick={abrirNovo}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            + Novo Usuário
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {[
            { role: 'ADMIN',       count: counters.ADMIN,       icon: '👑', cor: 'border-purple-200 bg-purple-50' },
            { role: 'COORDENAÇÃO', count: counters.COORDENAÇÃO, icon: '📋', cor: 'border-blue-200 bg-blue-50' },
            { role: 'MONITOR',     count: counters.MONITOR,     icon: '👁️', cor: 'border-green-200 bg-green-50' },
            { role: 'INSPETOR',    count: counters.INSPETOR,    icon: '🔍', cor: 'border-orange-200 bg-orange-50' },
            { role: 'Inativos',    count: counters.inativos,    icon: '🚫', cor: 'border-gray-200 bg-gray-50' },
          ].map(({ role, count, icon, cor }) => (
            <button
              key={role}
              onClick={() => {
                if (role === 'Inativos') { setFiltroStatus('inativo'); setFiltroRole(''); }
                else { setFiltroRole(filtroRole === role ? '' : role); setFiltroStatus(''); }
              }}
              className={`rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm ${cor} ${
                (filtroRole === role || (role === 'Inativos' && filtroStatus === 'inativo'))
                  ? 'ring-2 ring-blue-400 ring-offset-1' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">{icon}</span>
                <span className="text-2xl font-bold text-gray-700">{count}</span>
              </div>
              <p className="text-xs font-medium text-gray-500">{role}</p>
            </button>
          ))}
        </div>

        {/* Barra de filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, CPF ou disciplina..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <select
            value={filtroRole}
            onChange={e => setFiltroRole(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos os perfis</option>
            {['ADMIN','COORDENAÇÃO','MONITOR','INSPETOR'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          {(searchTerm || filtroRole || filtroStatus) && (
            <button
              onClick={() => { setSearchTerm(''); setFiltroRole(''); setFiltroStatus('ativo'); }}
              className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Tabela de usuários */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600">
              {usuariosFiltrados.length} usuário(s) encontrado(s)
            </p>
          </div>

          {usuariosFiltrados.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-3">👥</p>
              <p className="text-gray-400 text-sm">Nenhum usuário encontrado.</p>
              <button onClick={abrirNovo} className="mt-4 text-blue-600 text-sm underline">
                Cadastrar o primeiro usuário →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {usuariosFiltrados.map(user => (
                <div
                  key={user.email}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar / foto */}
                    <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-gray-100">
                      {user.fotoUrl
                        ? <img src={user.fotoUrl} alt={user.nome} className="w-full h-full object-cover" />
                        : (
                          <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-500'}`}>
                            {user.nome?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )
                      }
                    </div>

                    {/* Informações principais */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{user.nome}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ROLE_ICON[user.role]} {user.role}
                        </span>
                        {user.status !== 'ativo' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            Inativo
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                        <p className="text-xs text-gray-400">{user.email}</p>
                        {user.cpf && <p className="text-xs text-gray-400 font-mono">{user.cpf}</p>}
                        {user.dataNascimento && <p className="text-xs text-gray-400">{calcularIdade(user.dataNascimento)}</p>}
                        {user.disciplina && <p className="text-xs text-blue-500">{user.disciplina}</p>}
                        {user.telefoneWhatsapp && <p className="text-xs text-gray-400">{user.telefoneWhatsapp}</p>}
                      </div>
                    </div>

                    {/* Dados bancários badge */}
                    <div className="hidden lg:flex flex-col items-end gap-1 flex-shrink-0">
                      {user.pix
                        ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">✓ PIX cadastrado</span>
                        : <span className="text-xs text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">Sem dados bancários</span>
                      }
                      {user.dataIngresso && (
                        <p className="text-xs text-gray-300">Desde {user.dataIngresso.split('-').reverse().join('/')}</p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => abrirEdicao(user)}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                      >
                        Editar
                      </button>
                      {user.email !== currentUser.email && (
                        <button
                          onClick={() => setModalStatus(user)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                            user.status === 'ativo'
                              ? 'text-red-500 bg-red-50 hover:bg-red-100 border-red-200'
                              : 'text-green-600 bg-green-50 hover:bg-green-100 border-green-200'
                          }`}
                        >
                          {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Painel lateral (slide-over) de cadastro/edição ── */}
      {painelAberto && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={fecharPainel}
          />
          {/* Painel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[600px] bg-white shadow-2xl flex flex-col">
            {/* Header do painel */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {usuarioEdicao ? 'Editar Usuário' : 'Novo Usuário'}
                </h2>
                {usuarioEdicao && (
                  <p className="text-sm text-gray-400 mt-0.5">{usuarioEdicao.nome}</p>
                )}
              </div>
              <button
                onClick={fecharPainel}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-xl font-light"
              >
                ×
              </button>
            </div>
            {/* Conteúdo rolável */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <UserForm
                user={usuarioEdicao}
                onClose={fecharPainel}
                onSuccess={() => {
                  fecharPainel();
                  refreshData();
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Modal confirmação de ativar/desativar */}
      {modalStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
              modalStatus.status === 'ativo' ? 'bg-red-100' : 'bg-green-100'
            }`}>
              <span className="text-xl">{modalStatus.status === 'ativo' ? '🚫' : '✅'}</span>
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-2">
              {modalStatus.status === 'ativo' ? 'Desativar usuário?' : 'Ativar usuário?'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              <span className="font-semibold">{modalStatus.nome}</span>
              {modalStatus.status === 'ativo'
                ? ' perderá acesso ao sistema imediatamente.'
                : ' voltará a ter acesso ao sistema.'
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModalStatus(null)}
                disabled={alterandoStatus}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={alterandoStatus}
                className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 ${
                  modalStatus.status === 'ativo'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {alterandoStatus ? 'Aguarde...' : modalStatus.status === 'ativo' ? 'Sim, desativar' : 'Sim, ativar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}