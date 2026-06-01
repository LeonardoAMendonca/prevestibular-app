'use client';

// ============================================================
//  ARQUIVO: src/app/alunos/[cpf]/page.tsx
//  Abas: Dados Cadastrais | Presença | Observações | Documentos
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import StudentForm from '@/components/StudentForm';
import { Student } from '@/contexts/AuthContext';
import { postToGAS } from '@/lib/gasClient';
import { resizeAndEncodeImage } from '@/lib/imageUtils';
import Link from 'next/link';

type Aba = 'dados' | 'presenca' | 'observacoes' | 'documentos';

interface RegistroPresenca { data: string; status: string; justificativa?: string; registrado_por: string; }
interface Observacao { timestamp: string; observacao: string; registrado_por: string; }
interface Documento {
  timestamp: string; tipo_documento: string; nome_arquivo: string;
  url: string; tamanho: string; registrado_por: string; doc_id: string;
}

const TIPOS_DOCUMENTO = [
  'RG (Identidade)', 'CPF', 'Certidão de Nascimento', 'Comprovante de Residência',
  'Histórico Escolar', 'Declaração de Matrícula', 'Comprovante de Renda',
  'Comprovante Bancário', 'Foto 3x4', 'Termo de Consentimento (menor)', 'Laudo Médico', 'Outros',
];

const TIPO_ICON: Record<string, string> = {
  'RG (Identidade)': '🪪', 'CPF': '🪪', 'Certidão de Nascimento': '📜',
  'Comprovante de Residência': '🏠', 'Histórico Escolar': '📚',
  'Declaração de Matrícula': '📋', 'Comprovante de Renda': '💰',
  'Comprovante Bancário': '🏦', 'Foto 3x4': '📷',
  'Termo de Consentimento (menor)': '✍️', 'Laudo Médico': '🏥', 'Outros': '📄',
};

const STATUS_PRESENCA: Record<string, { label: string; cor: string }> = {
  presente: { label: 'Presente', cor: 'bg-green-100 text-green-700' },
  falta: { label: 'Falta', cor: 'bg-red-100 text-red-700' },
  falta_justificada: { label: 'Falta Justificada', cor: 'bg-yellow-100 text-yellow-700' },
};

