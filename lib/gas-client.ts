// =============================================================================
//  lib/gas-client.ts — Cliente tipado para o backend Google Apps Script
//
//  IMPORTANTE: NUNCA chame o GAS diretamente do browser (CORS bloqueado).
//  Todas as chamadas devem passar pela API route interna: /api/gas
//  que injeta o idToken da sessão no header Authorization.
// =============================================================================

import type {
  EduUser, Candidate, Student, AttendanceRecord, RankedCandidate,
} from '@/types';

// ── Tipos de request/response ────────────────────────────────────────────────

export interface EnrollPayload {
  cpf:          string;
  candidate_id: string;
  name:         string;
  birth_date:   string;
}

export interface AttendancePayload {
  student_id: string;
  date:       string;
  status:     'P' | 'F';
  type:       'REGULAR' | 'MONITORIA';
}

export interface CorrectAttendancePayload {
  id_event: string;
  status:   'P' | 'F';
  reason:   string;
}

export interface FileUploadPayload {
  cpf:         string;
  file_base64: string;
  mime_type:   string;
  file_name:   string;
}

// ── Função base de fetch ─────────────────────────────────────────────────────

interface FetchOptions {
  method?:  string;
  body?:    Record<string, unknown>;
  params?:  Record<string, string>;
}

async function gasRequest<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, params = {} } = opts;

  const qs = new URLSearchParams({ path, ...params });

  // Method override: GAS só aceita GET e POST nativamente
  const effectiveMethod = method === 'GET' ? 'GET' : 'POST';
  if (method !== 'GET' && method !== 'POST') {
    qs.set('_method', method);
  }

  const res = await fetch(`/api/gas?${qs.toString()}`, {
    method: effectiveMethod,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido.' }));
    throw new Error(err.error ?? `Erro ${res.status}`);
  }

  return res.json();
}

// ── Métodos de usuários ──────────────────────────────────────────────────────

export const Users = {
  list: () =>
    gasRequest<{ users: EduUser[] }>('users'),

  create: (data: Pick<EduUser, 'email' | 'name' | 'role'>) =>
    gasRequest<{ message: string }>('users', { method: 'POST', body: data }),

  update: (data: Partial<EduUser> & { email: string }) =>
    gasRequest<{ message: string }>('users', { method: 'PUT', body: data }),

  remove: (email: string) =>
    gasRequest<{ message: string }>('users', { method: 'DELETE', body: { email } }),
};

// ── Métodos de candidatos ────────────────────────────────────────────────────

export const Candidates = {
  list: (status?: string) =>
    gasRequest<{ candidates: Candidate[]; total: number }>('candidates',
      status ? { params: { status } } : {}),

  searchByCpf: (cpf: string) =>
    gasRequest<{ found: boolean; candidate?: Candidate }>('candidates/search', {
      params: { cpf },
    }),
};

// ── Métodos de alunos ────────────────────────────────────────────────────────

export const Students = {
  list: (status?: string) =>
    gasRequest<{ students: Student[]; total: number }>('students',
      status ? { params: { status } } : {}),

  enroll: (data: EnrollPayload) =>
    gasRequest<{ id_student: string; drive_folder: string }>('students', {
      method: 'POST', body: data,
    }),

  update: (data: Partial<Student> & { id_student: string }) =>
    gasRequest<{ message: string }>('students', { method: 'PUT', body: data }),

  getPhoto: (id_student: string) =>
    gasRequest<{ photo_url: string | null; name: string }>('students/photo', {
      params: { id_student },
    }),
};

// ── Métodos de presença ──────────────────────────────────────────────────────

export const Attendance = {
  list: (filters: Partial<{ date: string; type: string; student_id: string }> = {}) =>
    gasRequest<{ attendance: AttendanceRecord[]; total: number }>('attendance', {
      params: filters as Record<string, string>,
    }),

  mark: (data: AttendancePayload) =>
    gasRequest<{ id_event: string }>('attendance', { method: 'POST', body: data }),

  correct: (data: CorrectAttendancePayload) =>
    gasRequest<{ message: string }>('attendance', { method: 'PUT', body: data }),
};

// ── Métodos de ranking ───────────────────────────────────────────────────────

export const Ranking = {
  get: (limit?: number) =>
    gasRequest<{ ranking: RankedCandidate[]; total: number }>('ranking',
      limit ? { params: { limit: String(limit) } } : {}),

  calculate: () =>
    gasRequest<{ calculados: number }>('ranking/calculate', { method: 'POST' }),
};

// ── Upload de arquivos ───────────────────────────────────────────────────────

export const Files = {
  /**
   * Converte File para base64 e envia ao GAS → Drive.
   * @param cpf - CPF do aluno (define a pasta destino)
   * @param file - Objeto File do input
   */
  upload: async (cpf: string, file: File): Promise<{ file_id: string; view_url: string }> => {
    const base64 = await fileToBase64(file);
    return gasRequest('files/upload', {
      method: 'POST',
      body: {
        cpf,
        file_base64: base64,
        mime_type:   file.type,
        file_name:   file.name,
      },
    });
  },
};

// ── Utilitário ───────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Formata número de CPF para exibição: 000.000.000-00 */
export function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/** Gera link WhatsApp com template pré-definido */
export function whatsAppLink(phone: string, template: 'chamada' | 'matricula' | 'aviso'): string {
  const num = phone.replace(/\D/g, '');
  const msgs: Record<string, string> = {
    chamada:  'Olá! Seu nome constou como *ausente* na chamada de hoje. Caso tenha sido um engano, entre em contato com a coordenação.',
    matricula:'Olá! Sua inscrição no Pré-Vestibular Social foi *aprovada*. Compareça à secretaria para concluir sua matrícula.',
    aviso:    'Olá! Há um recado importante da coordenação do Pré-Vestibular Social aguardando você. Por favor, entre em contato.',
  };
  return `https://api.whatsapp.com/send?phone=55${num}&text=${encodeURIComponent(msgs[template])}`;
}
