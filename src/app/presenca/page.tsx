'use client';

// ============================================================
//  ARQUIVO: src/app/presenca/page.tsx
//  Rota: /presenca
//  Acesso: ADMIN, COORDENAÇÃO e MONITOR
//  Permite registrar presença de múltiplos alunos de uma vez
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useStudents';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { postToGAS } from '@/lib/gasClient';
import Link from 'next/link';

type StatusPresenca = 'presente' | 'falta' | 'falta_justificada';

interface RegistroAluno {
  cpf: string;
  nome: string;
  status: StatusPresenca;
}

const STATUS_CONFIG: Record<StatusPresenca, { label: string; cor: string; bg: string }> = {
  presente:         { label: 'Presente',         cor: 'text-green-700',  bg: 'bg-green-100 border-green-300' },
  falta:            { label: 'Falta',            cor: 'text-red-700',    bg: 'bg-red-100 border-red-300' },
  falta_justificada:{ label: 'Falta Justificada',cor: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' },
};

export default function PresencaPage() {
  const { currentUser, isLoading, can } = useAuth();
  const { students, searchTerm, setSearchTerm } = useStudents();
  const router = useRouter();

  // Data de hoje no formato YYYY-MM-DD
  const hoje = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(hoje);
  const [registros, setRegistros] = useState<Record<string, StatusPresenca>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [marcarTodos, setMarcarTodos] = useState<StatusPresenca | null>(null);

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
    // INSPETOR não pode registrar presença
    if (!isLoading && currentUser && currentUser.role === 'INSPETOR') {
      router.replace('/dashboard');
    }
  }, [isLoading, currentUser, router]);

  // Filtra apenas alunos ativos (não faz sentido registrar presença de inativos)
  const alunosAtivos = useMemo(
    () => students.filter((s) => s.statusMatricula === 'ativo'),
    [students]
  );

  function setStatus(cpf: string, status: StatusPresenca) {
    setRegistros((prev) => ({ ...prev, [cpf]: status }));
    setFeedback(null);
  }

  function handleMarcarTodos(status: StatusPresenca) {
    const novos: Record<string, StatusPresenca> = {};
    alunosAtivos.forEach((s) => { novos[s.cpf] = status; });
    setRegistros(novos);
    setMarcarTodos(status);
    setFeedback(null);
  }

  // Contadores para o resumo
  const contadores = useMemo(() => {
    const vals = Object.values(registros);
    return {
      presente:          vals.filter((v) => v === 'presente').length,
      falta:             vals.filter((v) => v === 'falta').length,
      falta_justificada: vals.filter((v) => v === 'falta_justificada').length,
      naoMarcados:       alunosAtivos.length - vals.length,
    };
  }, [registros, alunosAtivos]);

  async function handleSalvar() {
    if (!currentUser) return;

    const marcados = alunosAtivos.filter((s) => registros[s.cpf]);
    if (marcados.length === 0) {
      setFeedback({ type: 'error', message: 'Marque a presença de pelo menos um aluno antes de salvar.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      // Envia todos os registros de uma vez
      const payload = marcados.map((s) => ({
        data,
        cpf_aluno:      s.cpf,
        status:         registros[s.cpf],
        registrado_por: currentUser.email,
      }));

      await postToGAS('ADD_ATTENDANCE', { registros: payload }, currentUser.email);

      setFeedback({
        type: 'success',
        message: `✅ Presença salva com sucesso! ${marcados.length} aluno(s) registrado(s) para ${formatarData(data)}.`,
      });
      // Limpa os registros após salvar
      setRegistros({});
      setMarcarTodos(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar presença.',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function formatarData(d: string): string {
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
  }

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
            <h1 className="text-gray-800 font-semibold text-sm">Controle de Presença</h1>
          </div>
          <button
            onClick={handleSalvar}
            disabled={isSaving || Object.keys(registros).length === 0}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? 'Salvando...' : `Salvar Presença (${Object.keys(registros).length})`}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Feedback */}
        {feedback && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {feedback.message}
          </div>
        )}

        {/* Seletor de data + resumo */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                Data da Aula
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => { setData(e.target.value); setRegistros({}); setMarcarTodos(null); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Resumo dos marcados */}
            <div className="flex flex-wrap gap-3 sm:ml-auto">
              <div className="text-center px-4 py-2 bg-green-50 rounded-lg">
                <p className="text-xl font-bold text-green-600">{contadores.presente}</p>
                <p className="text-xs text-green-600">Presentes</p>
              </div>
              <div className="text-center px-4 py-2 bg-red-50 rounded-lg">
                <p className="text-xl font-bold text-red-600">{contadores.falta}</p>
                <p className="text-xs text-red-600">Faltas</p>
              </div>
              <div className="text-center px-4 py-2 bg-yellow-50 rounded-lg">
                <p className="text-xl font-bold text-yellow-600">{contadores.falta_justificada}</p>
                <p className="text-xs text-yellow-600">Justificadas</p>
              </div>
              <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                <p className="text-xl font-bold text-gray-400">{contadores.naoMarcados}</p>
                <p className="text-xs text-gray-400">Não marcados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ações em lote + busca */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar aluno por nome ou CPF..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleMarcarTodos('presente')}
              className="px-3 py-2 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap"
            >
              ✓ Todos presentes
            </button>
            <button
              onClick={() => handleMarcarTodos('falta')}
              className="px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors whitespace-nowrap"
            >
              ✗ Todos faltaram
            </button>
            <button
              onClick={() => { setRegistros({}); setMarcarTodos(null); }}
              className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Lista de alunos */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {alunosAtivos.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">
              Nenhum aluno ativo encontrado.
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {alunosAtivos.map((student) => {
                const statusAtual = registros[student.cpf];
                return (
                  <div
                    key={student.cpf}
                    className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                      statusAtual === 'presente'          ? 'bg-green-50'  :
                      statusAtual === 'falta'             ? 'bg-red-50'    :
                      statusAtual === 'falta_justificada' ? 'bg-yellow-50' :
                      'hover:bg-gray-50'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                      {student.nome?.charAt(0).toUpperCase()}
                    </div>

                    {/* Nome e CPF */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{student.nome}</p>
                      <p className="text-xs text-gray-400 font-mono">{student.cpf}</p>
                    </div>

                    {/* Botões de status */}
                    <div className="flex gap-2 flex-shrink-0">
                      {(Object.keys(STATUS_CONFIG) as StatusPresenca[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setStatus(student.cpf, s)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            statusAtual === s
                              ? STATUS_CONFIG[s].bg + ' ' + STATUS_CONFIG[s].cor + ' border-current font-semibold'
                              : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                          }`}
                        >
                          {s === 'presente' ? '✓ Presente' : s === 'falta' ? '✗ Falta' : '~ Justificada'}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Botão salvar (duplicado no rodapé para facilitar) */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSalvar}
            disabled={isSaving || Object.keys(registros).length === 0}
            className="px-8 py-3 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? 'Salvando...' : `Salvar Presença de ${Object.keys(registros).length} aluno(s)`}
          </button>
        </div>
      </div>
    </main>
  );
}