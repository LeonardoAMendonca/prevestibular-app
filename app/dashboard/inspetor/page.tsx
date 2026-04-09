'use client';

import { useState, useRef, useCallback } from 'react';
import { Search, Camera, CheckCircle2, XCircle, MessageCircle, Loader2, User } from 'lucide-react';
import Image    from 'next/image';
import { format } from 'date-fns';
import { ptBR }  from 'date-fns/locale';
import { Students, Attendance, formatCpf, whatsAppLink } from '@/lib/gas-client';
import type { Student, AttendanceRecord } from '@/types';

interface StudentWithPhoto extends Student {
  photo_url?: string | null;
}

type AttStatus = 'P' | 'F' | null;

export default function InspetorPage() {
  const today    = format(new Date(), 'yyyy-MM-dd');
  const todayStr = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  const [cpf,        setCpf]        = useState('');
  const [student,    setStudent]    = useState<StudentWithPhoto | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [marking,    setMarking]    = useState<'REGULAR' | 'MONITORIA' | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const search = useCallback(async () => {
    const raw = cpf.replace(/\D/g, '');
    if (raw.length !== 11) { showToast('Digite um CPF com 11 dígitos.', false); return; }

    setSearching(true);
    setStudent(null);
    setAttendance([]);

    try {
      // Busca aluno e foto em paralelo
      const studentsRes = await Students.list('ATIVO');
      const found = studentsRes.students.find(s => s.cpf.replace(/\D/g, '') === raw);

      if (!found) { showToast('Aluno não encontrado ou inativo.', false); return; }

      const [photoRes, attRes] = await Promise.all([
        Students.getPhoto(found.id_student),
        Attendance.list({ student_id: found.id_student, date: today }),
      ]);

      setStudent({ ...found, photo_url: photoRes.photo_url });
      setAttendance(attRes.attendance);
    } catch (e: any) {
      showToast(e.message ?? 'Erro ao buscar aluno.', false);
    } finally {
      setSearching(false);
    }
  }, [cpf, today]);

  async function markAttendance(type: 'REGULAR' | 'MONITORIA', status: 'P' | 'F') {
    if (!student) return;
    setMarking(type);
    try {
      await Attendance.mark({ student_id: student.id_student, date: today, status, type });
      const attRes = await Attendance.list({ student_id: student.id_student, date: today });
      setAttendance(attRes.attendance);
      showToast(`Presença ${status === 'P' ? 'registrada' : 'falta lançada'} — ${type}.`);
    } catch (e: any) {
      showToast(e.message ?? 'Erro ao registrar presença.', false);
    } finally {
      setMarking(null);
    }
  }

  function getStatus(type: 'REGULAR' | 'MONITORIA'): AttStatus {
    const rec = attendance.find(r => r.type === type);
    return rec ? rec.status : null;
  }

  // Formata CPF enquanto digita
  function handleCpfChange(v: string) {
    const d = v.replace(/\D/g, '').slice(0, 11);
    const f = d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
    setCpf(f);
  }

  const regularStatus  = getStatus('REGULAR');
  const monitorStatus  = getStatus('MONITORIA');

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card-hover text-sm font-medium animate-slide-up
          ${toast.ok ? 'bg-teal-700 text-white' : 'bg-red-600 text-white'}`}
          style={{ fontFamily: 'var(--font-jakarta)' }}
        >
          {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--c-primary-mid)', fontFamily: 'var(--font-jakarta)', fontWeight: 500 }}>
          Chamada Rápida
        </p>
        <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--c-text)', fontWeight: 300 }}>
          Registro de Presença
        </h1>
        <p className="text-sm capitalize" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
          {todayStr}
        </p>
      </div>

      {/* Busca por CPF */}
      <div className="card mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
          Buscar aluno por CPF
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text-muted)' }} />
            <input
              ref={inputRef}
              className="field pl-9"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={e => handleCpfChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
          </div>
          <button className="btn-primary" onClick={search} disabled={searching}>
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Card do aluno */}
      {student && (
        <div className="card animate-slide-up">
          {/* Info do aluno */}
          <div className="flex items-start gap-5 mb-6 pb-6 border-b border-slate-100">
            {/* Foto */}
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                 style={{ background: 'var(--c-surface-2)' }}>
              {student.photo_url ? (
                <Image src={student.photo_url} alt={student.name} width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <User size={32} style={{ color: 'var(--c-text-muted)' }} />
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-xl mb-0.5" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 400, color: 'var(--c-text)' }}>
                {student.name}
              </h2>
              <p className="text-sm mb-2" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                CPF: {formatCpf(student.cpf)} · ID: {student.id_student}
              </p>
              <span className={`badge-${student.status}`}>{student.status}</span>
            </div>
          </div>

          {/* Checklist de presença */}
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
            Presença — {format(new Date(), 'dd/MM/yyyy')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['REGULAR', 'MONITORIA'] as const).map(type => {
              const status = type === 'REGULAR' ? regularStatus : monitorStatus;
              const busy   = marking === type;

              return (
                <div key={type} className="rounded-xl p-4 border" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--c-text)' }}>
                      {type === 'REGULAR' ? '📚 Aula Regular' : '🔬 Monitoria'}
                    </span>
                    {status && (
                      <span className={`badge-${status}`}>
                        {status === 'P' ? 'Presente' : 'Falta'}
                      </span>
                    )}
                  </div>

                  {status ? (
                    <p className="text-xs" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                      Já registrado. Use <strong>PUT /attendance</strong> para corrigir.
                    </p>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
                                   bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 disabled:opacity-50"
                        style={{ fontFamily: 'var(--font-jakarta)' }}
                        onClick={() => markAttendance(type, 'P')}
                        disabled={!!marking}
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Presente
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
                                   bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 disabled:opacity-50"
                        style={{ fontFamily: 'var(--font-jakarta)' }}
                        onClick={() => markAttendance(type, 'F')}
                        disabled={!!marking}
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                        Falta
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* WhatsApp — só aparece se alguma falta foi lançada */}
          {(regularStatus === 'F' || monitorStatus === 'F') && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                Comunicação Rápida
              </p>
              <a
                href={whatsAppLink('', 'chamada')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                           bg-green-500 hover:bg-green-600 text-white"
                style={{ fontFamily: 'var(--font-jakarta)' }}
              >
                <MessageCircle size={15} />
                Avisar ausência via WhatsApp
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
