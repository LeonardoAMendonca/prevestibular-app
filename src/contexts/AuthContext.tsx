// ============================================================
//  ARQUIVO: src/contexts/AuthContext.tsx
//  Propósito: O "guarda de segurança" do app.
//
//  Este Context funciona como um encanamento que distribui
//  as informações do usuário logado para todos os componentes
//  do app. Qualquer tela pode perguntar: "quem está logado?"
//  e receber a resposta instantaneamente, sem precisar
//  fazer a busca novamente.
//
//  FLUXO DE AUTENTICAÇÃO:
//  1. Usuário clica em "Entrar com Google"
//  2. Google autentica e retorna o e-mail
//  3. Este Context verifica se o e-mail está na db_users
//  4. Se sim: libera o app e armazena os dados do usuário
//  5. Se não: exibe tela de "Acesso Negado"
// ============================================================

'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

// ─── Tipos TypeScript ─────────────────────────────────────────
// Definem a "forma" dos dados que vamos trabalhar.
// Isso ajuda o editor a encontrar erros antes de rodar o código.

export type UserRole = 'ADMIN' | 'COORDENAÇÃO' | 'MONITOR' | 'INSPETOR';

export interface PjuUser {
  email: string;
  nome: string;
  role: UserRole;
  status: string;
}

export interface Student {
  cpf: string;
  nome: string;
  telefoneWhatsapp: string;
  telefoneSecundario: string;
  dataNascimento: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  temFilhos: string;
  identidadeRacial: string;
  identidadeGenero: string;
  areaRiscoAmbiental: string;
  areaRiscoSeguranca: string;
  tipoMoradia: string;
  quantidadeMoradores: string;
  concluiuEnsinoMedio: string;
  instituicaoEnsinoMedio: string;
  anoConclusaoEnsinoMedio: string;
  tipoSanguineo: string;
  fotoUrl: string;
  statusMatricula: string;
}

// O que este Context disponibiliza para o resto do app
interface AuthContextValue {
  // Estado do usuário
  currentUser: PjuUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Dados carregados do backend
  students: Student[];
  allUsers: PjuUser[];

  // Ações disponíveis
  login: () => void;
  logout: () => void;
  refreshData: () => Promise<void>;

  // Verificadores de permissão (evita espalhar lógica pelo app)
  can: {
    writeStudents: boolean;   // Pode cadastrar/editar alunos?
    manageUsers: boolean;     // Pode gerenciar usuários?
    viewAll: boolean;         // Pode ver todos os dados?
  };
}

// ─── Criação do Context ───────────────────────────────────────
// O Context começa vazio. Ele só ganha valores quando o
// AuthProvider é inicializado (mais abaixo).
const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider: O componente que "alimenta" o Context ─────────
// Envolve o app inteiro lá no layout.tsx.
// Qualquer componente filho pode acessar os dados via useAuth().
export function AuthProvider({ children }: { children: ReactNode }) {
  // useSession() vem do NextAuth e controla o login com Google
  const { data: session, status } = useSession();

  // Estado local do nosso sistema (diferente da sessão do Google)
  const [currentUser, setCurrentUser] = useState<PjuUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allUsers, setAllUsers] = useState<PjuUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Função que busca os dados do backend GAS.
  // useCallback garante que esta função não seja recriada
  // desnecessariamente, otimizando a performance.
  const fetchData = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Chama nossa API Route do Next.js, que por sua vez chama o GAS.
      // Usamos nossa própria rota (/api/gas) para não expor a URL
      // do GAS diretamente no frontend (boa prática de segurança).
      const response = await fetch('/api/gas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: email }),
      });

      const result = await response.json();

      if (!result.success) {
        // O backend retornou um erro (ex: usuário não cadastrado)
        setError(result.error || 'Acesso negado pelo sistema PJU.');
        setCurrentUser(null);
        return;
      }

      // Sucesso! Armazena todos os dados no estado local.
      // A partir daqui, o app trabalha com dados locais (sem mais chamadas ao GAS).
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

  // Este efeito roda sempre que o status da sessão Google muda.
  // É o ponto de entrada: quando o Google confirma o login, buscamos
  // se esse e-mail existe no nosso sistema.
  useEffect(() => {
    if (status === 'loading') {
      // Ainda carregando a sessão do Google, aguarda
      return;
    }

    if (status === 'authenticated' && session?.user?.email) {
      // Google autenticou! Agora verificamos no nosso sistema.
      fetchData(session.user.email);
    } else {
      // Não há sessão ativa
      setIsLoading(false);
      setCurrentUser(null);
      setStudents([]);
      setAllUsers([]);
    }
  }, [status, session, fetchData]);

  // Calcula as permissões baseado no role do usuário logado.
  // Centralizar aqui evita repetir lógica de permissão em cada tela.
  const can = {
    writeStudents: currentUser
      ? ['ADMIN', 'COORDENAÇÃO'].includes(currentUser.role)
      : false,
    manageUsers: currentUser
      ? currentUser.role === 'ADMIN'
      : false,
    viewAll: currentUser
      ? ['ADMIN', 'COORDENAÇÃO'].includes(currentUser.role)
      : false,
  };

  // Força uma nova busca de dados (para após salvar alterações)
  const refreshData = useCallback(async () => {
    if (session?.user?.email) {
      await fetchData(session.user.email);
    }
  }, [session, fetchData]);

  const value: AuthContextValue = {
    currentUser,
    isLoading: isLoading || status === 'loading',
    isAuthenticated: !!currentUser,
    error,
    students,
    allUsers,
    login: () => signIn('google'),
    logout: () => {
      signOut();
      setCurrentUser(null);
      setStudents([]);
      setAllUsers([]);
    },
    refreshData,
    can,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook de acesso ───────────────────────────────────────────
// Este é o "controle remoto" para acessar o Context.
// Em qualquer componente, escreva:
//   const { currentUser, students, can } = useAuth();
// e você terá acesso a todos os dados.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() deve ser usado dentro de <AuthProvider>. Verifique o layout.tsx.');
  }
  return context;
}