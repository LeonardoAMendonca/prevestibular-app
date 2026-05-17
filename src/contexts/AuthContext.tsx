'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export type UserRole = 'ADMIN' | 'COORDENAÇÃO' | 'MONITOR' | 'INSPETOR';

export interface PjuUser {
  email: string;
  nome: string;
  role: UserRole;
  status: string;
}

// ─── Interface de Aluno atualizada ───────────────────────────
export interface Student {
  // Identificação
  cpf: string;
  nome: string;
  email: string;
  dataNascimento: string;
  dataInscricao: string;

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

  // Condição Socioeconômica
  identidadeRacial: string;
  identidadeGenero: string;
  areaRiscoAmbiental: string;
  areaRiscoSeguranca: string;
  tipoMoradia: string;
  tratamentoEsgoto: string;
  quantidadeMoradores: string;
  rendaFamiliar: string;
  rendaPerCapita: string;        // Calculado automaticamente
  concluiuEnsinoMedio: string;
  anoConclusaoEnsinoMedio: string; // Condicional: se concluiu
  serieAtual: string;              // Condicional: se não concluiu
  tipoEscola: string;
  temFilhos: string;
  quantidadeFilhos: string;        // Condicional: se tem filhos

  // Saúde
  pessoaComDeficiencia: string;
  qualDeficiencia: string;         // Condicional
  tipoSanguineo: string;
  possuiAlergia: string;
  qualAlergia: string;             // Condicional
  usaMedicamento: string;
  qualMedicamento: string;         // Condicional

  // Contatos de emergência
  contatoEmergencia1Nome: string;
  contatoEmergencia1Telefone: string;
  contatoEmergencia1Parentesco: string;
  contatoEmergencia2Nome: string;
  contatoEmergencia2Telefone: string;
  contatoEmergencia2Parentesco: string;

  // Responsável legal (menores de 18 anos)
  responsavelNome: string;
  responsavelRG: string;
  responsavelCPF: string;
  responsavelNacionalidade: string;
  responsavelTelefone: string;

  // Sistema
  fotoUrl: string;
  statusMatricula: string;
}

interface AuthContextValue {
  currentUser: PjuUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  students: Student[];
  allUsers: PjuUser[];
  login: () => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  can: {
    writeStudents: boolean;
    manageUsers: boolean;
    viewAll: boolean;
  };
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
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Acesso negado pelo sistema PJU.');
        setCurrentUser(null);
        return;
      }
      setCurrentUser(result.currentUser);
      setStudents(result.data.students || []);
      setAllUsers(result.data.users || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro de conexão';
      setError('Não foi possível conectar ao servidor: ' + message);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated' && session?.user?.email) {
      fetchData(session.user.email);
    } else {
      setIsLoading(false);
      setCurrentUser(null);
      setStudents([]);
      setAllUsers([]);
    }
  }, [status, session, fetchData]);

  const can = {
    writeStudents: currentUser ? ['ADMIN', 'COORDENAÇÃO'].includes(currentUser.role) : false,
    manageUsers:   currentUser ? currentUser.role === 'ADMIN' : false,
    viewAll:       currentUser ? ['ADMIN', 'COORDENAÇÃO'].includes(currentUser.role) : false,
  };

  const refreshData = useCallback(async () => {
    if (session?.user?.email) await fetchData(session.user.email);
  }, [session, fetchData]);

  const value: AuthContextValue = {
    currentUser,
    isLoading: isLoading || status === 'loading',
    isAuthenticated: !!currentUser,
    error,
    students,
    allUsers,
    login:  () => signIn('google'),
    logout: () => { signOut(); setCurrentUser(null); setStudents([]); setAllUsers([]); },
    refreshData,
    can,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth() deve ser usado dentro de <AuthProvider>.');
  return context;
}