export default function AlunoDetailPage() {
  const { currentUser, isLoading, students, can, refreshData } = useAuth();
  const router = useRouter();
  const params = useParams();
  const cpfParam = decodeURIComponent(params.cpf as string);

  const [student, setStudent] = useState<Student | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dados');
  const [isEditing, setIsEditing] = useState(false);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Presença
  const [presencas, setPresencas] = useState<RegistroPresenca[]>([]);
  const [loadingPresenca, setLoadingPresenca] = useState(false);

  // Observações
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [novaObs, setNovaObs] = useState('');
  const [salvandoObs, setSalvandoObs] = useState(false);

  // Documentos
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState('');
  const [docFeedback, setDocFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletandoDoc, setDeletandoDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
  }, [isLoading, currentUser, router]);

  useEffect(() => {
    if (students.length > 0 && cpfParam) {
      const clean = cpfParam.replace(/\D/g, '');
      setStudent(students.find(s => s.cpf.replace(/\D/g, '') === clean) ?? null);
    }
  }, [students, cpfParam]);

  // Carrega presença
  useEffect(() => {
    if (abaAtiva === 'presenca' && student && currentUser) {
      setLoadingPresenca(true);
      postToGAS('GET_ATTENDANCE', { cpf: student.cpf }, currentUser.email)
        .then(r => setPresencas(r.registros ?? [])).catch(() => setPresencas([])).finally(() => setLoadingPresenca(false));
    }
  }, [abaAtiva, student, currentUser]);

  // Carrega observações
  useEffect(() => {
    if (abaAtiva === 'observacoes' && student && currentUser) {
      setLoadingObs(true);
      postToGAS('GET_OBSERVATIONS', { cpf: student.cpf }, currentUser.email)
        .then(r => setObservacoes(r.observacoes ?? [])).catch(() => setObservacoes([])).finally(() => setLoadingObs(false));
    }
  }, [abaAtiva, student, currentUser]);

  // Carrega documentos
  useEffect(() => {
    if (abaAtiva === 'documentos' && student && currentUser) {
      carregarDocumentos();
    }
  }, [abaAtiva, student, currentUser]);

  async function carregarDocumentos() {
    if (!student || !currentUser) return;
    setLoadingDocs(true);
    try {
      const r = await postToGAS('GET_DOCUMENTS', { cpf: student.cpf }, currentUser.email);
      setDocumentos(r.documentos ?? []);
    } catch { setDocumentos([]); }
    finally { setLoadingDocs(false); }
  }

  async function handleDocumentoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !student) return;
    if (!tipoSelecionado) { setDocFeedback({ type: 'error', message: 'Selecione o tipo de documento antes de enviar.' }); e.target.value = ''; return; }
    if (file.size > 10 * 1024 * 1024) { setDocFeedback({ type: 'error', message: 'Arquivo muito grande. Máximo: 10MB.' }); e.target.value = ''; return; }

    setUploadingDoc(true);
    setDocFeedback(null);
    try {
      let base64: string;
      let mimeType: string;
      let filename: string;

      if (file.type.startsWith('image/')) {
        // Imagens: redimensiona para economizar espaço no Drive
        const result = await resizeAndEncodeImage(file, { maxWidth: 1200, maxHeight: 1600, quality: 0.88 });
        base64 = result.base64;
        mimeType = result.mimeType;
        filename = `${student.cpf.replace(/\D/g, '')}_${tipoSelecionado.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
      } else {
        // PDFs: envia como está
        base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
        mimeType = file.type;
        filename = `${student.cpf.replace(/\D/g, '')}_${tipoSelecionado.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
      }

      await postToGAS('UPLOAD_DOCUMENT', {
        base64, mimeType, filename,
        cpf: student.cpf,
        tipo_documento: tipoSelecionado,
        nome_original: file.name,
        tamanho: Math.round(file.size / 1024) + ' KB',
      }, currentUser.email);

      setDocFeedback({ type: 'success', message: `Documento "${tipoSelecionado}" enviado com sucesso!` });
      setTipoSelecionado('');
      await carregarDocumentos();
    } catch (err) {
      setDocFeedback({ type: 'error', message: 'Erro ao enviar: ' + (err instanceof Error ? err.message : 'Tente novamente.') });
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  }

  async function handleDeletarDocumento(doc: Documento) {
    if (!currentUser || !can('EDITAR_ALUNOS')) return;
    setDeletandoDoc(doc.doc_id);
    try {
      await postToGAS('DELETE_DOCUMENT', { doc_id: doc.doc_id, cpf: student!.cpf }, currentUser.email);
      await carregarDocumentos();
    } catch { /* silencioso */ }
    finally { setDeletandoDoc(null); }
  }

  async function salvarObservacao() {
    if (!student || !currentUser || !novaObs.trim()) return;
    setSalvandoObs(true);
    try {
      await postToGAS('ADD_OBSERVATION', { cpf: student.cpf, observacao: novaObs.trim(), registrado_por: currentUser.email }, currentUser.email);
      const r = await postToGAS('GET_OBSERVATIONS', { cpf: student.cpf }, currentUser.email);
      setObservacoes(r.observacoes ?? []);
      setNovaObs('');
    } catch { } finally { setSalvandoObs(false); }
  }

  async function handleDelete() {
    if (!student || !currentUser) return;
    setIsDeleting(true); setDeleteError(null);
    try { await postToGAS('DELETE_STUDENT', { cpf: student.cpf }, currentUser.email); await refreshData(); router.push('/dashboard'); }
    catch (err) { setDeleteError(err instanceof Error ? err.message : 'Erro.'); setIsDeleting(false); }
  }

  function calcularIdade(dn: string) {
    if (!dn) return '—';
    const hoje = new Date(), nasc = new Date(dn);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return `${idade} anos`;
  }

  function formatarData(d: string) {
    if (!d) return '—';
    const [a, m, dia] = d.split('-');
    return dia && m && a ? `${dia}/${m}/${a}` : d;
  }

  function formatarTimestamp(ts: string) {
    try { return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return ts; }
  }

  function calcularFreq(r: RegistroPresenca[]) {
    if (!r.length) return null;
    return Math.round((r.filter(x => x.status === 'presente').length / r.length) * 100);
  }

  if (isLoading || !currentUser) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>;
  if (!student) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500">Aluno não encontrado.</p>
      <Link href="/dashboard" className="text-blue-600 text-sm underline">← Dashboard</Link>
    </div>
  );

  const freq = calcularFreq(presencas);

  const abas: { id: Aba; label: string }[] = [
    { id: 'dados', label: 'Dados Cadastrais' },
    { id: 'presenca', label: `Presença${freq !== null ? ` (${freq}%)` : ''}` },
    { id: 'observacoes', label: `Observações${observacoes.length > 0 ? ` (${observacoes.length})` : ''}` },
    { id: 'documentos', label: `Documentos${documentos.length > 0 ? ` (${documentos.length})` : ''}` },
  ];

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
            <span className="text-gray-200">/</span>
            <span className="text-gray-800 font-semibold text-sm">{student.nome}</span>
          </div>
          <div className="flex items-center gap-2">
            {can('EDITAR_ALUNOS') && !isEditing && abaAtiva === 'dados' && (
              <>
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Editar</button>
                <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 border border-red-200">Deletar</button>
              </>
            )}
            {isEditing && <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-500 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar Edição</button>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Card resumo */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex items-start gap-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-100 flex-shrink-0 bg-blue-100 flex items-center justify-center">
            {student.fotoUrl ? <img src={student.fotoUrl} alt={student.nome} className="w-full h-full object-cover" /> : <span className="text-blue-600 text-2xl font-bold">{student.nome?.charAt(0)}</span>}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">{student.nome}</h2>
            <p className="text-gray-400 text-sm mt-0.5">CPF: {student.cpf}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span>🎂 {calcularIdade(student.dataNascimento)}</span>
              <span>📱 {student.telefoneWhatsapp || '—'}</span>
              <span>📍 {student.bairro ? `${student.bairro}, ${student.cidade}` : '—'}</span>
              {freq !== null && <span className={`font-semibold ${freq >= 75 ? 'text-green-600' : freq >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>📊 {freq}% frequência</span>}
              {documentos.length > 0 && <span className="text-indigo-600 font-medium">📁 {documentos.length} documento(s)</span>}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${student.statusMatricula === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {student.statusMatricula || 'indefinido'}
          </span>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm p-1 flex-wrap">
          {abas.map(aba => (
            <button key={aba.id} onClick={() => { setAbaAtiva(aba.id); if (aba.id !== 'dados') setIsEditing(false); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${abaAtiva === aba.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {aba.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">

          {/* ── Dados Cadastrais ── */}
          {abaAtiva === 'dados' && (
            isEditing
              ? <><div className="mb-8"><h3 className="text-lg font-bold text-gray-800">Editando: {student.nome}</h3><p className="text-sm text-gray-400 mt-1">O CPF não pode ser alterado.</p></div><StudentForm mode="edit" initialData={student} /></>
              : <ReadOnlyView student={student} />
          )}

          {/* ── Presença ── */}
          {abaAtiva === 'presenca' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-800">Histórico de Presença</h3>
                <div className="flex items-center gap-3">
                  {freq !== null && <span className={`px-4 py-2 rounded-lg text-sm font-semibold ${freq >= 75 ? 'bg-green-100 text-green-700' : freq >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{freq}% {freq < 75 && '⚠️'}</span>}
                  <Link href="/presenca" className="px-3 py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">+ Registrar</Link>
                </div>
              </div>
              {loadingPresenca ? <Loader /> : presencas.length === 0 ? <Empty text="Nenhum registro de presença." link="/presenca" linkText="Registrar presença →" /> : (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {(['presente', 'falta', 'falta_justificada'] as const).map(s => (
                      <div key={s} className={`rounded-lg p-4 text-center ${s === 'presente' ? 'bg-green-50' : s === 'falta' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                        <p className="text-2xl font-bold">{presencas.filter(r => r.status === s).length}</p>
                        <p className="text-xs mt-1 text-gray-600">{STATUS_PRESENCA[s].label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Data</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Justificativa</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...presencas].sort((a, b) => b.data.localeCompare(a.data)).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{formatarData(r.data)}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_PRESENCA[r.status]?.cor ?? 'bg-gray-100 text-gray-500'}`}>{STATUS_PRESENCA[r.status]?.label ?? r.status}</span></td>
                            <td className="px-4 py-3 text-xs">{r.justificativa ? <span className="italic text-yellow-700">"{r.justificativa}"</span> : <span className="text-gray-300">—</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Observações ── */}
          {abaAtiva === 'observacoes' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-800">Observações Permanentes</h3>
                <span className="text-xs text-gray-400">Visível para toda a equipe</span>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 mb-6">
                <label className="text-xs font-semibold text-purple-600 uppercase tracking-wide block mb-2">Nova Observação</label>
                <textarea value={novaObs} onChange={e => setNovaObs(e.target.value)}
                  placeholder="Ex: Aluno foi à enfermaria em 10/05. Chegou atrasado por consulta médica..."
                  rows={3} className="w-full border border-purple-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none bg-white mb-3" />
                <button onClick={salvarObservacao} disabled={salvandoObs || !novaObs.trim()}
                  className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-40">
                  {salvandoObs ? 'Salvando...' : '+ Salvar Observação'}
                </button>
              </div>
              {loadingObs ? <Loader /> : observacoes.length === 0 ? <Empty text="Nenhuma observação registrada ainda." /> : (
                <div className="space-y-3">
                  {[...observacoes].reverse().map((obs, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                      <p className="text-sm text-gray-800 leading-relaxed">{obs.observacao}</p>
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
                        <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">{obs.registrado_por?.charAt(0)?.toUpperCase()}</div>
                        <p className="text-xs text-gray-400">{obs.registrado_por}</p>
                        <span className="text-gray-200">•</span>
                        <p className="text-xs text-gray-400">{formatarTimestamp(obs.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Documentos ── */}
          {abaAtiva === 'documentos' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-800">Documentos do Aluno</h3>
                <span className="text-xs text-gray-400">{documentos.length} documento(s) armazenado(s)</span>
              </div>

              {/* Upload */}
              {can('EDITAR_ALUNOS') && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-6">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">Adicionar Documento</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select value={tipoSelecionado} onChange={e => { setTipoSelecionado(e.target.value); setDocFeedback(null); }}
                      className="flex-1 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      <option value="">1. Selecione o tipo de documento...</option>
                      {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{TIPO_ICON[t] || '📄'} {t}</option>)}
                    </select>
                    <label className={`cursor-pointer inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl border-2 border-dashed transition-colors whitespace-nowrap ${uploadingDoc ? 'border-indigo-200 text-indigo-400 bg-white opacity-60' :
                        !tipoSelecionado ? 'border-gray-200 text-gray-300 cursor-not-allowed' :
                          'border-indigo-400 text-indigo-600 hover:bg-indigo-100'
                      }`}>
                      {uploadingDoc ? <><div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Enviando...</> : <>📎 2. Escolher arquivo</>}
                      <input ref={fileInputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={handleDocumentoUpload} className="hidden" disabled={uploadingDoc || !tipoSelecionado} />
                    </label>
                  </div>
                  <p className="text-xs text-indigo-400 mt-2">Aceita PDF, JPG, PNG · Máx. 10MB · Salvo no Google Drive</p>
                  {docFeedback && (
                    <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium ${docFeedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {docFeedback.message}
                    </div>
                  )}
                </div>
              )}

              {/* Lista de documentos */}
              {loadingDocs ? <Loader /> : documentos.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-5xl mb-3">📁</p>
                  <p className="text-gray-400 text-sm">Nenhum documento armazenado ainda.</p>
                  {can('EDITAR_ALUNOS') && <p className="text-gray-300 text-xs mt-1">Use o painel acima para enviar documentos escaneados.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Agrupa por tipo */}
                  {TIPOS_DOCUMENTO.filter(tipo => documentos.some(d => d.tipo_documento === tipo)).map(tipo => (
                    <div key={tipo} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2">
                        <span className="text-base">{TIPO_ICON[tipo] || '📄'}</span>
                        <span className="text-sm font-semibold text-gray-700">{tipo}</span>
                        <span className="text-xs text-gray-400 ml-auto">{documentos.filter(d => d.tipo_documento === tipo).length} arquivo(s)</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {documentos.filter(d => d.tipo_documento === tipo).map((doc, i) => (
                          <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{doc.nome_arquivo}</p>
                              <p className="text-xs text-gray-400">{doc.tamanho} · {formatarTimestamp(doc.timestamp)} · por {doc.registrado_por}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200">
                                ↗ Abrir
                              </a>
                              {can('EDITAR_ALUNOS') && (
                                <button onClick={() => handleDeletarDocumento(doc)} disabled={deletandoDoc === doc.doc_id}
                                  className="px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-40">
                                  {deletandoDoc === doc.doc_id ? '...' : '🗑'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal delete aluno */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-red-600 text-xl">⚠️</span></div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Deletar aluno?</h3>
            <p className="text-gray-500 text-sm text-center mb-6">{student.nome} — CPF {student.cpf}</p>
            <p className="text-red-600 text-xs text-center mb-6 bg-red-50 rounded-lg p-3">Esta ação não pode ser desfeita.</p>
            {deleteError && <p className="text-red-600 text-sm text-center mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteError(null); }} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50">{isDeleting ? 'Deletando...' : 'Sim, deletar'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Loader() { return <div className="text-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-gray-400 text-sm">Carregando...</p></div>; }
function Empty({ text, link, linkText }: { text: string; link?: string; linkText?: string }) {
  return <div className="text-center py-12"><p className="text-gray-400 text-sm">{text}</p>{link && <Link href={link} className="text-blue-600 text-sm underline mt-2 inline-block">{linkText}</Link>}</div>;
}

function ReadOnlyView({ student }: { student: Student }) {
  const groups = [
    {
      title: 'Identificação', fields: [
        { label: 'CPF', value: student.cpf }, { label: 'Nome', value: student.nome },
        { label: 'Nome da Mãe', value: student.nomeMae }, { label: 'E-mail', value: student.email },
        { label: 'Data de Nascimento', value: student.dataNascimento },
        { label: 'Tipo Sanguíneo', value: student.tipoSanguineo }, { label: 'Status', value: student.statusMatricula },
      ]
    },
    { title: 'Contato', fields: [{ label: 'WhatsApp', value: student.telefoneWhatsapp }, { label: 'Telefone Secundário', value: student.telefoneSecundario }] },
    {
      title: 'Endereço', fields: [
        { label: 'CEP', value: student.cep },
        { label: 'Endereço', value: `${student.endereco || ''}${student.numero ? ', ' + student.numero : ''}${student.complemento ? ' - ' + student.complemento : ''}` },
        { label: 'Bairro', value: student.bairro }, { label: 'Cidade / Estado', value: `${student.cidade || ''} ${student.estado ? '- ' + student.estado : ''}` },
      ]
    },
    {
      title: 'Dados Bancários', fields: [
        { label: 'Banco', value: student.banco }, { label: 'Agência', value: student.agencia },
        { label: 'Conta Corrente', value: student.contaCorrente }, { label: 'Tipo de Conta', value: student.tipoConta },
        { label: 'PIX', value: student.pix },
      ]
    },
    {
      title: 'Condição Socioeconômica', fields: [
        { label: 'Identidade Racial', value: student.identidadeRacial }, { label: 'Identidade de Gênero', value: student.identidadeGenero },
        { label: 'Tipo de Moradia', value: student.tipoMoradia }, { label: 'Moradores', value: student.quantidadeMoradores },
        { label: 'Renda Familiar', value: student.rendaFamiliar }, { label: 'Renda per Capita', value: student.rendaPerCapita },
      ]
    },
    {
      title: 'Escolaridade', fields: [
        { label: 'Concluiu Ensino Médio', value: student.concluiuEnsinoMedio },
        { label: 'Série Atual', value: student.serieAtual }, { label: 'Ano de Conclusão', value: student.anoConclusaoEnsinoMedio },
        { label: 'Tipo de Escola', value: student.tipoEscola },
      ]
    },
    {
      title: 'Saúde', fields: [
        { label: 'Deficiência', value: student.pessoaComDeficiencia }, { label: 'Qual', value: student.qualDeficiencia },
        { label: 'Alergia', value: student.possuiAlergia }, { label: 'Qual', value: student.qualAlergia },
        { label: 'Medicamento', value: student.usaMedicamento }, { label: 'Qual', value: student.qualMedicamento },
      ]
    },
    {
      title: 'Contatos de Emergência', fields: [
        { label: 'Contato 1 — Nome', value: student.contatoEmergencia1Nome },
        { label: 'Contato 1 — Telefone', value: student.contatoEmergencia1Telefone },
        { label: 'Contato 1 — Parentesco', value: student.contatoEmergencia1Parentesco },
        { label: 'Contato 2 — Nome', value: student.contatoEmergencia2Nome },
        { label: 'Contato 2 — Telefone', value: student.contatoEmergencia2Telefone },
        { label: 'Contato 2 — Parentesco', value: student.contatoEmergencia2Parentesco },
      ]
    },
  ];
  return (
    <div className="space-y-8">
      {groups.map(group => (
        <div key={group.title}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">{group.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.fields.filter(f => f.value).map(({ label, value }) => (
              <div key={label}><p className="text-xs text-gray-400 mb-0.5">{label}</p><p className="text-sm text-gray-800 font-medium">{value}</p></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}