'use client';

import { useState, useEffect } from 'react';
import { Users as UsersIcon, UserPlus, Pencil, Trash2, Loader2, X, Check, AlertTriangle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Users } from '@/lib/gas-client';
import type { EduUser, UserRole } from '@/types';

const ROLES: UserRole[] = ['ADMIN', 'COORD', 'PROF', 'MONITOR', 'INSPETOR', 'ALUNO'];

const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  ADMIN:    'bg-amber-100 text-amber-700',
  COORD:    'bg-teal-100  text-teal-700',
  PROF:     'bg-blue-100  text-blue-700',
  MONITOR:  'bg-purple-100 text-purple-700',
  INSPETOR: 'bg-slate-100 text-slate-600',
  ALUNO:    'bg-slate-100 text-slate-500',
};

const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 5, COORD: 4, PROF: 3, MONITOR: 2, INSPETOR: 1, ALUNO: 0,
};

type Modal =
  | { type: 'create' }
  | { type: 'edit'; user: EduUser }
  | { type: 'delete'; user: EduUser }
  | null;

export default function UsuariosPage() {
  const { data: session } = useSession();
  const myRole   = (session?.user?.role as UserRole) ?? 'COORD';
  const myLevel  = ROLE_LEVEL[myRole] ?? 0;
  const isAdmin  = myRole === 'ADMIN';

  const [users,    setUsers]    = useState<EduUser[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<Modal>(null);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);

  // Form state
  const [fEmail, setFEmail] = useState('');
  const [fName,  setFName]  = useState('');
  const [fRole,  setFRole]  = useState<UserRole>('PROF');

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    setLoading(true);
    try { setUsers((await Users.list()).users); }
    catch { showToast('Erro ao carregar usuários.', false); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setFEmail(''); setFName(''); setFRole('PROF');
    setModal({ type: 'create' });
  }

  function openEdit(u: EduUser) {
    setFName(u.name); setFRole(u.role);
    setModal({ type: 'edit', user: u });
  }

  async function handleCreate() {
    if (!fEmail || !fName) { showToast('Preencha e-mail e nome.', false); return; }
    setSaving(true);
    try {
      await Users.create({ email: fEmail, name: fName, role: fRole });
      showToast('Usuário criado.');
      setModal(null);
      await load();
    } catch (e: any) { showToast(e.message ?? 'Erro.', false); }
    finally { setSaving(false); }
  }

  async function handleEdit() {
    if (modal?.type !== 'edit') return;
    setSaving(true);
    try {
      await Users.update({ email: modal.user.email, name: fName, role: fRole });
      showToast('Usuário atualizado.');
      setModal(null);
      await load();
    } catch (e: any) { showToast(e.message ?? 'Erro.', false); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return;
    setSaving(true);
    try {
      await Users.remove(modal.user.email);
      showToast('Usuário removido.');
      setModal(null);
      await load();
    } catch (e: any) { showToast(e.message ?? 'Erro.', false); }
    finally { setSaving(false); }
  }

  // Filtra papéis que o usuário atual pode criar (não pode criar acima de si)
  const allowedRoles = ROLES.filter(r => ROLE_LEVEL[r] <= myLevel);

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card-hover text-sm font-medium animate-slide-up
          ${toast.ok ? 'bg-teal-700 text-white' : 'bg-red-600 text-white'}`}
          style={{ fontFamily: 'var(--font-jakarta)' }}>
          {toast.ok ? <Check size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--c-primary-mid)', fontFamily: 'var(--font-jakarta)', fontWeight: 500 }}>
            Coordenação
          </p>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300 }}>
            Gestão de Usuários
          </h1>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <UserPlus size={15} /> Novo usuário
        </button>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            <Loader2 size={18} className="animate-spin"/> Carregando…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  {isAdmin && <th>Criado por</th>}
                  <th className="w-20 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const canEdit   = myLevel > ROLE_LEVEL[u.role] || isAdmin;
                  const canDelete = canEdit && u.email !== session?.user?.email;

                  return (
                    <tr key={u.email} className="animate-fade-in">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                               style={{ background: 'var(--c-surface-2)', color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                            {u.name[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm" style={{ color: 'var(--c-text)', fontFamily: 'var(--font-jakarta)' }}>
                            {u.name}
                          </span>
                        </div>
                      </td>
                      <td className="text-xs" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {u.email}
                      </td>
                      <td>
                        <span className={`role-badge ${ROLE_BADGE_STYLE[u.role]}`}>{u.role}</span>
                      </td>
                      {isAdmin && (
                        <td className="text-xs" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                          {u.created_by ?? '—'}
                        </td>
                      )}
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button onClick={() => openEdit(u)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Editar"
                              style={{ color: 'var(--c-text-muted)' }}>
                              <Pencil size={13}/>
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => setModal({ type: 'delete', user: u })}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Remover">
                              <Trash2 size={13}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(26,25,23,0.5)', backdropFilter: 'blur(2px)' }}
             onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 400, color: 'var(--c-text)' }}>
                {modal.type === 'create' ? 'Novo Usuário'
                  : modal.type === 'edit' ? 'Editar Usuário'
                  : 'Remover Usuário'}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={16} style={{ color: 'var(--c-text-muted)' }}/>
              </button>
            </div>

            <div className="px-6 py-5">
              {modal.type === 'delete' ? (
                <>
                  <div className="flex items-start gap-3 mb-5 p-4 rounded-xl" style={{ background: '#fef2f2' }}>
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#dc2626' }}/>
                    <p className="text-sm" style={{ color: '#991b1b', fontFamily: 'var(--font-jakarta)' }}>
                      Tem certeza que deseja remover <strong>{modal.user.name}</strong>?
                      Esta ação não pode ser desfeita.
                    </p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn-danger" onClick={handleDelete} disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                      Remover
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {modal.type === 'create' && (
                      <div>
                        <label className="label">E-mail Google</label>
                        <input className="field" type="email" placeholder="usuario@gmail.com"
                               value={fEmail} onChange={e => setFEmail(e.target.value)}/>
                      </div>
                    )}
                    <div>
                      <label className="label">Nome completo</label>
                      <input className="field" placeholder="Nome do colaborador"
                             value={fName} onChange={e => setFName(e.target.value)}/>
                    </div>
                    <div>
                      <label className="label">Papel no sistema</label>
                      <select className="field" value={fRole} onChange={e => setFRole(e.target.value as UserRole)}>
                        {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                    <button className="btn-primary" onClick={modal.type === 'create' ? handleCreate : handleEdit} disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                      {modal.type === 'create' ? 'Criar usuário' : 'Salvar'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
