'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export type UserRole = 'ADMIN' | 'COORDENAÇÃO' | 'MONITOR' | 'INSPETOR';

// ─── Usuário do sistema — campos completos (CIPOP) ────────────
export interface PjuUser {
  // Acesso
  email: string;
  role: UserRole;
  status: string;
  dataIngresso: string;
  // Dados pessoais
  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  nacionalidade: string;
  fotoUrl: string;
  // Contato
  telefoneWhatsapp: string;
  telefoneSecundario: string;
  // Endereço
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  // Acadêmico / Profissional
  disciplina: string;
  instituicaoEnsino: string;
  curso: string;
  periodo: string;
  // Dados bancários
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  pix: string;
  // Emergência
  contatoEmergenciaNome: string;
  contatoEmergenciaTelefone: string;
  contatoEmergenciaParentesco: string;
}

// ─── Aluno ───────────────────────────────────────────────────
export interface Student {
  cpf: string; nome: string; email: string; dataNascimento: string; dataInscricao: string;
  telefoneWhatsapp: string; telefoneSecundario: string;
  cep: string; endereco: string; numero: string; complemento: string;
  bairro: string; cidade: string; estado: string;
  identidadeRacial: string; identidadeGenero: string;
  areaRiscoAmbiental: string; areaRiscoSeguranca: string;
  tipoMoradia: string; tratamentoEsgoto: string;
  quantidadeMoradores: string; rendaFamiliar: string; rendaPerCapita: string;
  concluiuEnsinoMedio: string; anoConclusaoEnsinoMedio: string;
  serieAtual: string; tipoEscola: string;
  temFilhos: string; quantidadeFilhos: string;
  pessoaComDeficiencia: string; qualDeficiencia: string;
  tipoSanguineo: string; possuiAlergia: string; qualAlergia: string;
  usaMedicamento: string; qualMedicamento: string;
  contatoEmergencia1Nome: string; contatoEmergencia1Telefone: string; contatoEmergencia1Parentesco: string;
  contatoEmergencia2Nome: string; contatoEmergencia2Telefone: string; contatoEmergencia2Parentesco: string;
  responsavelNome: string; responsavelRG: string; responsavelCPF: string;
  responsavelNacionalidade: string; responsavelTelefone: string;
  fotoUrl: string; statusMatricula: string;
}

interface AuthContextValue {
  currentUser: PjuUser | null; isLoading: boolean; isAuthenticated: boolean; error: string | null;
  students: Student[]; allUsers: PjuUser[];
  login: () => void; logout: () => void; refreshData: () => Promise<void>;
  can: { writeStudents: boolean; manageUsers: boolean; viewAll: boolean; };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [currentUser, setCurrentUser] = useState<PjuUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allUsers, setAllUsers] = useState<PjuUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (email: string) => {
    setIsLoading(true); setError(null);
    try {
      const response = await fetch('/api/gas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email }),
      });
      const result = await response.json();
      if (!result.success) { setError(result.error || 'Acesso negado.'); setCurrentUser(null); return; }
      setCurrentUser(result.currentUser);
      setStudents(result.data.students || []);
      setAllUsers(result.data.users || []);
    } catch (err) {
      setError('Erro de conexão: ' + (err instanceof Error ? err.message : ''));
      setCurrentUser(null);
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated' && session?.user?.email) fetchData(session.user.email);
    else { setIsLoading(false); setCurrentUser(null); setStudents([]); setAllUsers([]); }
  }, [status, session, fetchData]);

  const can = {
    writeStudents: currentUser ? ['ADMIN','COORDENAÇÃO'].includes(currentUser.role) : false,
    manageUsers:   currentUser ? currentUser.role === 'ADMIN' : false,
    viewAll:       currentUser ? ['ADMIN','COORDENAÇÃO'].includes(currentUser.role) : false,
  };

  const refreshData = useCallback(async () => {
    if (session?.user?.email) await fetchData(session.user.email);
  }, [session, fetchData]);

  const value: AuthContextValue = {
    currentUser, isLoading: isLoading || status === 'loading',
    isAuthenticated: !!currentUser, error, students, allUsers,
    login: () => signIn('google'),
    logout: () => { signOut(); setCurrentUser(null); setStudents([]); setAllUsers([]); },
    refreshData, can,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth() deve ser usado dentro de <AuthProvider>.');
  return ctx;
}