'use client';

// ============================================================
//  ARQUIVO: src/app/dashboard/page.tsx
//  Faltas calculadas por aluno considerando dataInscricao.
//  Cada aluno só é avaliado pelas aulas ocorridas APÓS
//  sua data de inscrição no sistema.
// ============================================================

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { postToGAS } from '@/lib/gasClient';
import { LIMITE_FALTAS_PERCENT, ALERTA_FALTAS_PERCENT } from '@/lib/permissions';
import Link from 'next/link';

interface AttendanceSummary {
  totalAulas: number;
  datasAulas: string[];                           // lista de datas únicas yyyy-MM-dd
  porAluno: Record<string, {
    presentes: number;
    faltas: number;
    justificadas: number;
    total: number;
  }>;
}

interface StudentAlert {
  cpf: string; nome: string;
  percentFaltas: number;
  faltas: number;
  justificadas: number;
  totalAulasPossiveis: number;                    // aulas após a inscrição do aluno
  nivel: 'critico' | 'atencao';
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  COORDENAÇÃO: 'bg-blue-100 text-blue-700',
  'PROFESSOR/MONITOR': 'bg-green-100 text-green-700',
  INSPETOR: 'bg-orange-100 text-orange-700',
};

const ROLE_SAUDACAO: Record<string, string> = {
  ADMIN: 'Visão completa do sistema',
  COORDENAÇÃO: 'Gerencie alunos e presenças',
  'PROFESSOR/MONITOR': 'Acompanhe suas turmas',
  INSPETOR: 'Monitore a frequência dos alunos',
};

