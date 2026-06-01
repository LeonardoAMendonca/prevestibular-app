'use client';

// ============================================================
//  ARQUIVO: src/app/presenca/page.tsx
//  Atualizado: Filtro dinâmico por Linha do Tempo (Inscrição e Inativação)
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

interface Observacao {
  timestamp: string;
  observacao: string;
  registrado_por: string;
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
  const [modalJustAluno, setModalJustAluno] = useState<Student | null>(null);
  const [textoJust, setTextoJust] = useState('');

  // Painel de observações
  const [obsAluno, setObsAluno] = useState<Student | null>(null);
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [novaObs, setNovaObs] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
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
    } catch { /* data sem registros */ }
    finally { setCarregandoData(false); }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) carregarRegistrosDaData(data);
  }, [data, currentUser, carregarRegistrosDaData]);

  // Carrega observações do aluno ao abrir o painel
  async function abrirObservacoes(student: Student) {
    if (!currentUser) return;
    setObsAluno(student);
    setObservacoes([]);
    setNovaObs('');
    setLoadingObs(true);
    try {
      const res = await postToGAS('GET_OBSERVATIONS', { cpf: student.cpf }, currentUser.email);
      setObservacoes(res.observacoes ?? []);
    } catch { setObservacoes([]); }
    finally { setLoadingObs(false); }
  }

  async function salvarObservacao() {
    if (!obsAluno || !currentUser || !novaObs.trim()) return;
    setSalvandoObs(true);
    try {
      await postToGAS('ADD_OBSERVATION', {
        cpf: obsAluno.cpf,
        observacao: novaObs.trim(),
        registrado_por: currentUser.email,
      }, currentUser.email);
      // Recarrega observações
      const res = await postToGAS('GET_OBSERVATIONS', { cpf: obsAluno.cpf }, currentUser.email);
      setObservacoes(res.observacoes ?? []);
      setNovaObs('');
    } catch { /* erro silencioso */ }
    finally { setSalvandoObs(false); }
  }

  // ── FILTRO DINÂMICO DE LINHA DO TEMPO (Inscrição e Inativação) ──
  const alunosAtivos = useMemo(() => {
    return students.filter(s => {
      // SALVAGUARDA HISTÓRICA: Se já existe chamada salva para esse aluno neste dia,
      // ele DEVE aparecer na lista, independente das regras de datas do cadastro.
      const temPresencaSalva = !!registros[s.cpf];
      if (temPresencaSalva) return true;

      // Se o aluno não tiver data de inscrição cadastrada, não exibe por segurança
      if (!s.dataInscricao) return false;

      // 1. O aluno já havia se inscrito até a data selecionada?
      const jaEstavaInscrito = s.dataInscricao <= data;

      // 2. O aluno ainda continuava ativo na data selecionada?
      // Se o status atual for 'ativo', ele está elegível.
      // Se estiver 'inativo' hoje, ele só aparece se a data selecionada for menor ou igual à data de inativação.
      const dataInativacao = (s as any).dataInativacao;
      const aindaEstavaAtivo = s.statusMatricula === 'ativo' || (dataInativacao ? data <= dataInativacao : false);

      return jaEstavaInscrito && aindaEstavaAtivo;
    });
  }, [students, data, registros]); // 'registros' e 'data' adicionados para recalcular com as mudanças de estado

  function handleClickStatus(student: Student, status: StatusPresenca) {
    setFeedback(null);
    if (status === 'falta_justificada') {
      setTextoJust(registros[student.cpf]?.justificativa || '');
      setModalJustAluno(student);
    } else {
      setRegistros(prev => ({ ...prev, [student.cpf]: { status } }));
    }
  }

  function confirmarJust() {
    if (!modalJustAluno || !textoJust.trim()) return;
    setRegistros(prev => ({ ...prev, [modalJustAluno.cpf]: { status: 'falta_justificada', justificativa: textoJust.trim() } }));
    setModalJustAluno(null);
    setTextoJust('');
  }

  function handleMarcarTodos(status: StatusPresenca) {
    if (status === 'falta_justificada') return;
    const novos: Record<string, RegistroLocal> = { ...registros };
    alunosAtivos.forEach(s => { novos[s.cpf] = { status }; });
    setRegistros(novos);
    setFeedback(null);
  }

  const contadores = useMemo(() => {
    const vals = Object.values(registros);
    return {
      presente: vals.filter(v => v.status === 'presente').length,
      falta: vals.filter(v => v.status === 'falta').length,
      falta_justificada: vals.filter(v => v.status === 'falta_justificada').length,
      naoMarcados: Math.max(0, alunosAtivos.length - vals.length),
    };
  }, [registros, alunosAtivos]);

  async function handleSalvar() {
    if (!currentUser) return;
    const marcados = alunosAtivos.filter(s => registros[s.cpf]);
    if (marcados.length === 0) { setFeedback({ type: 'error', message: 'Marque ao menos um aluno.' }); return; }
    setIsSaving(true); setFeedback(null);
    try {
      const payload = marcados.map(s => ({
        data, cpf_aluno: s.cpf, status: registros[s.cpf].status,
        justificativa: registros[s.cpf].justificativa || '', registrado_por: currentUser.email,
      }));
      await postToGAS('ADD_ATTENDANCE', { registros: payload }, currentUser.email);
      setFeedback({ type: 'success', message: `✅ Presença de ${formatarData(data)} salva! ${marcados.length} aluno(s).` });
      await carregarRegistrosDaData(data);
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar.' });
    } finally { setIsSaving(false); }
  }

  function formatarData(d: string) {
    const [a, m, dia] = d.split('-');
    return `${dia}/${m}/${a}`;
  }

  function formatarTimestamp(ts: string) {
    try {
      return new Date(ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch { return ts; }
  }

  if (isLoading || !currentUser) return (
    <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
            <span className="text-gray-200">/</span>
            <h1 className="text-gray-800 font-semibold text-sm">Presença</h1>
          </div>
          <button onClick={handleSalvar} disabled={isSaving || carregandoData || Object.keys(registros).length === 0}
            className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors">
            {isSaving ? 'Salvando...' : `Salvar (${Object.keys(registros).length})`}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {feedback && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium border ${
            feedback.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
          }`}>{feedback.message}</div>
        )}

        {/* Data + contadores */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Data da Aula</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {carregandoData && <p className="text-xs text-blue-500 mt-1">Carregando...</p>}
            </div>
            <div className="flex flex-wrap gap-3 sm:ml-auto">
              {[
                { k: 'presente', l: 'Presentes', c: 'bg-green-50 text-green-600' },
                { k: 'falta', l: 'Faltas', c: 'bg-red-50 text-red-600' },
                { k: 'falta_justificada', l: 'Justificadas', c: 'bg-yellow-50 text-yellow-600' },
                { k: 'naoMarcados', l: 'Não marcados', c: 'bg-gray-50 text-gray-400' },
              ].map(({ k, l, c }) => (
                <div key={k} className={`text-center px-4 py-2 rounded-lg ${c}`}>
                  <p className="text-xl font-bold">{contadores[k as keyof typeof contadores]}</p>
                  <p className="text-xs">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Busca + ações em lote */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input type="text" placeholder="Buscar aluno por nome ou CPF..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <div className="flex gap-2">
            <button onClick={() => handleMarcarTodos('presente')} className="px-3 py-2 text-xs font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200">✓ Todos presentes</button>
            <button onClick={() => handleMarcarTodos('falta')} className="px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200">✗ Todos faltaram</button>
            <button onClick={() => carregarRegistrosDaData(data)} className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">↺</button>
          </div>
        </div>

        {/* Lista de alunos */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {carregandoData ? (
            <div className="text-center py-16"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-gray-400 text-sm">Carregando...</p></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {alunosAtivos.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm italic">
                  Nenhum aluno ativo matriculado nesta data ou correspondente à busca.
                </div>
              ) : (
                alunosAtivos.map(student => {
                  const registro = registros[student.cpf];
                  const statusAtual = registro?.status;
                  return (
                    <div key={student.cpf} className={`px-4 py-3 transition-colors ${
                      statusAtual === 'presente' ? 'bg-green-50' : statusAtual === 'falta' ? 'bg-red-50' :
                      statusAtual === 'falta_justificada' ? 'bg-yellow-50' : 'hover:bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-bold text-sm flex items-center justify-center flex-shrink-0">
                          {student.nome?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{student.nome}</p>
                          <p className="text-xs text-gray-400 font-mono">{student.cpf}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Botão observações */}
                          <button onClick={() => abrirObservacoes(student)}
                            className="px-2 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
                            title="Ver/adicionar observações">
                            📝 Obs.
                          </button>
                          {/* Botões de status */}
                          {(Object.keys(STATUS_CONFIG) as StatusPresenca[]).map(s => (
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
                      {statusAtual === 'falta_justificada' && registro?.justificativa && (
                        <div className="mt-2 ml-12 flex items-start gap-2">
                          <div className="bg-yellow-100 border border-yellow-200 rounded-lg px-3 py-2 flex-1 flex items-start justify-between gap-2">
                            <p className="text-xs text-yellow-800 italic">"{registro.justificativa}"</p>
                            <button onClick={() => handleClickStatus(student, 'falta_justificada')}
                              className="text-yellow-600 hover:text-yellow-800 text-xs underline whitespace-nowrap">Editar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={handleSalvar} disabled={isSaving || carregandoData || Object.keys(registros).length === 0}
            className="px-8 py-3 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-40 transition-colors">
            {isSaving ? 'Salvando...' : `Salvar Presença de ${Object.keys(registros).length} aluno(s)`}
          </button>
        </div>
      </div>

      {/* Modal justificativa */}
      {modalJustAluno && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-xl">📝</span></div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-1">Falta Justificada</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Motivo da ausência de <span className="font-semibold text-gray-700">{modalJustAluno.nome}</span></p>
            <textarea autoFocus value={textoJust} onChange={e => setTextoJust(e.target.value)}
              placeholder="Ex: Atestado médico, problema familiar..." rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none mb-2" />
            {!textoJust.trim() && <p className="text-xs text-red-400 mb-4">A justificativa é obrigatória.</p>}
            <div className="flex gap-3">
              <button onClick={() => { setModalJustAluno(null); setTextoJust(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarJust} disabled={!textoJust.trim()}
                className="flex-1 px-4 py-2.5 bg-yellow-500 text-white text-sm font-medium rounded-lg hover:bg-yellow-600 disabled:opacity-40">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Painel lateral de observações */}
      {obsAluno && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Observações</h3>
                <p className="text-sm text-gray-400">{obsAluno.nome}</p>
              </div>
              <button onClick={() => setObsAluno(null)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>

            {/* Lista de observações */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingObs ? (
                <div className="text-center py-8"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-gray-400 text-sm">Carregando...</p></div>
              ) : observacoes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-4xl mb-2">📋</p>
                  <p className="text-gray-400 text-sm">Nenhuma observação registrada.</p>
                  <p className="text-gray-300 text-xs mt-1">Use o campo abaixo para adicionar.</p>
                </div>
              ) : (
                [...observacoes].reverse().map((obs, i) => (
                  <div key={i} className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                    <p className="text-sm text-gray-800 leading-relaxed">{obs.observacao}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-purple-400">{formatarTimestamp(obs.timestamp)}</p>
                      <span className="text-purple-200">•</span>
                      <p className="text-xs text-purple-400">{obs.registrado_por}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Campo nova observação */}
            <div className="p-4 border-t border-gray-100">
              <textarea value={novaObs} onChange={e => setNovaObs(e.target.value)}
                placeholder="Digite uma observação (ex: aluno foi à enfermaria, chegou atrasado, saiu mais cedo...)"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-3" />
              <button onClick={salvarObservacao} disabled={salvandoObs || !novaObs.trim()}
                className="w-full py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors">
                {salvandoObs ? 'Salvando...' : '+ Salvar Observação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}