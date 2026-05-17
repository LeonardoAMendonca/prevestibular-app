'use client';

// ============================================================
//  ARQUIVO: src/app/presenca/page.tsx
//  Atualizado: modal de justificativa ao marcar falta justificada
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useStudents';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { postToGAS } from '@/lib/gasClient';
import { Student } from '@/contexts/AuthContext';
import Link from 'next/link';

type StatusPresenca = 'presente' | 'falta' | 'falta_justificada';

interface RegistroLocal {
  status: StatusPresenca;
  justificativa?: string;
}

const STATUS_CONFIG: Record<StatusPresenca, { label: string; bg: string; cor: string }> = {
  presente:         { label: '✓ Presente',    bg: 'bg-green-100 border-green-300',  cor: 'text-green-700'  },
  falta:            { label: '✗ Falta',       bg: 'bg-red-100 border-red-300',      cor: 'text-red-700'    },
  falta_justificada:{ label: '~ Justificada', bg: 'bg-yellow-100 border-yellow-300',cor: 'text-yellow-700' },
};

export default function PresencaPage() {
  const { currentUser, isLoading } = useAuth();
  const { students, searchTerm, setSearchTerm } = useStudents();
  const router = useRouter();

  const hoje = new Date().toISOString().split('T')[0];
  const [data, setData] = useState(hoje);
  const [registros, setRegistros] = useState<Record<string, RegistroLocal>>({});
  const [carregandoData, setCarregandoData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal de justificativa
  const [modalAluno, setModalAluno] = useState<Student | null>(null);
  const [textoJustificativa, setTextoJustificativa] = useState('');

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
    if (!isLoading && currentUser && currentUser.role === 'INSPETOR') router.replace('/dashboard');
  }, [isLoading, currentUser, router]);

  const carregarRegistrosDaData = useCallback(async (dataSelecionada: string) => {
    if (!currentUser) return;
    setCarregandoData(true);
    setRegistros({});
    setFeedback(null);
    try {
      const res = await postToGAS('GET_ATTENDANCE_BY_DATE', { data: dataSelecionada }, currentUser.email);
      const existentes: Record<string, RegistroLocal> = {};
      (res.registros ?? []).forEach((r: { cpf_aluno: string; status: StatusPresenca; justificativa?: string }) => {
        existentes[r.cpf_aluno] = { status: r.status, justificativa: r.justificativa || '' };
      });
      setRegistros(existentes);
      if (Object.keys(existentes).length > 0) {
        setFeedback({ type: 'success', message: `📋 ${Object.keys(existentes).length} registro(s) carregados para ${formatarData(dataSelecionada)}.` });
      }
    } catch { /* data sem registros — mantém vazio */ }
    finally { setCarregandoData(false); }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) carregarRegistrosDaData(data);
  }, [data, currentUser, carregarRegistrosDaData]);

  const alunosAtivos = useMemo(
    () => students.filter((s) => s.statusMatricula === 'ativo'),
    [students]
  );

  // Ao clicar num status:
  // - "falta_justificada" → abre modal para preencher justificativa
  // - outros → define direto
  function handleClickStatus(student: Student, status: StatusPresenca) {
    setFeedback(null);
    if (status === 'falta_justificada') {
      const justificativaExistente = registros[student.cpf]?.justificativa || '';
      setTextoJustificativa(justificativaExistente);
      setModalAluno(student);
    } else {
      setRegistros((prev) => ({ ...prev, [student.cpf]: { status } }));
    }
  }

  function confirmarJustificativa() {
    if (!modalAluno) return;
    if (!textoJustificativa.trim()) return; // Não deixa confirmar sem texto
    setRegistros((prev) => ({
      ...prev,
      [modalAluno.cpf]: { status: 'falta_justificada', justificativa: textoJustificativa.trim() },
    }));
    setModalAluno(null);
    setTextoJustificativa('');
  }

  function cancelarModal() {
    setModalAluno(null);
    setTextoJustificativa('');
  }

  function handleMarcarTodos(status: StatusPresenca) {
    if (status === 'falta_justificada') return; // Não faz sentido justificar todos em lote
    const novos: Record<string, RegistroLocal> = {};
    alunosAtivos.forEach((s) => { novos[s.cpf] = { status }; });
    setRegistros(novos);
    setFeedback(null);
  }

  const contadores = useMemo(() => {
    const vals = Object.values(registros);
    return {
      presente:          vals.filter((v) => v.status === 'presente').length,
      falta:             vals.filter((v) => v.status === 'falta').length,
      falta_justificada: vals.filter((v) => v.status === 'falta_justificada').length,
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
      const payload = marcados.map((s) => ({
        data,
        cpf_aluno:      s.cpf,
        status:         registros[s.cpf].status,
        justificativa:  registros[s.cpf].justificativa || '',
        registrado_por: currentUser.email,
      }));
      await postToGAS('ADD_ATTENDANCE', { registros: payload }, currentUser.email);
      setFeedback({ type: 'success', message: `✅ Presença de ${formatarData(data)} salva! ${marcados.length} aluno(s) registrado(s).` });
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar presença.' });
    } finally {
      setIsSaving(false);
    }
  }

  function formatarData(d: string): string {
    const [ano, mes, dia] = d.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  if (isLoading || !currentUser) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">← Dashboard</Link>
            <span className="text-gray-200">/</span>
            <h1 className="text-gray-800 font-semibold text-sm">Controle de Presença</h1>
          </div>
          <button
            onClick={handleSalvar}
            disabled={isSaving || carregandoData || Object.keys(registros).length === 0}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {isSaving ? 'Salvando...' : `Salvar (${Object.keys(registros).length})`}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {feedback && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            feedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {feedback.message}
          </div>
        )}

        {/* Seletor de data + contadores */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Data da Aula</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {carregandoData && <p className="text-xs text-blue-500 mt-1">Carregando registros...</p>}
            </div>
            <div className="flex flex-wrap gap-3 sm:ml-auto">
              {[
                { key: 'presente', label: 'Presentes', cor: 'bg-green-50 text-green-600' },
                { key: 'falta', label: 'Faltas', cor: 'bg-red-50 text-red-600' },
                { key: 'falta_justificada', label: 'Justificadas', cor: 'bg-yellow-50 text-yellow-600' },
                { key: 'naoMarcados', label: 'Não marcados', cor: 'bg-gray-50 text-gray-400' },
              ].map(({ key, label, cor }) => (
                <div key={key} className={`text-center px-4 py-2 rounded-lg ${cor}`}>
                  <p className="text-xl font-bold">{contadores[key as keyof typeof contadores]}</p>
                  <p className="text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Busca + ações em lote */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="text" placeholder="Buscar aluno por nome ou CPF..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <div className="flex gap-2">
            <button onClick={() => handleMarcarTodos('presente')} className="px-3 py-2 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 transition-colors whitespace-nowrap">✓ Todos presentes</button>
            <button onClick={() => handleMarcarTodos('falta')} className="px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors whitespace-nowrap">✗ Todos faltaram</button>
            <button onClick={() => carregarRegistrosDaData(data)} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">↺ Recarregar</button>
          </div>
        </div>

        {/* Lista de alunos */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {carregandoData ? (
            <div className="text-center py-16">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Carregando registros da data...</p>
            </div>
          ) : alunosAtivos.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">Nenhum aluno ativo encontrado.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {alunosAtivos.map((student) => {
                const registro = registros[student.cpf];
                const statusAtual = registro?.status;
                return (
                  <div key={student.cpf} className={`px-4 py-3 transition-colors ${
                    statusAtual === 'presente' ? 'bg-green-50' :
                    statusAtual === 'falta' ? 'bg-red-50' :
                    statusAtual === 'falta_justificada' ? 'bg-yellow-50' : 'hover:bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                        {student.nome?.charAt(0).toUpperCase()}
                      </div>
                      {/* Nome */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{student.nome}</p>
                        <p className="text-xs text-gray-400 font-mono">{student.cpf}</p>
                      </div>
                      {/* Botões de status */}
                      <div className="flex gap-2 flex-shrink-0">
                        {(Object.keys(STATUS_CONFIG) as StatusPresenca[]).map((s) => (
                          <button key={s} onClick={() => handleClickStatus(student, s)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              statusAtual === s
                                ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].cor} border-current font-semibold`
                                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                            }`}>
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Mostra justificativa salva abaixo do aluno */}
                    {statusAtual === 'falta_justificada' && registro?.justificativa && (
                      <div className="mt-2 ml-13 pl-13 flex items-start gap-2">
                        <div className="ml-[52px] bg-yellow-100 border border-yellow-200 rounded-lg px-3 py-2 flex-1 flex items-start justify-between gap-2">
                          <p className="text-xs text-yellow-800 italic">"{registro.justificativa}"</p>
                          <button
                            onClick={() => handleClickStatus(student, 'falta_justificada')}
                            className="text-yellow-600 hover:text-yellow-800 text-xs underline whitespace-nowrap flex-shrink-0"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Botão salvar rodapé */}
        <div className="mt-6 flex justify-end">
          <button onClick={handleSalvar}
            disabled={isSaving || carregandoData || Object.keys(registros).length === 0}
            className="px-8 py-3 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
            {isSaving ? 'Salvando...' : `Salvar Presença de ${Object.keys(registros).length} aluno(s)`}
          </button>
        </div>
      </div>

      {/* Modal de justificativa */}
      {modalAluno && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-yellow-600 text-xl">📝</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-1">Falta Justificada</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Informe o motivo da ausência de <span className="font-semibold text-gray-700">{modalAluno.nome}</span>
            </p>

            <textarea
              autoFocus
              value={textoJustificativa}
              onChange={(e) => setTextoJustificativa(e.target.value)}
              placeholder="Ex: Atestado médico, problema familiar, viagem..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none mb-2"
            />
            <p className="text-xs text-gray-400 mb-6">
              {textoJustificativa.trim().length}/500 caracteres
              {!textoJustificativa.trim() && <span className="text-red-400 ml-2">A justificativa é obrigatória.</span>}
            </p>

            <div className="flex gap-3">
              <button onClick={cancelarModal}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmarJustificativa}
                disabled={!textoJustificativa.trim()}
                className="flex-1 px-4 py-2.5 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-40 transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}