'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR }   from 'date-fns/locale';
import { CheckCircle2, XCircle, Loader2, Users, MessageCircle } from 'lucide-react';
import { Students, Attendance, whatsAppLink } from '@/lib/gas-client';
import type { Student, AttendanceRecord } from '@/types';

export default function MonitorPage() {
  const today   = format(new Date(), 'yyyy-MM-dd');
  const todayFmt= format(new Date(), "d 'de' MMMM", { locale: ptBR });

  const [students,   setStudents]   = useState<Student[]>([]);
  const [records,    setRecords]    = useState<AttendanceRecord[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    async function load() {
      try {
        const [s, a] = await Promise.all([
          Students.list('ATIVO'),
          Attendance.list({ date: today, type: 'MONITORIA' }),
        ]);
        setStudents(s.students);
        setRecords(a.attendance);
      } catch {
        showToast('Erro ao carregar dados.', false);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [today]);

  async function mark(studentId: string, status: 'P' | 'F') {
    setSubmitting(studentId);
    try {
      await Attendance.mark({ student_id: studentId, date: today, status, type: 'MONITORIA' });
      const r = await Attendance.list({ date: today, type: 'MONITORIA' });
      setRecords(r.attendance);
      showToast(status === 'P' ? 'Presença na monitoria confirmada.' : 'Falta na monitoria registrada.');
    } catch (e: any) {
      showToast(e.message ?? 'Erro.', false);
    } finally {
      setSubmitting(null);
    }
  }

  const getRecord = (id: string) => records.find(r => r.student_id === id) ?? null;
  const presentes = records.filter(r => r.status === 'P').length;
  const faltas    = records.filter(r => r.status === 'F').length;

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in">

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
          Monitor
        </p>
        <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300 }}>
          Chamada de Monitoria
        </h1>
        <p className="text-sm" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
          {todayFmt} · Registros separados das aulas regulares
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total', val: students.length, color: '#0c6665', bg: 'var(--c-primary-light)' },
          { label: 'Presentes', val: presentes, color: '#166534', bg: '#f0fdf4' },
          { label: 'Faltas',    val: faltas,    color: '#991b1b', bg: '#fef2f2' },
        ].map(s => (
          <div key={s.label} className="card text-center" style={{ background: s.bg, borderColor: 'transparent' }}>
            <p className="text-3xl font-light mb-1" style={{ fontFamily: 'var(--font-fraunces)', color: s.color }}>{s.val}</p>
            <p className="text-xs" style={{ color: s.color, fontFamily: 'var(--font-jakarta)', opacity: 0.8 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <Users size={15} style={{ color: 'var(--c-text-muted)' }} />
          <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--c-text)' }}>
            Alunos na Monitoria
          </span>
          {loading && <Loader2 size={14} className="animate-spin ml-auto" style={{ color: 'var(--c-primary-mid)' }} />}
        </div>

        <div className="space-y-2">
          {students.map(s => {
            const rec  = getRecord(s.id_student);
            const busy = submitting === s.id_student;

            return (
              <div
                key={s.id_student}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors"
                style={{
                  borderColor: rec?.status === 'P' ? '#bbf7d0' : rec?.status === 'F' ? '#fecaca' : 'var(--c-border)',
                  background:  rec?.status === 'P' ? '#f0fdf4'  : rec?.status === 'F' ? '#fef2f2' : '#fff',
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                     style={{ background: 'var(--c-surface-2)', color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                  {s.name[0].toUpperCase()}
                </div>
                <span className="flex-1 text-sm" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--c-text)' }}>
                  {s.name}
                </span>
                {rec ? (
                  <div className="flex items-center gap-2">
                    <span className={`badge-${rec.status}`}>{rec.status === 'P' ? 'Presente' : 'Falta'}</span>
                    {rec.status === 'F' && (
                      <a href={whatsAppLink('', 'chamada')} target="_blank" rel="noopener noreferrer"
                         className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors">
                        <MessageCircle size={14} />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => mark(s.id_student, 'P')} disabled={busy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 disabled:opacity-50 transition-all"
                      style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {busy ? <Loader2 size={11} className="animate-spin"/> : <CheckCircle2 size={11}/>} P
                    </button>
                    <button onClick={() => mark(s.id_student, 'F')} disabled={busy}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 disabled:opacity-50 transition-all"
                      style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {busy ? <Loader2 size={11} className="animate-spin"/> : <XCircle size={11}/>} F
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
