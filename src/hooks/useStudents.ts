// ============================================================
//  ARQUIVO: src/hooks/useStudents.ts
//  Propósito: Busca e filtragem de alunos no lado do cliente.
//
//  FILOSOFIA (ESTRATÉGIA "FRONTEND ROBUSTO"):
//  Os dados de todos os alunos já estão em memória (carregados
//  pelo AuthContext na inicialização). Este hook simplesmente
//  FILTRA esses dados localmente — sem nenhuma chamada ao servidor.
//
//  Resultado prático: busca de alunos é INSTANTÂNEA, independente
//  de quantos alunos existam. O Google Sheets só é consultado
//  uma vez por sessão (ou quando o cache expira).
// ============================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Student } from '@/contexts/AuthContext';

// Opções de configuração do hook
interface UseStudentsOptions {
  initialSearch?: string;       // Termo de busca inicial (opcional)
  initialFilter?: Partial<{     // Filtros iniciais (opcional)
    statusMatricula: string;
    cidade: string;
    estado: string;
    identidadeRacial: string;
    concluiuEnsinoMedio: string;
  }>;
}

// O que este hook retorna
interface UseStudentsReturn {
  // Dados
  students: Student[];           // Lista filtrada de alunos (para exibir)
  totalCount: number;            // Total sem filtro (para mostrar "1.234 alunos")
  filteredCount: number;         // Total com filtro aplicado

  // Estado da busca
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeFilters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;

  // Estado de loading/erro (herdado do AuthContext)
  isLoading: boolean;
  error: string | null;

  // Função para encontrar um aluno específico por CPF
  findByCpf: (cpf: string) => Student | undefined;
}

export function useStudents(options: UseStudentsOptions = {}): UseStudentsReturn {
  const { students: allStudents, isLoading, error } = useAuth();

  // Estado local para busca e filtros
  const [searchTerm, setSearchTerm] = useState(options.initialSearch || '');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    options.initialFilter as Record<string, string> || {}
  );

  // useMemo garante que a filtragem só é recalculada quando
  // os dados ou os critérios de busca mudam. Se o usuário
  // está apenas navegando entre telas, o resultado já está
  // em memória — zero processamento extra.
  const filteredStudents = useMemo(() => {
    let result = allStudents;

    // Aplica busca textual (nome, CPF ou telefone)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      // Remove formatação do CPF para comparação limpa
      const termClean = term.replace(/\D/g, '');

      result = result.filter(student => {
        const matchNome = student.nome?.toLowerCase().includes(term);
        const matchCpf  = termClean && student.cpf?.replace(/\D/g, '').includes(termClean);
        const matchTel  = student.telefoneWhatsapp?.replace(/\D/g, '').includes(termClean);
        return matchNome || matchCpf || matchTel;
      });
    }

    // Aplica filtros adicionais (cada filtro é um campo exato)
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== 'todos') {
        result = result.filter(student => {
          const fieldValue = student[key as keyof Student];
          return fieldValue?.toString().toLowerCase() === value.toLowerCase();
        });
      }
    });

    // Ordena por nome alfabeticamente
    return result.sort((a, b) => a.nome?.localeCompare(b.nome || '') || 0);
  }, [allStudents, searchTerm, activeFilters]);

  // Define um filtro individual sem apagar os outros
  const setFilter = (key: string, value: string) => {
    setActiveFilters(prev => ({ ...prev, [key]: value }));
  };

  // Remove todos os filtros ativos
  const clearFilters = () => {
    setActiveFilters({});
    setSearchTerm('');
  };

  // Busca um aluno específico pelo CPF (para tela de detalhes)
  const findByCpf = (cpf: string): Student | undefined => {
    const cleanCpf = cpf.replace(/\D/g, '');
    return allStudents.find(s => s.cpf?.replace(/\D/g, '') === cleanCpf);
  };

  return {
    students: filteredStudents,
    totalCount: allStudents.length,
    filteredCount: filteredStudents.length,
    searchTerm,
    setSearchTerm,
    activeFilters,
    setFilter,
    clearFilters,
    isLoading,
    error,
    findByCpf,
  };
}