'use client';

import { useState, useRef } from 'react';
import { Search, Upload, UserCheck, Loader2, X, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { Candidates, Students, Files, formatCpf } from '@/lib/gas-client';
import type { Candidate } from '@/types';

type Step = 'search' | 'review' | 'upload' | 'done';

interface UploadedFile { name: string; fileId: string; viewUrl: string; }

export default function MatriculaPage() {
  const [step,       setStep]       = useState<Step>('search');
  const [cpf,        setCpf]        = useState('');
  const [candidate,  setCandidate]  = useState<Candidate | null>(null);
  const [uploads,    setUploads]    = useState<UploadedFile[]>([]);
  const [studentId,  setStudentId]  = useState('');
  const [searching,  setSearching]  = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [enrolling,  setEnrolling]  = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 4000);
  }

  function handleCpfChange(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    setCpf(d.replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
            .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4'));
  }

  async function handleSearch() {
    const raw = cpf.replace(/\D/g, '');
    if (raw.length !== 11) { showToast('CPF inválido.', false); return; }
    setSearching(true);
    try {
      const r = await Candidates.searchByCpf(raw);
      if (!r.found || !r.candidate) { showToast('CPF não encontrado na lista de inscritos.', false); return; }
      setCandidate(r.candidate);
      setStep('review');
    } catch (e: any) { showToast(e.message ?? 'Erro na busca.', false); }
    finally { setSearching(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;

    // Validações de tamanho (5MB) e tipo
    if (file.size > 5 * 1024 * 1024) { showToast('Arquivo deve ter no máximo 5MB.', false); return; }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      showToast('Aceito apenas JPG, PNG e PDF.', false); return;
    }

    setUploading(true);
    try {
      const r = await Files.upload(candidate.cpf.replace(/\D/g, ''), file);
      setUploads(prev => [...prev, { name: file.name, fileId: r.file_id, viewUrl: r.view_url }]);
      showToast(`${file.name} enviado com sucesso.`);
    } catch (e: any) { showToast(e.message ?? 'Erro no upload.', false); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function handleEnroll() {
    if (!candidate) return;
    if (candidate.status !== 'APROVADO') {
      showToast(`Candidato com status "${candidate.status}" não pode ser matriculado.`, false);
      return;
    }

    setEnrolling(true);
    try {
      const r = await Students.enroll({
        cpf:          candidate.cpf.replace(/\D/g, ''),
        candidate_id: candidate.id,
        name:         candidate.name,
        birth_date:   candidate.birth_date,
      });
      setStudentId(r.id_student);
      setStep('done');
    } catch (e: any) { showToast(e.message ?? 'Erro na matrícula.', false); }
    finally { setEnrolling(false); }
  }

  const statusOk = candidate?.status === 'APROVADO';

  return (
    <div className="p-8 max-w-2xl mx-auto animate-fade-in">

      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card-hover text-sm font-medium animate-slide-up
          ${toast.ok ? 'bg-teal-700 text-white' : 'bg-red-600 text-white'}`}
          style={{ fontFamily: 'var(--font-jakarta)' }}>
          {toast.ok ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--c-primary-mid)', fontFamily: 'var(--font-jakarta)', fontWeight: 500 }}>
          Coordenação
        </p>
        <h1 className="text-3xl" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300 }}>
          Workflow de Matrícula
        </h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {(['search', 'review', 'upload', 'done'] as Step[]).map((s, i) => {
          const labels  = ['Busca', 'Revisão', 'Documentos', 'Concluído'];
          const done    = ['search','review','upload','done'].indexOf(step) > i;
          const current = step === s;

          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all"
                  style={{
                    background: done || current ? '#0c6665' : 'var(--c-surface-2)',
                    color: done || current ? '#fff' : 'var(--c-text-muted)',
                    fontFamily: 'var(--font-jakarta)',
                  }}
                >
                  {done ? <CheckCircle2 size={15}/> : i + 1}
                </div>
                <span className="text-xs whitespace-nowrap" style={{
                  color: current ? '#0c6665' : done ? 'var(--c-text-muted)' : 'var(--c-border)',
                  fontFamily: 'var(--font-jakarta)', fontWeight: current ? 600 : 400,
                }}>
                  {labels[i]}
                </span>
              </div>
              {i < 3 && (
                <div className="flex-1 h-px mx-2 mt-[-10px]"
                     style={{ background: done ? '#0c6665' : 'var(--c-border)' }}/>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step: Busca ── */}
      {step === 'search' && (
        <div className="card animate-slide-up">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            Buscar candidato por CPF
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-muted)' }}/>
              <input className="field pl-9" placeholder="000.000.000-00"
                     value={cpf} onChange={e => handleCpfChange(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleSearch()}/>
            </div>
            <button className="btn-primary" onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 size={15} className="animate-spin"/> : <Search size={15}/>}
              Buscar
            </button>
          </div>
          <p className="text-xs mt-4" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            O CPF deve estar na lista de candidatos classificados pelo Google Forms.
          </p>
        </div>
      )}

      {/* ── Step: Revisão ── */}
      {step === 'review' && candidate && (
        <div className="card animate-slide-up">
          <div className="flex items-start justify-between mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
              Dados do candidato
            </p>
            <button onClick={() => setStep('search')} className="p-1 hover:bg-slate-100 rounded transition-colors">
              <X size={14} style={{ color: 'var(--c-text-muted)' }}/>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-6 text-sm" style={{ fontFamily: 'var(--font-jakarta)' }}>
            {[
              ['Nome',           candidate.name],
              ['CPF',            formatCpf(candidate.cpf)],
              ['E-mail',         candidate.email],
              ['Telefone',       candidate.phone],
              ['Data nasc.',     candidate.birth_date],
              ['Renda per cap.', `R$ ${Number(candidate.renda_per_capita).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
              ['Escola pública', candidate.escola_publica],
              ['Risco social',   candidate.risco_social],
              ['Pontuação',      candidate.pontuacao ? String(Number(candidate.pontuacao).toFixed(2)) : '—'],
              ['Status',         candidate.status],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs mb-0.5" style={{ color: 'var(--c-text-muted)' }}>{k}</p>
                <p className="font-medium" style={{ color: 'var(--c-text)' }}>{v}</p>
              </div>
            ))}
          </div>

          {!statusOk && (
            <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: '#fef3c7' }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: '#92400e' }}/>
              <p className="text-xs" style={{ color: '#78350f', fontFamily: 'var(--font-jakarta)' }}>
                Este candidato tem status <strong>{candidate.status}</strong>. Apenas candidatos com status <strong>APROVADO</strong> podem ser matriculados.
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setStep('search')}>Voltar</button>
            <button className="btn-primary" onClick={() => setStep('upload')} disabled={!statusOk}>
              Próximo: Documentos →
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Upload ── */}
      {step === 'upload' && candidate && (
        <div className="animate-slide-up space-y-4">
          <div className="card">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
              Enviando para: {candidate.name}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
              Arquivos salvos na pasta <code className="font-mono">{candidate.cpf.replace(/\D/g,'')}_{candidate.name.split(' ')[0]}</code> no Drive.
              Aceito: JPG, PNG, PDF · máx. 5MB.
            </p>

            {/* Dropzone */}
            <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:border-teal-400"
                   style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleUpload}/>
              {uploading ? (
                <Loader2 size={24} className="animate-spin" style={{ color: '#0c6665' }}/>
              ) : (
                <Upload size={24} style={{ color: 'var(--c-text-muted)' }}/>
              )}
              <span className="text-sm" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                {uploading ? 'Enviando…' : 'Clique para selecionar o arquivo'}
              </span>
            </label>
          </div>

          {/* Arquivos enviados */}
          {uploads.length > 0 && (
            <div className="card">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                {uploads.length} arquivo(s) enviado(s)
              </p>
              <ul className="space-y-2">
                {uploads.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--c-surface)' }}>
                    <FileText size={15} style={{ color: '#0c6665' }}/>
                    <span className="flex-1 text-sm truncate" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--c-text)' }}>{f.name}</span>
                    <a href={f.viewUrl} target="_blank" rel="noopener noreferrer"
                       className="text-xs" style={{ color: '#0c6665', fontFamily: 'var(--font-jakarta)' }}>
                      Ver
                    </a>
                    <CheckCircle2 size={14} style={{ color: '#166534' }}/>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => setStep('review')}>Voltar</button>
            <button className="btn-primary" onClick={handleEnroll} disabled={enrolling}>
              {enrolling ? <Loader2 size={15} className="animate-spin"/> : <UserCheck size={15}/>}
              {enrolling ? 'Matriculando…' : 'Concluir Matrícula'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Concluído ── */}
      {step === 'done' && (
        <div className="card text-center animate-slide-up py-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: 'var(--c-primary-light)' }}>
            <CheckCircle2 size={32} style={{ color: '#0c6665' }}/>
          </div>
          <h2 className="text-2xl mb-1" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300, color: 'var(--c-text)' }}>
            Matrícula concluída!
          </h2>
          <p className="text-sm mb-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            {candidate?.name} foi matriculado(a) com sucesso.
          </p>
          <code className="text-xs" style={{ color: '#0c6665', fontFamily: 'var(--font-mono)' }}>
            ID: {studentId}
          </code>

          <div className="flex gap-3 justify-center mt-8">
            <a
              href={`https://api.whatsapp.com/send?phone=55${candidate?.phone?.replace(/\D/g,'')}&text=${encodeURIComponent('Olá! Sua matrícula no Pré-Vestibular Social foi confirmada com sucesso! 🎉 Bem-vindo(a)!')}`}
              target="_blank" rel="noopener noreferrer"
              className="btn-primary bg-green-600 hover:bg-green-700"
            >
              Avisar via WhatsApp
            </a>
            <button className="btn-secondary" onClick={() => {
              setStep('search'); setCpf(''); setCandidate(null);
              setUploads([]); setStudentId('');
            }}>
              Nova matrícula
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
