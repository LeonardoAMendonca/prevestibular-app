'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval,
         isSameMonth, isToday, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Users, CheckCircle2, XCircle, Loader2, MessageCircle } from 'lucide-react';
import { Students, Attendance, whatsAppLink } from '@/lib/gas-client';
import type { Student, AttendanceRecord } from '@/types';

export default function ProfPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay,  setSelectedDay]  = useState<Date>(new Date());
  const [students,     setStudents]     = useState<Student[]>([]);
  const [records,      setRecords]      = useState<AttendanceRecord[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [submitting,   setSubmitting]   = useState<string | null>(null); // student_id being saved
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  const selectedDateStr = format(selectedDay, 'yyyy-MM-dd');

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // Carrega alunos ativos uma vez
  useEffect(() => {
    Students.list('ATIVO')
      .then(r => setStudents(r.students))
      .catch(() => showToast('Erro ao carregar alunos.', false));
  }, []);

  // Recarrega registros quando o dia selecionado muda
  useEffect(() => {
    setLoading(true);
    Attendance.list({ date: selectedDateStr, type: 'REGULAR' })
      .then(r => setRecords(r.attendance))
      .catch(() => showToast('Erro ao carregar chamada.', false))
      .finally(() => setLoading(false));
  }, [selectedDateStr]);

  async function mark(studentId: string, status: 'P' | 'F') {
    setSubmitting(studentId);
    try {
      await Attendance.mark({
        student_id: studentId,
        date: selectedDateStr,
        status,
        type: 'REGULAR',
      });
      const r = await Attendance.list({ date: selectedDateStr, type: 'REGULAR' });
      setRecords(r.attendance);
      showToast(status === 'P' ? 'Presença confirmada.' : 'Falta registrada.');
    } catch (e: any) {
      showToast(e.message ?? 'Erro ao registrar.', false);
    } finally {
      setSubmitting(null);
    }
  }

  function getRecord(studentId: string) {
    return records.find(r => r.student_id === studentId) ?? null;
  }

  // Dias do calendário
  const monthDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end:   endOfMonth(currentMonth),
  });

  // Dias com alguma chamada lançada (para dot indicator)
  const daysWithRecords = new Set(records.map(r => r.date));

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Pad de início da semana
  const startPad = startOfMonth(currentMonth).getDay();

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">

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
          Professor
        </p>
        <h1 className="text-3xl" style={{ fontFamily: 'var(--font-fraunces)', fontWeight: 300 }}>
          Minhas Aulas
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">

        {/* ── Calendário ── */}
        <div className="card self-start">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="btn-secondary p-2">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium capitalize" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--c-text)' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="btn-secondary p-2">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map(day => {
              const dateStr  = format(day, 'yyyy-MM-dd');
              const selected = isSameDay(day, selectedDay);
              const today    = isToday(day);
              const hasDot   = daysWithRecords.has(dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(day)}
                  className="relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-sm transition-all duration-100"
                  style={{
                    fontFamily: 'var(--font-jakarta)',
                    background: selected ? '#0c6665' : today ? 'var(--c-primary-light)' : 'transparent',
                    color: selected ? '#fff' : today ? '#0c6665' : isSameMonth(day, currentMonth) ? 'var(--c-text)' : 'var(--c-border)',
                    fontWeight: today ? 600 : 400,
                  }}
                >
                  {format(day, 'd')}
                  {hasDot && !selected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: '#0c6665' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Lista de chamada ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-medium" style={{ fontFamily: 'var(--font-jakarta)', color: 'var(--c-text)' }}>
                Chamada — {format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                <span className="inline-flex items-center gap-1"><Users size={11}/>{students.length} alunos ativos</span>
                · {records.filter(r => r.status === 'P').length} presentes
                · {records.filter(r => r.status === 'F').length} faltas
              </p>
            </div>
            {loading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-primary-mid)' }} />}
          </div>

          <div className="space-y-2">
            {students.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--c-text-muted)', fontFamily: 'var(--font-jakarta)' }}>
                Nenhum aluno ativo cadastrado.
              </p>
            )}
            {students.map(s => {
              const rec  = getRecord(s.id_student);
              const busy = submitting === s.id_student;

              return (
                <div
                  key={s.id_student}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors"
                  style={{
                    borderColor: rec?.status === 'P' ? '#c9e8e8' : rec?.status === 'F' ? '#fecaca' : 'var(--c-border)',
                    background:  rec?.status === 'P' ? '#f0fdf4' : rec?.status === 'F' ? '#fef2f2' : 'var(--c-surface)',
                  }}
                >
                  {/* Avatar inicial */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
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
                      <button
                        onClick={() => mark(s.id_student, 'P')}
                        disabled={busy}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                   bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 disabled:opacity-50"
                        style={{ fontFamily: 'var(--font-jakarta)' }}
                      >
                        {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        P
                      </button>
                      <button
                        onClick={() => mark(s.id_student, 'F')}
                        disabled={busy}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                   bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 disabled:opacity-50"
                        style={{ fontFamily: 'var(--font-jakarta)' }}
                      >
                        {busy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                        F
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
