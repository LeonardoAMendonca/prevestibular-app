'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import StudentForm from '@/components/StudentForm';
import { Student } from '@/contexts/AuthContext';
import { postToGAS } from '@/lib/gasClient';
import Link from 'next/link';

type Aba = 'dados' | 'presenca';

interface RegistroPresenca {
  data: string;
  status: string;
  justificativa?: string;
  registrado_por: string;
}

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [presencas, setPresencas] = useState<RegistroPresenca[]>([]);
  const [loadingPresenca, setLoadingPresenca] = useState(false);

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
  }, [isLoading, currentUser, router]);

  useEffect(() => {
    if (students.length > 0 && cpfParam) {
      const cleanParam = cpfParam.replace(/\D/g, '');
      const found = students.find((s) => s.cpf.replace(/\D/g, '') === cleanParam);
      setStudent(found ?? null);
    }
  }, [students, cpfParam]);

  useEffect(() => {
    if (abaAtiva === 'presenca' && student && currentUser) {
      setLoadingPresenca(true);
      postToGAS('GET_ATTENDANCE', { cpf: student.cpf }, currentUser.email)
        .then((res) => setPresencas(res.registros ?? []))
        .catch(() => setPresencas([]))
        .finally(() => setLoadingPresenca(false));
    }
  }, [abaAtiva, student, currentUser]);

  async function handleDelete() {
    if (!student || !currentUser) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await postToGAS('DELETE_STUDENT', { cpf: student.cpf }, currentUser.email);
      await refreshData();
      router.push('/dashboard');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao deletar.');
      setIsDeleting(false);
    }
  }

  function calcularIdade(dataNascimento: string): string {
    if (!dataNascimento) return '—';
    const hoje = new Date();
    const nasc = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return `${idade} anos`;
  }

  function formatarData(d: string): string {
    if (!d) return '—';
    const [ano, mes, dia] = d.split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : d;
  }

  function calcularFrequencia(registros: RegistroPresenca[]) {
    if (registros.length === 0) return null;
    const presentes = registros.filter((r) => r.status === 'presente').length;
    return Math.round((presentes / registros.length) * 100);
  }

  if (isLoading || !currentUser) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Carregando...</p>
    </div>
  );

  if (!student) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-gray-500">Aluno não encontrado.</p>
      <Link href="/dashboard" className="text-blue-600 text-sm underline">Voltar ao Dashboard</Link>
    </div>
  );

  const freq = calcularFrequencia(presencas);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">← Dashboard</Link>
            <span className="text-gray-200">/</span>
            <span className="text-gray-800 font-semibold text-sm">{student.nome}</span>
          </div>
          <div className="flex items-center gap-2">
            {can.writeStudents && !isEditing && abaAtiva === 'dados' && (
              <>
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">Editar</button>
                <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors border border-red-200">Deletar</button>
              </>
            )}
            {isEditing && (
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-gray-500 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar Edição</button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Card resumo */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 flex items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-blue-600">
            {student.nome?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800">{student.nome}</h2>
            <p className="text-gray-400 text-sm mt-0.5">CPF: {student.cpf}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
              <span>🎂 {calcularIdade(student.dataNascimento)}</span>
              <span>📱 {student.telefoneWhatsapp || '—'}</span>
              <span>📍 {student.bairro ? `${student.bairro}, ${student.cidade}` : '—'}</span>
              {freq !== null && (
                <span className={`font-semibold ${freq >= 75 ? 'text-green-600' : freq >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                  📊 {freq}% de frequência
                </span>
              )}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${student.statusMatricula === 'ativo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {student.statusMatricula || 'indefinido'}
          </span>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl shadow-sm p-1 w-fit">
          <button onClick={() => { setAbaAtiva('dados'); setIsEditing(false); }}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${abaAtiva === 'dados' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            Dados Cadastrais
          </button>
          <button onClick={() => setAbaAtiva('presenca')}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${abaAtiva === 'presenca' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
            Presença {freq !== null && `(${freq}%)`}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          {/* Aba Dados */}
          {abaAtiva === 'dados' && (
            isEditing ? (
              <><div className="mb-8"><h3 className="text-lg font-bold text-gray-800">Editando: {student.nome}</h3><p className="text-sm text-gray-400 mt-1">O CPF não pode ser alterado.</p></div><StudentForm mode="edit" initialData={student} /></>
            ) : <ReadOnlyView student={student} />
          )}

          {/* Aba Presença */}
          {abaAtiva === 'presenca' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-800">Histórico de Presença</h3>
                <div className="flex items-center gap-3">
                  {freq !== null && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${freq >= 75 ? 'bg-green-100 text-green-700' : freq >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      Frequência: {freq}% {freq < 75 && '⚠️'}
                    </div>
                  )}
                  <Link href="/presenca" className="px-3 py-2 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                    + Registrar presença
                  </Link>
                </div>
              </div>

              {loadingPresenca ? (
                <div className="text-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p className="text-gray-400 text-sm">Carregando...</p></div>
              ) : presencas.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">Nenhum registro de presença encontrado.</p>
                  <Link href="/presenca" className="text-blue-600 text-sm underline mt-2 inline-block">Registrar presença →</Link>
                </div>
              ) : (
                <>
                  {/* Cards de resumo */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {(['presente', 'falta', 'falta_justificada'] as const).map((s) => (
                      <div key={s} className={`rounded-lg p-4 text-center ${s === 'presente' ? 'bg-green-50' : s === 'falta' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                        <p className="text-2xl font-bold">{presencas.filter((r) => r.status === s).length}</p>
                        <p className="text-xs mt-1 text-gray-600">{STATUS_PRESENCA[s].label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tabela */}
                  <div className="overflow-hidden rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Data</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Justificativa</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Registrado por</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...presencas].sort((a, b) => b.data.localeCompare(a.data)).map((r, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-700 whitespace-nowrap">{formatarData(r.data)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_PRESENCA[r.status]?.cor ?? 'bg-gray-100 text-gray-500'}`}>
                                {STATUS_PRESENCA[r.status]?.label ?? r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {r.justificativa
                                ? <span className="italic text-yellow-700">"{r.justificativa}"</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">{r.registrado_por}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal delete */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-red-600 text-xl">⚠️</span></div>
            <h3 className="text-lg font-bold text-gray-800 text-center mb-2">Deletar aluno?</h3>
            <p className="text-gray-500 text-sm text-center mb-1">Você está prestes a deletar permanentemente:</p>
            <p className="text-gray-800 font-semibold text-center mb-6">{student.nome} — CPF {student.cpf}</p>
            <p className="text-red-600 text-xs text-center mb-6 bg-red-50 rounded-lg p-3">Esta ação não pode ser desfeita.</p>
            {deleteError && <p className="text-red-600 text-sm text-center mb-4">{deleteError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteError(null); }} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">Cancelar</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">{isDeleting ? 'Deletando...' : 'Sim, deletar'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ReadOnlyView({ student }: { student: Student }) {
  const groups = [
    { title: 'Identificação', fields: [{ label: 'CPF', value: student.cpf }, { label: 'Nome', value: student.nome }, { label: 'Data de Nascimento', value: student.dataNascimento }, { label: 'Tipo Sanguíneo', value: student.tipoSanguineo }, { label: 'Status de Matrícula', value: student.statusMatricula }] },
    { title: 'Contato', fields: [{ label: 'WhatsApp', value: student.telefoneWhatsapp }, { label: 'Telefone Secundário', value: student.telefoneSecundario }] },
    { title: 'Endereço', fields: [{ label: 'CEP', value: student.cep }, { label: 'Endereço', value: `${student.endereco || ''}${student.numero ? ', ' + student.numero : ''}` }, { label: 'Bairro', value: student.bairro }, { label: 'Cidade / Estado', value: `${student.cidade || ''} ${student.estado ? '- ' + student.estado : ''}` }] },
    { title: 'Perfil Social', fields: [{ label: 'Identidade Racial', value: student.identidadeRacial }, { label: 'Identidade de Gênero', value: student.identidadeGenero }, { label: 'Tem Filhos', value: student.temFilhos }] },
    { title: 'Moradia e Vulnerabilidade', fields: [{ label: 'Tipo de Moradia', value: student.tipoMoradia }, { label: 'Moradores', value: student.quantidadeMoradores }, { label: 'Área de Risco Ambiental', value: student.areaRiscoAmbiental }, { label: 'Área de Risco de Segurança', value: student.areaRiscoSeguranca }] },
    { title: 'Escolaridade', fields: [{ label: 'Concluiu Ensino Médio', value: student.concluiuEnsinoMedio }, { label: 'Ano de Conclusão', value: student.anoConclusaoEnsinoMedio }] },
  ];
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b border-gray-100">{group.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.fields.map(({ label, value }) => (
              <div key={label}><p className="text-xs text-gray-400 mb-0.5">{label}</p><p className="text-sm text-gray-800 font-medium">{value || '—'}</p></div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}