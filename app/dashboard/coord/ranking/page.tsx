'use client';

import { useState, useEffect } from 'react';
import { BarChart3, RefreshCw, Loader2, TrendingUp, School, AlertTriangle, MessageCircle } from 'lucide-react';
import { Ranking, whatsAppLink } from '@/lib/gas-client';
import type { RankedCandidate } from '@/types';
import { useSession } from 'next-auth/react';

const STATUS_BADGE: Record<string, string> = {
  INSCRITO:     'bg-slate-100 text-slate-600',
  CLASSIFICADO: 'bg-amber-100 text-amber-700',
  APROVADO:     'bg-green-100 text-green-700',
  MATRICULADO:  'bg-teal-100 text-teal-700',
  REPROVADO:    'bg-red-100 text-red-700',
};

export default function RankingPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  const [ranking,     setRanking]     = useState<RankedCandidate[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 4000);
  }

  async function load() {
    setLoading(true);
    try {
      const r = await Ranking.get();
      setRanking(r.ranking);
    } catch {
      showToast('Erro ao carregar ranking.', false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function calculate() {
    if (!confirm('Calcular o ranking irá recalcular todas as pontuações. Continuar?')) return;
    setCalculating(true);
    try {
      const r = await Ranking.calculate();
      showToast(`Ranking calculado! ${r.calculados} candidatos processados.`);
      await load();
    } catch (e: any) {
      showToast(e.message ?? 'Erro ao calcular.', false);
    } finally {
      setCalculating(false);
    }
  }

  // Métricas rápidas
  const aprovados    = ranking.filter(r => r.status === 'APROVADO').length;
  const matriculados = ranking.filter(r => r.status === 'MATRICULADO').length;
  const escPublica   = ranking.filter(r => r.escola_publica === 'SIM').length;
  const risco        = ranking.filter(r => r.risco_social === 'SIM').length;

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">

      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card-hover text-sm font-medium animate-slide-up
          ${toast.ok ? 'bg-teal-700 text-white' : 'bg-red-600 text-white'}`}
          style={{ fontFamily: 'var(--font-jakarta)' }}>
          {toast.ok ? <BarChart3 size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--c-primary-mid)', fontFamily: 'var(--font-jakarta)', fontWeight: 500 }}>
            Coordenação
          </p>
          <h1 className="text-3xl" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300 }}>
            Ranking Socioeconômico
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            Candidatos ordenados por pontuação. Quanto maior, maior a vulnerabilidade.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={calculate} disabled={calculating || loading}>
              {calculating ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
              {calculating ? 'Calculando…' : 'Calcular Ranking'}
            </button>
          )}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total classificados', val: ranking.length, icon: BarChart3, bg: 'var(--c-primary-light)', color: '#0c6665' },
          { label: 'Aprovados',    val: aprovados,    icon: TrendingUp,    bg: '#f0fdf4', color: '#166534' },
          { label: 'Matriculados', val: matriculados, icon: School,        bg: '#eff6ff', color: '#1d4ed8' },
          { label: 'Risco social', val: risco,        icon: AlertTriangle, bg: '#fef3c7', color: '#92400e' },
        ].map(m => (
          <div key={m.label} className="card" style={{ background: m.bg, borderColor: 'transparent' }}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon size={15} style={{ color: m.color }} />
              <span className="text-xs" style={{ color: m.color, fontFamily: 'var(--font-jakarta)', fontWeight: 500 }}>{m.label}</span>
            </div>
            <p className="text-3xl font-light" style={{ fontFamily: 'var(--font-fraunces)', color: m.color }}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Fórmula */}
      <div className="card mb-6" style={{ background: '#fef8ee', borderColor: '#fdeacb' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#b86d10', fontFamily: 'var(--font-jakarta)' }}>
          Fórmula do ranking
        </p>
        <code className="text-sm" style={{ color: '#6b3a06', fontFamily: 'var(--font-mono)' }}>
          Pontuação = (1000 ÷ Renda_Per_Capita) + (Escola_Pública ? +10 : 0) + (Risco_Social ? +15 : 0)
        </code>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            <Loader2 size={18} className="animate-spin" /> Carregando ranking…
          </div>
        ) : ranking.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 size={36} className="mx-auto mb-3" style={{ color: 'var(--c-border)' }} />
            <p className="text-sm" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
              Nenhum candidato classificado ainda.
            </p>
            {isAdmin && (
              <p className="text-xs mt-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                Clique em "Calcular Ranking" para processar as inscrições.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-12 text-center">#</th>
                  <th>Nome</th>
                  <th>Renda p/ capita</th>
                  <th className="text-center">Esc. Pública</th>
                  <th className="text-center">Risco Social</th>
                  <th className="text-right">Pontuação</th>
                  <th>Status</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {ranking.map(c => (
                  <tr key={c.id} className="animate-fade-in">
                    <td className="text-center">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold"
                        style={{
                          background: c.posicao <= 3 ? '#0c6665' : 'var(--c-surface-2)',
                          color: c.posicao <= 3 ? '#fff' : 'var(--c-text-muted)',
                          fontFamily: 'var(--font-jakarta)',
                        }}
                      >
                        {c.posicao}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium" style={{ color: 'var(--c-text)', fontFamily: 'var(--font-jakarta)' }}>
                        {c.name}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
                      R$ {Number(c.renda_per_capita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-center">
                      <span className={c.escola_publica === 'SIM' ? 'badge-P' : 'badge-F'}>
                        {c.escola_publica}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={c.risco_social === 'SIM' ? 'role-badge bg-amber-100 text-amber-700' : 'badge-F'}>
                        {c.risco_social}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)', color: '#0c6665', fontSize: '0.85rem' }}>
                        {Number(c.pontuacao).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className={`role-badge ${STATUS_BADGE[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <a
                        href={whatsAppLink(c.phone ?? '', 'matricula')}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Notificar via WhatsApp"
                        className="p-1.5 rounded-lg flex items-center justify-center hover:bg-green-100 text-green-600 transition-colors"
                      >
                        <MessageCircle size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
