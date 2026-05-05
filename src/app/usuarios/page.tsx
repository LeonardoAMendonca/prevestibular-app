'use client';

// ============================================================
//  ARQUIVO: src/app/usuarios/page.tsx
//  Rota: /usuarios
//  Acesso: ADMIN apenas
//  Permite: listar, adicionar, editar e desativar usuários
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { postToGAS } from '@/lib/gasClient';
import { PjuUser, UserRole } from '@/contexts/AuthContext';
import Link from 'next/link';

type UserForm = { email: string; nome: string; role: UserRole | ''; status: string };

const EMPTY_FORM: UserForm = { email: '', nome: '', role: '', status: 'ativo' };

const ROLE_BADGE: Record<string, string> = {
  ADMIN:       'bg-purple-100 text-purple-700',
  COORDENAÇÃO: 'bg-blue-100 text-blue-700',
  MONITOR:     'bg-green-100 text-green-700',
  INSPETOR:    'bg-orange-100 text-orange-700',
};

const ROLE_DESC: Record<string, string> = {
  ADMIN:       'Acesso total ao sistema',
  COORDENAÇÃO: 'Cadastra e edita alunos',
  MONITOR:     'Visualiza dados',
  INSPETOR:    'Visualiza dados',
};

export default function UsuariosPage() {
  const { currentUser, isLoading, allUsers, can, refreshData } = useAuth();
  const router = useRouter();

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<PjuUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
    if (!isLoading && currentUser && !can.manageUsers) router.replace('/dashboard');
  }, [isLoading, currentUser, can, router]);

  function openAdd() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setShowModal(true);
  }

  function openEdit(user: PjuUser) {
    setEditingUser(user);
    setForm({ email: user.email, nome: user.nome, role: user.role, status: user.status });
    setFeedback(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingUser(null);
    setFeedback(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email || !form.nome || !form.role) {
      setFeedback({ type: 'error', message: 'Preencha todos os campos obrigatórios.' });
      return;
    }
    if (!currentUser) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const action = editingUser ? 'UPDATE_USER' : 'ADD_USER';
      await postToGAS(action, form, currentUser.email);
      setFeedback({ type: 'success', message: editingUser ? 'Usuário atualizado!' : 'Usuário cadastrado!' });
      await refreshData();
      setTimeout(closeModal, 1200);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro desconhecido.' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleStatus(user: PjuUser) {
    if (!currentUser) return;
    const newStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await postToGAS('UPDATE_USER', { ...user, status: newStatus }, currentUser.email);
      await refreshData();
    } catch (err) {
      alert('Erro ao alterar status: ' + (err instanceof Error ? err.message : ''));
    }
  }

  const filtered = allUsers.filter((u) =>
    u.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
              ← Dashboard
            </Link>
            <span className="text-gray-200">/</span>
            <h1 className="text-gray-800 font-semibold text-sm">Gerenciar Usuários</h1>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Novo Usuário
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Cards de resumo por role */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {['ADMIN', 'COORDENAÇÃO', 'MONITOR', 'INSPETOR'].map((role) => (
            <div key={role} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-2xl font-bold text-gray-800">
                {allUsers.filter((u) => u.role === role).length}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[role]}`}>
                {role}
              </span>
              <p className="text-gray-400 text-xs mt-1">{ROLE_DESC[role]}</p>
            </div>
          ))}
        </div>

        {/* Busca */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Tabela de usuários */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Usuário</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">E-mail</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Perfil</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.email} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-500'}`}>
                        {user.nome?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{user.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-500'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Editar
                      </button>
                      {/* Não deixa desativar a si mesmo */}
                      {user.email !== currentUser.email && (
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`text-xs ${user.status === 'ativo' ? 'text-red-500 hover:underline' : 'text-green-600 hover:underline'}`}
                        >
                          {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhum usuário encontrado.</p>
          )}
        </div>
      </div>

      {/* Modal de cadastro/edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-6">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>

            {feedback && (
              <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                feedback.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {feedback.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  E-mail <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!!editingUser}
                  placeholder="usuario@gmail.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
                {!!editingUser && (
                  <p className="text-xs text-gray-400 mt-1">O e-mail não pode ser alterado.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Nome Completo <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Perfil (Role) <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Selecione...</option>
                  <option value="ADMIN">ADMIN — Acesso total</option>
                  <option value="COORDENAÇÃO">COORDENAÇÃO — Cadastra e edita alunos</option>
                  <option value="MONITOR">MONITOR — Apenas visualiza</option>
                  <option value="INSPETOR">INSPETOR — Apenas visualiza</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Salvando...' : editingUser ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}