export default function DashboardPage() {
  const { currentUser, isLoading, error, logout, students, can } = useAuth();
  const router = useRouter();

  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);

  useEffect(() => {
    if (!isLoading && !currentUser) router.replace('/login');
  }, [isLoading, currentUser, router]);

  useEffect(() => {
    if (!currentUser) return;
    setLoadingAttendance(true);
    postToGAS('GET_ATTENDANCE_SUMMARY', {}, currentUser.email)
      .then(res => setAttendanceSummary(res.summary ?? null))
      .catch(() => setAttendanceSummary(null))
      .finally(() => setLoadingAttendance(false));
  }, [currentUser]);

  // ── Alertas de faltas, corrigidos por dataInscricao ────────
  const alertas = useMemo((): StudentAlert[] => {
    if (!attendanceSummary || !students.length) return [];
    const { datasAulas, porAluno } = attendanceSummary;
    if (!datasAulas?.length) return [];

    return students
      .filter(s => s.statusMatricula === 'ativo')
      .flatMap(s => {
        const cpfLimpo = s.cpf.replace(/\D/g, '');
        const stats = porAluno[cpfLimpo] ?? { presentes: 0, faltas: 0, justificadas: 0, total: 0 };

        // Aulas que ocorreram na data de inscrição ou depois.
        // Se dataInscricao não estiver preenchida, considera todas as aulas.
        const dataRef = s.dataInscricao && s.dataInscricao.trim()
          ? s.dataInscricao.trim()
          : datasAulas[0]; // primeira aula registrada no sistema

        const totalAulasPossiveis = datasAulas.filter(d => d >= dataRef).length;

        // Aluno inscrito mais recentemente que qualquer aula → sem dados ainda
        if (totalAulasPossiveis === 0) return [];

        // Faltas justificadas NÃO contam para o limite — só faltas simples
        const percentFaltas = Math.round((stats.faltas / totalAulasPossiveis) * 100);

        if (percentFaltas < ALERTA_FALTAS_PERCENT) return [];

        const nivel: 'critico' | 'atencao' =
          percentFaltas >= LIMITE_FALTAS_PERCENT ? 'critico' : 'atencao';

        return [{
          cpf: s.cpf, nome: s.nome, percentFaltas,
          faltas: stats.faltas, justificadas: stats.justificadas,
          totalAulasPossiveis, nivel,
        }];
      })
      .sort((a, b) => b.percentFaltas - a.percentFaltas);
  }, [attendanceSummary, students]);

  // ── Taxa de frequência geral — também corrigida ─────────────
  const taxaFrequencia = useMemo(() => {
    if (!attendanceSummary?.datasAulas?.length) return null;
    const { datasAulas, porAluno } = attendanceSummary;

    let totalPresentes = 0;
    let totalPossivel = 0;

    students
      .filter(s => s.statusMatricula === 'ativo')
      .forEach(s => {
        const cpfLimpo = s.cpf.replace(/\D/g, '');
        const stats = porAluno[cpfLimpo] ?? { presentes: 0, faltas: 0, justificadas: 0, total: 0 };
        const dataRef = s.dataInscricao?.trim() || datasAulas[0];
        const possiveis = datasAulas.filter(d => d >= dataRef).length;
        totalPresentes += stats.presentes;
        totalPossivel += possiveis;
      });

    if (totalPossivel === 0) return null;
    return Math.round((totalPresentes / totalPossivel) * 100);
  }, [attendanceSummary, students]);

  const alertasCriticos = alertas.filter(a => a.nivel === 'critico');
  const alertasAtencao = alertas.filter(a => a.nivel === 'atencao');
  const alunosAtivos = students.filter(s => s.statusMatricula === 'ativo').length;
  const alunosInativos = students.filter(s => s.statusMatricula !== 'ativo').length;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-sm p-8 max-w-md text-center">
        <p className="text-red-600 font-medium mb-4">{error}</p>
        <button onClick={logout} className="text-blue-600 underline text-sm">
          Sair e tentar outro e-mail
        </button>
      </div>
    </div>
  );

  if (!currentUser) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-800">PJU</h1>
            <nav className="hidden sm:flex items-center gap-1">
              <span className="px-3 py-1.5 text-sm text-blue-600 bg-blue-50 rounded-lg font-medium">Dashboard</span>
              {can('VER_ALUNOS') && (
                <Link href="/alunos" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">Alunos</Link>
              )}
              {can('VER_PRESENCA') && (
                <Link href="/presenca" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">Presença</Link>
              )}
              {can('GERENCIAR_USUARIOS') && (
                <Link href="/usuarios" className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">Usuários</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 justify-end">
                {currentUser.fotoUrl && (
                  <img src={currentUser.fotoUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                )}
                <p className="text-sm font-medium text-gray-700">{currentUser.nome}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[currentUser.role] ?? 'bg-gray-100 text-gray-500'}`}>
                {currentUser.role}
              </span>
            </div>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 transition-colors">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Saudação */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            Olá, {currentUser.nome.split(' ')[0]}! 👋
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            {ROLE_SAUDACAO[currentUser.role]}
          </p>
        </div>

        {/* Cards de métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <MetricCard
            valor={alunosAtivos} label="Alunos Ativos"
            cor="blue" icon="👨‍🎓"
            sub={`${alunosInativos} inativo(s)`}
          />
          <MetricCard
            valor={taxaFrequencia !== null ? `${taxaFrequencia}%` : '—'}
            label="Frequência Geral"
            cor={taxaFrequencia === null ? 'gray' : taxaFrequencia >= 75 ? 'green' : taxaFrequencia >= 60 ? 'yellow' : 'red'}
            icon="📊"
            sub={
              loadingAttendance ? 'Calculando...' :
                attendanceSummary
                  ? `${attendanceSummary.totalAulas} aula(s) — por data de inscrição`
                  : 'Sem dados de presença'
            }
            loading={loadingAttendance}
          />
          <MetricCard
            valor={alertasCriticos.length} label="Situação Crítica"
            cor="red" icon="🚨"
            sub={`≥ ${LIMITE_FALTAS_PERCENT}% de faltas`}
            loading={loadingAttendance}
          />
          <MetricCard
            valor={alertasAtencao.length} label="Em Atenção"
            cor="yellow" icon="⚠️"
            sub={`${ALERTA_FALTAS_PERCENT}–${LIMITE_FALTAS_PERCENT - 1}% de faltas`}
            loading={loadingAttendance}
          />
        </div>

        {/* Painel principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Alertas de faltas (2/3) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Críticos */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚨</span>
                  <h3 className="font-bold text-red-800 text-sm">Situação Crítica — Limite Atingido</h3>
                </div>
                <span className="text-xs text-red-400">{LIMITE_FALTAS_PERCENT}% ou mais</span>
              </div>
              {loadingAttendance ? <SkeletonList n={3} /> :
                alertasCriticos.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm text-gray-400">Nenhum aluno em situação crítica.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {alertasCriticos.map(a => (
                      <AlertRow key={a.cpf} alerta={a} nivel="critico" canView={can('VER_ALUNOS')} />
                    ))}
                  </div>
                )
              }
            </div>

            {/* Atenção */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <h3 className="font-bold text-yellow-800 text-sm">Atenção — Próximos do Limite</h3>
                </div>
                <span className="text-xs text-yellow-500">{ALERTA_FALTAS_PERCENT}% a {LIMITE_FALTAS_PERCENT - 1}%</span>
              </div>
              {loadingAttendance ? <SkeletonList n={3} /> :
                alertasAtencao.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">👍</p>
                    <p className="text-sm text-gray-400">Nenhum aluno em zona de atenção.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {alertasAtencao.map(a => (
                      <AlertRow key={a.cpf} alerta={a} nivel="atencao" canView={can('VER_ALUNOS')} />
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* Coluna direita (1/3) */}
          <div className="space-y-6">

            {/* Ações rápidas */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 text-sm mb-4">Ações Rápidas</h3>
              <div className="space-y-2">
                {can('REGISTRAR_PRESENCA') && (
                  <Link href="/presenca" className="flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors text-sm font-medium">
                    <span className="text-lg">📋</span> Registrar Presença
                  </Link>
                )}
                {can('CADASTRAR_ALUNOS') && (
                  <Link href="/alunos/novo" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm font-medium">
                    <span className="text-lg">➕</span> Cadastrar Aluno
                  </Link>
                )}
                {can('VER_ALUNOS') && (
                  <Link href="/alunos" className="flex items-center gap-3 px-4 py-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors text-sm font-medium">
                    <span className="text-lg">👥</span> Ver Todos os Alunos
                  </Link>
                )}
                {can('GERENCIAR_USUARIOS') && (
                  <Link href="/usuarios" className="flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-colors text-sm font-medium">
                    <span className="text-lg">👤</span> Gerenciar Usuários
                  </Link>
                )}
              </div>
            </div>

            {/* Distribuição por status */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 text-sm mb-4">Status das Matrículas</h3>
              <div className="space-y-3">
                {[
                  { label: 'Ativo', cor: 'bg-green-500', count: students.filter(s => s.statusMatricula === 'ativo').length },
                  { label: 'Inativo', cor: 'bg-gray-300', count: students.filter(s => s.statusMatricula === 'inativo').length },
                  { label: 'Trancado', cor: 'bg-yellow-400', count: students.filter(s => s.statusMatricula === 'trancado').length },
                  { label: 'Concluído', cor: 'bg-blue-400', count: students.filter(s => s.statusMatricula === 'concluído').length },
                ].map(({ label, cor, count }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{label}</span><span>{count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${cor} rounded-full transition-all`}
                        style={{ width: students.length > 0 ? `${(count / students.length) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disciplina do usuário */}
            {currentUser.disciplina && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-gray-800 text-sm mb-2">Minha Disciplina</h3>
                <p className="text-blue-600 font-semibold">{currentUser.disciplina}</p>
                {currentUser.instituicaoEnsino && (
                  <p className="text-gray-400 text-xs mt-1">{currentUser.instituicaoEnsino}</p>
                )}
              </div>
            )}

            {/* Legenda */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Critério de Faltas
              </p>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                  <span>Abaixo de {ALERTA_FALTAS_PERCENT}% — frequência regular</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                  <span>{ALERTA_FALTAS_PERCENT}–{LIMITE_FALTAS_PERCENT - 1}% — atenção</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                  <span>≥ {LIMITE_FALTAS_PERCENT}% — situação crítica</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200">
                ℹ️ Cada aluno é avaliado apenas pelas aulas ocorridas após sua data de inscrição.
                Faltas justificadas não contam para o limite.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────

function MetricCard({ valor, label, cor, icon, sub, loading }: {
  valor: string | number; label: string; cor: string;
  icon: string; sub?: string; loading?: boolean;
}) {
  const cores: Record<string, string> = {
    blue: 'text-blue-600', green: 'text-green-600',
    red: 'text-red-600', yellow: 'text-yellow-500', gray: 'text-gray-400',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        {loading
          ? <div className="w-10 h-8 bg-gray-100 rounded animate-pulse" />
          : <p className={`text-3xl font-bold ${cores[cor] ?? 'text-gray-700'}`}>{valor}</p>
        }
      </div>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AlertRow({ alerta, nivel, canView }: {
  alerta: StudentAlert; nivel: 'critico' | 'atencao'; canView: boolean;
}) {
  const { cpf, nome, percentFaltas, faltas, justificadas, totalAulasPossiveis } = alerta;
  const barCor = nivel === 'critico' ? 'bg-red-500' : 'bg-yellow-400';
  const textCor = nivel === 'critico' ? 'text-red-700' : 'text-yellow-700';

  return (
    <div className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
        {nome?.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        {canView
          ? <a href={`/alunos/${encodeURIComponent(cpf)}`}
            className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate block">
            {nome}
          </a>
          : <p className="text-sm font-medium text-gray-800 truncate">{nome}</p>
        }
        <p className="text-xs text-gray-400">
          {faltas} falta(s) · {justificadas} justificada(s) · {totalAulasPossiveis} aula(s) possível(is)
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${textCor}`}>{percentFaltas}%</p>
        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
          <div className={`h-full ${barCor} rounded-full`}
            style={{ width: `${Math.min(percentFaltas, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function SkeletonList({ n }: { n: number }) {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-3.5">
          <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 bg-gray-100 rounded animate-pulse w-3/4" />
            <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/2" />
          </div>
          <div className="w-12 h-5 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}